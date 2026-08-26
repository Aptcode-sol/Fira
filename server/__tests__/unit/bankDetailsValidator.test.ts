import { describe, it, expect } from 'vitest';

const bankDetailsValidator = require('../../utils/bankDetailsValidator');

const valid = {
  accountName: 'John Doe',
  accountNumber: '123456789',
  ifscCode: 'SBIN0001234',
  bankName: 'State Bank',
};

describe('bankDetailsValidator.validate (shared trust-boundary validator)', () => {
  it('accepts fully valid details', () => {
    expect(bankDetailsValidator.validate(valid)).toEqual({ isValid: true });
  });

  it('rejects missing account holder name', () => {
    expect(bankDetailsValidator.validate({ ...valid, accountName: '  ' }))
      .toEqual({ isValid: false, error: 'Account holder name is required', field: 'accountName' });
  });

  it('rejects missing bank name', () => {
    expect(bankDetailsValidator.validate({ ...valid, bankName: '' }))
      .toEqual({ isValid: false, error: 'Bank name is required', field: 'bankName' });
  });

  it('rejects IFSC not matching ^[A-Z]{4}0[A-Z0-9]{6}$', () => {
    for (const bad of ['INVALID', 'SBIN1001234', 'sbin0001234', 'SBIN0001', 'SBIN00012345']) {
      expect(bankDetailsValidator.validate({ ...valid, ifscCode: bad }).field).toBe('ifscCode');
    }
  });

  it('rejects account number that is not 9-18 digits', () => {
    for (const bad of ['12345678', '1234567890123456789', '12345ABC9', '']) {
      expect(bankDetailsValidator.validate({ ...valid, accountNumber: bad }).field).toBe('accountNumber');
    }
  });

  it('accepts account numbers at the 9 and 18 digit boundaries', () => {
    expect(bankDetailsValidator.validate({ ...valid, accountNumber: '123456789' }).isValid).toBe(true);
    expect(bankDetailsValidator.validate({ ...valid, accountNumber: '123456789012345678' }).isValid).toBe(true);
  });
});
