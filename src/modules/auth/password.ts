import { compare, hash } from "bcryptjs";
export const MIN_PASSWORD_LENGTH = 10;
export const passwordError = `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
export const validatePassword = (password: string) => password.length >= MIN_PASSWORD_LENGTH;
export const hashPassword = (password: string) => hash(password, 12);
export const verifyPassword = (password: string, passwordHash: string) => compare(password, passwordHash);
