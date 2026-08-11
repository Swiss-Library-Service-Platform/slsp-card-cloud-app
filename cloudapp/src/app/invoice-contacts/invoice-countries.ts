const ALPHA2_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );
const ALPHA3_CODES =
  'AND ARE AFG ATG AIA ALB ARM AGO ATA ARG ASM AUT AUS ABW ALA AZE BIH BRB BGD BEL BFA BGR BHR BDI BEN BLM BMU BRN BOL BES BRA BHS BTN BVT BWA BLR BLZ CAN CCK COD CAF COG CHE CIV COK CHL CMR CHN COL CRI CUB CPV CUW CXR CYP CZE DEU DJI DNK DMA DOM DZA ECU EST EGY ESH ERI ESP ETH FIN FJI FLK FSM FRO FRA GAB GBR GRD GEO GUF GGY GHA GIB GRL GMB GIN GLP GNQ GRC SGS GTM GUM GNB GUY HKG HMD HND HRV HTI HUN IDN IRL ISR IMN IND IOT IRQ IRN ISL ITA JEY JAM JOR JPN KEN KGZ KHM KIR COM KNA PRK KOR KWT CYM KAZ LAO LBN LCA LIE LKA LBR LSO LTU LUX LVA LBY MAR MCO MDA MNE MAF MDG MHL MKD MLI MMR MNG MAC MNP MTQ MRT MSR MLT MUS MDV MWI MEX MYS MOZ NAM NCL NER NFK NGA NIC NLD NOR NPL NRU NIU NZL OMN PAN PER PYF PNG PHL PAK POL SPM PCN PRI PSE PRT PLW PRY QAT REU ROU SRB RUS RWA SAU SLB SYC SDN SWE SGP SHN SVN SJM SVK SLE SMR SEN SOM SUR SSD STP SLV SXM SYR SWZ TCA TCD ATF TGO THA TJK TKL TLS TKM TUN TON TUR TTO TUV TWN TZA UKR UGA UMI USA URY UZB VAT VCT VEN VGB VIR VNM VUT WLF WSM YEM MYT ZAF ZMB ZWE'.split(
    ' ',
  );
const PRIORITY_CODES = ['CHE', 'DEU', 'AUT', 'LIE', 'ITA', 'FRA'] as const;

interface InvoiceCountry {
  readonly alpha2: string;
  readonly alpha3: string;
}

export interface InvoiceCountryOption {
  readonly code: string;
  readonly label: string;
}

export type InvoiceCountryLabelResolver = (
  alpha2Code: string,
  locale: string,
) => string | undefined;

const COUNTRIES: readonly InvoiceCountry[] = ALPHA2_CODES.map(
  (alpha2, index) => ({ alpha2, alpha3: ALPHA3_CODES[index] }),
);
const SUPPORTED_CODES = new Set(ALPHA3_CODES);

export function isSupportedInvoiceCountry(code: string): boolean {
  return SUPPORTED_CODES.has(code);
}

export function buildInvoiceCountryOptions(
  locale: string,
  legacyCode?: string | null,
  resolveLabel: InvoiceCountryLabelResolver = localizedCountryLabel,
): readonly InvoiceCountryOption[] {
  const options = COUNTRIES.map(({ alpha2, alpha3 }) => ({
    code: alpha3,
    label: resolveLabel(alpha2, locale) ?? alpha3,
  }));
  const priority = PRIORITY_CODES.flatMap((code) => {
    const option = options.find((candidate) => candidate.code === code);

    return option ? [option] : [];
  });
  const prioritySet = new Set(PRIORITY_CODES);
  const remaining = options
    .filter(
      ({ code }) => !prioritySet.has(code as (typeof PRIORITY_CODES)[number]),
    )
    .sort((left, right) =>
      new Intl.Collator(locale).compare(left.label, right.label),
    );
  const normalizedLegacyCode = legacyCode?.trim().toUpperCase() ?? '';

  if (
    normalizedLegacyCode &&
    !isSupportedInvoiceCountry(normalizedLegacyCode)
  ) {
    return [
      {
        code: normalizedLegacyCode,
        label: normalizedLegacyCode,
      },
      ...priority,
      ...remaining,
    ];
  }

  return [...priority, ...remaining];
}

function localizedCountryLabel(
  alpha2Code: string,
  locale: string,
): string | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(alpha2Code);
  } catch {
    return undefined;
  }
}
