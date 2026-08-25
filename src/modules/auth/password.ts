import { compare, hash } from "bcryptjs";
export const MIN_PASSWORD_LENGTH = 10;
export const passwordError = `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
export const passwordConfirmationRequiredError = "Bitte wiederholen Sie das Passwort.";
export const passwordMismatchError = "Die Passwörter stimmen nicht überein.";
export const validatePassword = (password: string) => password.length >= MIN_PASSWORD_LENGTH;
export function validateNewPassword(password: string, confirmation: string) {
  if (!validatePassword(password)) return { password: passwordError };
  if (!confirmation) return { passwordConfirmation: passwordConfirmationRequiredError };
  if (password !== confirmation) return { passwordConfirmation: passwordMismatchError };
  return {};
}
export const hashPassword = (password: string) => hash(password, 12);
export const verifyPassword = (password: string, passwordHash: string) => compare(password, passwordHash);
