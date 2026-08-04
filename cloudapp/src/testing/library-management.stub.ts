import { Observable, of } from 'rxjs';

import { User } from '../app/model/user.model';

export interface LibraryManagementStub {
  readonly user: User;
  readonly isProdEnvironment: boolean;
  getUserObject(): Observable<User>;
  getUserLibraryCardNumbers(): readonly string[];
  getUserMatriculationNumber(): null;
  getUserAddresses(): readonly object[];
}

export function createLibraryManagementStub(): LibraryManagementStub {
  const user = new User({
    full_name: 'Test Patron',
    primary_id: 'test@eduid.ch',
    user_block: [],
    user_identifier: [],
    contact_info: { address: [] },
  });

  return {
    user,
    isProdEnvironment: false,
    getUserObject: (): Observable<User> => of(user),
    getUserLibraryCardNumbers: (): readonly string[] => [],
    getUserMatriculationNumber: (): null => null,
    getUserAddresses: (): readonly object[] => [],
  };
}
