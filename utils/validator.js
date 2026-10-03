/**
 * Pure JavaScript Validation Engine (No external library / No Yup)
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MOBILE_REGEX = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

/**
 * Validates email format.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates password strength:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (@$!%*?&#)
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&#^()_\-+=[\]{};:'",.<>/|\\`~]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

/**
 * Validates mobile number format.
 */
function isValidMobile(mobile) {
  if (!mobile || typeof mobile !== 'string') return false;
  const cleaned = mobile.replace(/[\s\-()]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15 && /^[+0-9]+$/.test(cleaned);
}

/**
 * Validates user registration payload.
 */
function validateRegistration(body) {
  const errors = [];
  const {
    firstName,
    lastName,
    email,
    mobileNumber,
    password,
    confirmPassword,
    currency,
  } = body || {};

  if (!firstName || !firstName.trim()) {
    errors.push('First name is required');
  } else if (firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters');
  }

  if (!lastName || !lastName.trim()) {
    errors.push('Last name is required');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!mobileNumber || !isValidMobile(mobileNumber)) {
    errors.push('A valid mobile number is required (10-15 digits)');
  }

  if (!password) {
    errors.push('Password is required');
  } else if (!isValidPassword(password)) {
    errors.push(
      'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
    );
  }

  if (password !== confirmPassword) {
    errors.push('Password confirmation does not match');
  }

  if (currency && typeof currency === 'string' && currency.length > 5) {
    errors.push('Invalid currency code');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates user login payload.
 */
function validateLogin(body) {
  const errors = [];
  const { email, password } = body || {};

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required');
  }

  if (!password || !password.trim()) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates change password payload.
 */
function validatePasswordChange(body) {
  const errors = [];
  const { currentPassword, newPassword, confirmNewPassword } = body || {};

  if (!currentPassword) {
    errors.push('Current password is required');
  }

  if (!newPassword || !isValidPassword(newPassword)) {
    errors.push(
      'New password must be at least 8 characters and contain uppercase, lowercase, number, and special character'
    );
  }

  if (newPassword !== confirmNewPassword) {
    errors.push('New password confirmation does not match');
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push('New password cannot be the same as current password');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidMobile,
  validateRegistration,
  validateLogin,
  validatePasswordChange,
};
