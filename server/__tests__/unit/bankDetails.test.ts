import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the User model
vi.mock('../../models/User', () => {
  const mockFindByIdAndUpdate = vi.fn();
  return {
    default: { findByIdAndUpdate: mockFindByIdAndUpdate },
    __esModule: true,
  };
});

// We need to use require since the service uses require
const User = require('../../models/User');
const userService = require('../../services/userService');

describe('userService.updateBankDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty accountName', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: '',
      accountNumber: '123456789',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ error: 'Account holder name is required', field: 'accountName' });
  });

  it('rejects empty bankName', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: '123456789',
      ifscCode: 'SBIN0001234',
      bankName: '',
    });
    expect(result).toEqual({ error: 'Bank name is required', field: 'bankName' });
  });

  it('rejects invalid IFSC format', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: '123456789',
      ifscCode: 'INVALID',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ error: 'Invalid IFSC code format', field: 'ifscCode' });
  });

  it('rejects IFSC missing the 0 at 5th position', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: '123456789',
      ifscCode: 'SBIN1001234',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ error: 'Invalid IFSC code format', field: 'ifscCode' });
  });

  it('rejects account number with letters', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: '12345ABC9',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ error: 'Account number must be 9-18 digits', field: 'accountNumber' });
  });

  it('rejects account number shorter than 9 digits', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: '12345678',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ error: 'Account number must be 9-18 digits', field: 'accountNumber' });
  });

  it('rejects account number longer than 18 digits', async () => {
    const result = await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: '1234567890123456789',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ error: 'Account number must be 9-18 digits', field: 'accountNumber' });
  });

  it('updates bank details on valid input', async () => {
    const mockUser = {
      bankDetails: { accountName: 'John Doe', accountNumber: '123456789', ifscCode: 'SBIN0001234', bankName: 'State Bank' },
    };
    User.findByIdAndUpdate = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue(mockUser) });

    const result = await userService.updateBankDetails('user1', {
      accountName: 'John Doe',
      accountNumber: '123456789',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank',
    });
    expect(result).toEqual({ success: true, bankDetails: mockUser.bankDetails });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user1',
      { $set: { bankDetails: { accountName: 'John Doe', accountNumber: '123456789', ifscCode: 'SBIN0001234', bankName: 'State Bank' } } },
      { new: true }
    );
  });

  it('does not call DB on validation failure', async () => {
    User.findByIdAndUpdate = vi.fn();

    await userService.updateBankDetails('user1', {
      accountName: 'John',
      accountNumber: 'bad',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank',
    });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
