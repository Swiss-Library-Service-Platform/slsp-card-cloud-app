import { LibraryManagementService } from './library-management.service';
import { User } from '../model/user.model';

describe('LibraryCardServiceService', () => {
  let service: LibraryManagementService;

  beforeEach(() => {
    service = new LibraryManagementService(null, null, null, null, null);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  ['E1207001', 'E1209000', 'E1210001', 'E1212329', 'e-1207001', 'e-1210001'].forEach(value => {
    it(`rejects ${value} before changing the user or calling the API`, async () => {
      service.user = new User({ user_identifier: [] });
      const add = spyOn(service.user, 'addLibraryCardNumber').and.callThrough();
      const update = spyOn(service, 'updateUser');

      expect(await service.addUserLibraryCardNumber(value)).toBe(false);
      expect(add).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(service.user.userValue['user_identifier']).toEqual([]);
    });
  });

  it('continues adding a barcode in the gap between blocked ranges', async () => {
    (service as any).initData = { user: { primaryId: 'test-operator' }, instCode: 'test-institution' };
    service.user = new User({ user_identifier: [] });
    const update = spyOn(service, 'updateUser').and.returnValue(Promise.resolve(true));

    expect(await service.addUserLibraryCardNumber('E1209500')).toBe(true);
    expect(service.user.userValue['user_identifier'][0].value).toBe('e1209500');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
