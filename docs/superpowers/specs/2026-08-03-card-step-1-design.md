# SLSP Card Step 1 Design

Date: 2026-08-03
Status: Approved design

## 1. Purpose

Step 1 gives SLSP Card a dedicated backend and moves the current patron-management business logic out of the Angular Cloud App. The milestone preserves the supported Card workflows while making the browser a typed, thin client.

The supported workflows are:

- Authorize the current institution and Alma operator.
- Load the patron selected through the Alma Cloud App entity context from the Network Zone (NZ).
- View, add, and remove supported library card numbers.
- View and manage the currently supported user blocks.
- Select the preferred postal address.

Shared Alma data conventions follow the registration platform. Clearly accidental or unsafe mutations in either legacy implementation are narrowed and documented rather than copied blindly.

Step 1 also updates the Card frontend to the current SLSP Cloud App baseline, using `slsp-staff-cloud-app` as the reference for Angular, Ex Libris SDK, TypeScript, RxJS, tooling, and observable composition.

## 2. Scope

### In scope

- A new standalone Quarkus/Java Card backend repository.
- Direct backend access to Alma IZ and NZ APIs.
- Separate local, sandbox/beta, and future production targets.
- A Card-specific versioned HTTP API.
- Backend-owned authentication, authorization, business validation, Alma mutations, errors, and operational logging.
- A Card-specific patron DTO rather than browser access to complete Alma users.
- Angular 18, Ex Libris Cloud App SDK 2.x, RxJS 7, TypeScript 5.5, Angular Material, ESLint, and Prettier, aligned with the staff Cloud App baseline.
- Characterization, unit, contract, frontend, and local integration tests.

### Out of scope

- Patron search outside Alma page entities.
- User-group management.
- Invoice postal-address or invoice-email management.
- Forced edu-ID synchronization.
- Registration, merge, deletion, affiliation, or other registration-platform workflows.
- Replacing or modifying the shared generic Cloud App proxy for its other consumers.
- Production cutover. The current production Card app and proxy remain in service during local and later beta development.
- A Card UI redesign.

## 3. System architecture

```text
SLSP Card Cloud App
  -> SLSP Card API
       -> JWT and institution authorization
       -> operator role lookup in Alma IZ
       -> Card domain services
       -> patron read/write in Alma NZ
```

The Card backend does not call the generic proxy or the registration platform. It has no application database.

The backend contains the following focused units:

- **API resources:** access, patron view, library card number, block, and preferred-address endpoints.
- **Authentication:** Ex Libris JWT verification.
- **Authorization:** institution allowlisting and current-operator role validation through Alma IZ.
- **Domain services:** Card-specific validation and narrow mutations.
- **Alma clients:** typed IZ and NZ operations with deployment-held credentials.
- **DTO mapping:** complete Alma user to the Card patron view.
- **Selection handling:** stateless opaque selectors for exact Alma array items.
- **Errors and observability:** stable public error types, request correlation, safe upstream logging, and mutation audit events.

Each unit exposes typed interfaces and can be tested independently of the others.

## 4. Environments and configuration

There are three frontend targets:

```text
Alma URL contains localhost -> local Quarkus backend
Alma URL contains psb       -> sandbox/beta Card backend
otherwise                   -> future production Card backend
```

The matching is case-insensitive. The frontend selects a fixed configured base URL. It does not send `isProdEnvironment` or another credential-selection flag.

Sandbox/beta and production are separate backend deployments. Each deployment contains credentials for exactly one Alma environment and cannot select the other environment's keys.

Environment-backed backend configuration contains:

- One NZ API key.
- Allowed institutions and their IZ API keys.
- JWT issuer, exact accepted Card audiences, and the Alma public key.
- Required role codes.
- Role-cache TTL and privacy-safe cache-key salt.
- Selector-signing key.
- Card service identity used in Alma provenance.
- Alma base URL and explicit connection/read timeouts.
- Exact allowed browser origins.

The local backend uses uncommitted local configuration and sandbox/test Alma credentials. Examples contain placeholders only. Secrets never enter frontend code, committed properties, fixtures, documentation, or logs. The backend fails at startup when core configuration is unusable; an institution with no configured IZ key is denied.

## 5. Authentication and authorization

Every API request includes the Ex Libris bearer token. Quarkus verifies:

- RS256 signature.
- Configured issuer.
- Exact Card audience.
- The token's applicable time claims.

The authorization layer then:

1. Requires signed `inst_code` and `sub` claims.
2. Confirms that the institution and its IZ API key are configured.
3. Loads the operator identified by `sub` from that IZ.
4. Requires at least one active role with type `26`, `215`, or `21`.

JWT validation and institution checks occur on every request. Only the Alma role result is cached. The backend uses an in-memory Quarkus Caffeine cache with a configurable default TTL of one hour for both allowed and denied results. Its key is privacy-safe and derived from the deployment context, institution, accepted audience, and operator. Patron records and mutation results are never cached.

`GET /api/v1/allowed` follows the RapidoBackend and 7DM-Backend convention and returns `204` after the same request filters accept the caller. It is an initial UI access check, not a one-time authentication operation; all other endpoints remain independently protected.

Operator and institution provenance comes only from verified JWT claims and backend configuration. The browser cannot provide or override audit identity.

## 6. Card API

```text
GET    /api/v1/allowed
GET    /api/v1/patrons/{patronId}

POST   /api/v1/patrons/{patronId}/library-card-numbers
DELETE /api/v1/patrons/{patronId}/library-card-numbers/{selector}

POST   /api/v1/patrons/{patronId}/blocks
DELETE /api/v1/patrons/{patronId}/blocks/{selector}

PUT    /api/v1/patrons/{patronId}/preferred-address
```

The Cloud App strictly extracts the patron identifier from a selected Alma user entity. It sends only that identifier. It never sends an Alma hostname, arbitrary Alma URL, environment flag, operator identity, API key, or complete patron record.

Business request bodies are small and typed:

- Add library card number: the entered value.
- Add block: a supported code and comment.
- Preferred address: the address selector from the latest patron DTO.
- Removal: the selector in the resource path.

Every successful mutation returns the refreshed Card patron DTO.

## 7. Card patron DTO and selectors

The Card patron DTO contains only fields needed by the UI:

- Full name.
- External-user indicator.
- Displayed library card identifiers, including whether each is an alias or removable.
- Matriculation number and dashed display form.
- Displayed supported blocks and their dates and note.
- Selectable postal-address display fields and preferred state.
- Opaque selectors for actionable array items.

It does not expose the complete Alma user.

Alma identifiers, blocks, and addresses do not provide a reliable application identifier for these actions. The backend therefore creates a stateless opaque selector bound to:

- Resource kind.
- Patron context.
- Original array position.
- A canonical fingerprint of the exact Alma element.

The selector is integrity-protected with backend configuration. On mutation, the backend reloads the patron, verifies the selector, confirms that the element at that position still has the same canonical fingerprint, and rechecks business eligibility. A missing, moved, changed, forged, or ineligible selection produces `409 Conflict`; it never falls back to a same-value item.

Selectors are concurrency guards and exact-selection references, not authorization credentials.

## 8. Read and mutation flow

Read flow:

```text
authenticate JWT and authorize institution/operator
  -> validate and decode patron identifier
  -> GET complete patron from Alma NZ
  -> map to Card DTO
  -> return DTO
```

Mutation flow:

```text
authenticate JWT and authorize institution/operator
  -> validate request shape and context-free business rules
  -> GET latest complete patron from Alma NZ
  -> validate the action against current patron state
  -> apply one narrow mutation
  -> PUT complete patron to Alma NZ
  -> map Alma response to Card DTO
  -> return refreshed DTO
```

Context-free validation includes request types, supported block codes, required comments, and library-card syntax. State-dependent validation includes duplicates, selector verification, removability, and current address existence.

The fresh read removes browser-held stale-user risk and preserves fields that the Card UI does not understand. Alma still requires a whole-user PUT, so a small read/modify/write concurrency window remains. The design does not claim to eliminate an Alma update that races between the backend GET and PUT. Automatic retries do not repeat a PUT whose outcome is uncertain.

## 9. Shared business rules

The behavioral precedence is:

1. The registration platform defines shared Alma data contracts.
2. The current Card Cloud App defines the visible Step 1 workflows.
3. Ambiguous or unsafe mutation behavior is replaced with the narrowest safe mutation and recorded here.

### 9.1 Library card numbers

- Display identifiers whose type is `01`, `02`, or `03`.
- Display type `04` as the matriculation number with its dashed form.
- Preserve the shared registration-platform/Card validation patterns, special exclusions, normalization, and matriculation checksum behavior.
- Normalize to lowercase and remove hyphens except in the historical `SLSP-...` form.
- Reject a duplicate case-insensitively across identifier types `01`, `02`, and `03`.
- Add a new identifier as active, external type `02`.
- Record human-readable provenance derived from verified operator ID, institution, and backend time.
- When an accepted value is an eight-digit matriculation number, add its dashed form as a second active external type `02` identifier with the same provenance.
- Display dashed matriculation aliases as aliases without a direct remove action.
- An identifier is directly removable only when it is non-dashed type `02` and its note does not contain `via edu-ID`, case-insensitively.
- Removal deletes only the selected identifier.
- Removing an undashed eight-digit identifier also removes one dashed type `02` alias only when its value and provenance associate it with the selected identifier. It does not remove same-value identifiers of another type or unrelated duplicate aliases.

### 9.2 Blocks

- Supported codes are `02`, `03`, `03.1`, `09`, and `08`.
- A block is eligible for display when it is active, unexpired, and user-level.
- For compatibility with the registration-platform management view, the first eligible block for each supported code is the displayed/actionable block. Further duplicates remain untouched; after the first is removed, the next becomes visible on refresh.
- Codes `02`, `03`, `03.1`, and `09` may be added when no eligible block of that code is currently displayed.
- Code `08` is display/removal-only.
- Code `09` requires a non-blank comment.
- New blocks are active, external, and user-level.
- The human-readable note retains the registration-compatible institution/comment shape and uses verified operator context.
- Removal deletes only the block referenced by the verified selector. It never removes hidden, expired, inactive, non-user, or duplicate blocks merely because they share a code.

### 9.3 Preferred postal address and settings note

- Return the patron's postal addresses as presentation DTOs. An address must contain a usable primary address type to be selectable.
- Set the exact selected address to preferred and all other addresses to non-preferred.
- Store the selected address's primary type under `preferredPostalAddressType`.
- A shared settings note has Alma note type `Other` and text beginning with `User Settings:` followed by a JSON object.
- Scan matching `Other` notes in Alma order. The first matching note is authoritative, consistent with registration-platform behavior.
- If the authoritative note contains valid JSON, preserve all unknown keys and update only `preferredPostalAddressType`.
- If the authoritative note contains malformed or non-object JSON, return a conflict and do not overwrite it or create another note.
- Later duplicate settings notes are left untouched; Step 1 does not silently consolidate shared data.
- Create a new `Other` settings note only when no matching note exists.
- New-note provenance uses the configured Card service identity and backend time.

## 10. Errors

Public errors contain a stable Card error type and a request correlation ID. Optional context is explicitly whitelisted and contains no Alma URL, API key, token, patron record, or upstream response body.

Status categories are:

- `401 Unauthorized`: missing or invalid authentication.
- `403 Forbidden`: unconfigured institution or missing required role.
- `400 Bad Request`: malformed request or context-free business validation failure.
- `404 Not Found`: NZ patron not found.
- `409 Conflict`: duplicate value, stale/invalid selector, changed patron state, or malformed authoritative settings data.
- `502 Bad Gateway`: sanitized upstream Alma failure.
- `503 Service Unavailable`: Alma timeout or temporary dependency failure.

Stable error types distinguish at least authentication, access denial, patron-not-found, invalid card format, duplicate card number, unsupported block, required block comment, stale selection, invalid settings note, upstream failure, and unexpected failure. The Angular client maps types to translations and can display the correlation ID for support.

## 11. Logging and privacy

Every request receives a UUID correlation ID stored in logging context and returned as the public error ID when a request fails.

Structured logs record:

- Request start and completion.
- HTTP method, stable route template or operation name, status, institution, and duration.
- Safe upstream stages such as operator-role lookup, patron read, and patron update.
- Exactly one success or failure outcome for each upstream operation.
- Mutation action, institution, privacy-safe operator/patron identifiers, outcome, and correlation ID.

Raw paths are not logged because they contain patron IDs. Logs also exclude query strings, JWTs, authorization headers, API keys, raw operator/patron identifiers, complete records, request bodies, comments, notes, addresses, and upstream response bodies. Privacy-safe identifiers use a stable salted digest suitable for correlating events without revealing source IDs.

## 12. Modernized thin frontend

The frontend keeps these responsibilities:

- Read Ex Libris initialization data.
- Resolve the configured backend base URL.
- Obtain the signed JWT.
- Call `/api/v1/allowed`.
- Observe Alma user entities and select/extract the patron identifier.
- Render the Card DTO.
- Send typed Card actions.
- Replace displayed state with each successful response DTO.
- Display confirmation prompts, loading states, translated alerts, and safe error states.

The current layout, tabs, user guidance, sandbox banner, translations, and visual identity remain. User-group UI remains out of scope.

A dedicated backend HTTP service replaces the global proxy interceptor. It resolves only the configured Card API origins and attaches a short-lived SDK token to Card API calls.

Focused frontend services are:

- **Backend HTTP service:** environment resolution, JWT acquisition, and typed HTTP methods.
- **Authorization service:** typed `/api/v1/allowed` result.
- **Patron service:** typed Card reads and actions.
- **Selection/state layer:** current Alma entity and latest patron view.
- **Components:** rendering, forms, dialogs, and translated feedback.

The observable rules follow the staff Cloud App:

- Keep SDK calls as typed `Observable`s; do not wrap them in manual promises or call `toPromise()`.
- Use `take(1)` for one-time snapshots from hot SDK streams.
- Use `switchMap` for dependent work and to cancel obsolete patron loads when entity selection changes.
- Use carefully scoped `shareReplay(1)` for stable initialization, environment, and concurrent token work.
- Use typed result unions and `catchError` for expected authorization/business/transport states.
- Use `finalize` or declarative view models for loading cleanup.
- Use `DestroyRef` with `takeUntilDestroyed`, or the template `async` pipe, for long-lived subscriptions.
- Prevent duplicate subscriptions from producing duplicate HTTP requests.
- Replace `Object`, `any`, custom `Map` properties, and mutable complete-user state with explicit DTO interfaces and immutable state transitions.

Forms retain presentation-level checks such as required values and confirmation dialogs. Backend validation is authoritative; Angular does not carry a second copy of card patterns, block mutation rules, or settings-note logic.

## 13. Testing strategy

### 13.1 Characterization fixtures

Create sanitized representative Alma user fixtures for:

- Card identifier types, formats, duplicates, edu-ID notes, and matriculation aliases.
- Active, inactive, expired, non-user, supported, unsupported, and duplicate blocks.
- Multiple addresses and preferred states.
- Missing, valid, malformed, unknown-key, and duplicate `User Settings:` notes.
- External and institutional primary-ID shapes.

Fixtures contain no production patron or operator data.

### 13.2 Backend unit tests

Cover:

- Card validation, normalization, checksum, duplicate detection, paired alias creation, visibility, and narrow removal.
- Block filtering, supported actions, comments, creation, representative selection, and exact removal.
- Preferred-address selection and settings-note parsing, key preservation, creation, malformed JSON, and duplicate handling.
- Alma-to-Card DTO mapping and selector integrity/staleness.
- Error mapping, correlation, and log sanitization.

### 13.3 Authorization tests

Use sanitized signed JWT fixtures and mocked IZ responses to cover:

- Missing/invalid tokens, issuer, and audiences.
- Missing `inst_code` or `sub`.
- Unconfigured institutions.
- Missing, inactive, and allowed operator roles.
- Positive and negative role-cache entries and one-hour expiry.
- Isolation between institution/operator/audience cache keys.

### 13.4 REST and Alma contract tests

Run Quarkus API tests against a mocked Alma service and verify:

- Exact endpoint request and response contracts.
- API keys are added only by the backend.
- Every mutation performs a fresh NZ read before its PUT.
- Invalid input or stale selectors never cause a PUT.
- Only the intended nested element changes and unrelated Alma fields survive.
- The refreshed Card DTO comes from the Alma PUT response.
- Timeouts and Alma failures become sanitized Card errors.
- An uncertain PUT is not automatically retried.
- Sensitive values do not appear in public errors or captured logs.

### 13.5 Frontend tests

Cover:

- Local, PSB, and future production backend resolution.
- JWT attachment and concurrent token-work sharing.
- Patron-ID extraction from valid user entities and rejection of invalid shapes.
- Observable composition, entity-change cancellation, and subscription cleanup.
- Authorization states.
- DTO rendering and action request shapes.
- Refreshed-state replacement after mutations.
- Loading and translated error presentation.
- No duplicate HTTP calls from multiple template subscriptions.

Build, test, lint, formatting, and type-check scripts become explicit project commands, following the staff Cloud App baseline.

### 13.6 Local parity verification

```text
local Card Cloud App dev server
  -> local Quarkus Card backend
  -> Alma sandbox/test APIs
```

Using safe test patrons and a real Alma Cloud App session, manually verify:

- Allowed and denied institutions/operators.
- Entity filtering, automatic selection, manual selection, and back navigation.
- Patron-not-found and temporary failure states.
- All displayed card-number forms and add/remove behavior.
- All supported block views and actions, including the global comment rule and `08` removal.
- External/institutional wrong-address and wrong-email guidance.
- Preferred-address selection and shared settings-key preservation.
- Sandbox labeling, translations, loading states, and failure recovery.

Optional Alma beta deployment and beta-user testing begin only after automated tests and the local parity checklist are stable. Production replacement is a later release decision, not part of this design.

## 14. Success criteria

Step 1 is ready for later beta testing when:

- The standalone backend runs locally and directly accesses the configured Alma sandbox IZ/NZ APIs.
- All protected endpoints enforce JWT, institution, and backend-owned role authorization.
- All existing supported Card workflows operate through the Card API.
- The browser neither receives Alma credentials nor owns complete Alma patrons or mutation rules.
- Shared registration-platform data contracts are preserved.
- Documented unsafe broad mutations are replaced by exact validated actions.
- The Angular 18 frontend uses typed SDK/RxJS patterns and passes its build, test, lint, format, and type checks.
- Backend unit, authorization, contract, privacy, and error tests pass.
- The local manual parity checklist passes with safe Alma test patrons.
- The currently released production Cloud App and shared proxy remain unchanged.
