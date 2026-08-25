/** Client-side validation mirroring the FastAPI schemas exactly. */

export const PHONE_REGEX = /^\+?\d{7,15}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value: string): string | undefined {
  return value.trim().length > 0 ? undefined : "This field must not be empty";
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Email is required";
  return EMAIL_REGEX.test(value.trim())
    ? undefined
    : "Enter a valid email address";
}

export function validatePhone(value: string): string | undefined {
  return PHONE_REGEX.test(value.trim())
    ? undefined
    : "7–15 digits, optional + prefix (e.g. +96170123456)";
}

export function validateAge(value: string): string | undefined {
  const age = Number(value);
  if (!Number.isInteger(age)) return "Age must be a whole number";
  if (age < 13 || age > 120) return "Age must be between 13 and 120";
  return undefined;
}

export interface PasswordChecks {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
}

export function passwordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };
}

export function isPasswordValid(checks: PasswordChecks): boolean {
  return Object.values(checks).every(Boolean);
}
