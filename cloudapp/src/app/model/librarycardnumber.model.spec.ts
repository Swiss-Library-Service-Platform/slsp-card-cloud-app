import { Librarycardnumber } from './librarycardnumber.model';

describe('Librarycardnumer', () => {
  it('should create an instance', () => {
    expect(new Librarycardnumber()).toBeTruthy();
  });

  ['E1207001', 'E1208000', 'E1209000', 'E1210001', 'E1211000', 'E1212329', 'e1207001', 'E-1209000', 'e-1210001', 'e-1212329'].forEach(value => {
    it(`blocks ${value} (SUPPORT-43463)`, () => {
      expect(Librarycardnumber.isBlockedLibraryCardNumber(value)).toBe(true);
      expect(Librarycardnumber.isValidLibraryCardNumber(value)).toBe(false);
    });
  });

  ['E1206001', 'E1207000', 'E1209001', 'E1209500', 'E1210000', 'E1212330', 'E-1207000', 'e-1209001', 'e-1210000', 'e-1212330', 'SLSP123456789', 'A1207001'].forEach(value => {
    it(`continues accepting ${value}`, () => {
      expect(Librarycardnumber.isBlockedLibraryCardNumber(value)).toBe(false);
      expect(Librarycardnumber.isValidLibraryCardNumber(value)).toBe(true);
    });
  });

  ['', null, 'invalid!', '110012345'].forEach(value => {
    it(`keeps the existing format rejection for ${value}`, () => {
      expect(Librarycardnumber.isBlockedLibraryCardNumber(value)).toBe(false);
      expect(Librarycardnumber.isValidLibraryCardNumber(value)).toBe(false);
    });
  });

  it('keeps existing blocked cards removable under the usual rules', () => {
    expect(Librarycardnumber.isRemovable({ value: 'E1207001', id_type: { value: '02' } })).toBe(true);
    expect(Librarycardnumber.isRemovable({
      value: 'E1207001', id_type: { value: '02' }, note: 'Added via edu-ID'
    })).toBe(false);
  });
});
