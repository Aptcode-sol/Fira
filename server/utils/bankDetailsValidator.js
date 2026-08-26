/**
 * Bank Details Validator Utility
 * Server-side trust-boundary validation for User.bankDetails before persist.
 * Rules (per platform-flow-fixes Flow 5):
 *   - IFSC: exactly 11 chars matching ^[A-Z]{4}0[A-Z0-9]{6}$
 *   - Account number: digits only, length 9-18 (^[0-9]{9,18}$)
 *   - Account holder name and bank name required (non-empty)
 * Encryption of stored details is owned by `industry-standard-upgrade`, not here.
 */

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^[0-9]{9,18}$/;

const bankDetailsValidator = {
  IFSC_REGEX,
  ACCOUNT_NUMBER_REGEX,

  /**
   * Validate bank details at the trust boundary.
   * @param {Object} details - { accountName, accountNumber, ifscCode, bankName }
   * @returns {Object} - { isValid: boolean, error?: string, field?: string }
   *   Returns the first failure as an { error, field } pair to match the
   *   existing field-level error style used by the bank-details route.
   */
  validate(details = {}) {
    const { accountName, accountNumber, ifscCode, bankName } = details;

    if (!accountName || !accountName.trim()) {
      return { isValid: false, error: 'Account holder name is required', field: 'accountName' };
    }
    if (!bankName || !bankName.trim()) {
      return { isValid: false, error: 'Bank name is required', field: 'bankName' };
    }
    if (!IFSC_REGEX.test(ifscCode)) {
      return { isValid: false, error: 'Invalid IFSC code format', field: 'ifscCode' };
    }
    if (!ACCOUNT_NUMBER_REGEX.test(accountNumber)) {
      return { isValid: false, error: 'Account number must be 9-18 digits', field: 'accountNumber' };
    }

    return { isValid: true };
  }
};

module.exports = bankDetailsValidator;
