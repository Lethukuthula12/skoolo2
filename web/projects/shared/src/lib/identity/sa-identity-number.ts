import type { AbstractControl, ValidationErrors } from '@angular/forms';
import type { Gender } from '../models';

/** Mirrors public.is_valid_sa_identity_number in the database: 13 digits, YYMMDD, Luhn. */
export function isValidSaIdentityNumber(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  let sum = 0;
  for (let index = 0; index < 13; index++) {
    let digit = Number(value[index]);
    if ((index + 1) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** ISO date (yyyy-mm-dd) encoded in a valid ID number, assuming the holder is under 100. */
export function dateOfBirthFromIdentityNumber(value: string, today: Date = new Date()): string | null {
  if (!isValidSaIdentityNumber(value)) return null;
  const yy = Number(value.slice(0, 2));
  const currentYy = today.getFullYear() % 100;
  const year = yy <= currentYy ? 2000 + yy : 1900 + yy;
  return `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

export function genderFromIdentityNumber(value: string): Gender | null {
  if (!isValidSaIdentityNumber(value)) return null;
  return Number(value.slice(6, 10)) >= 5000 ? 'male' : 'female';
}

export function saIdentityNumberValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  return isValidSaIdentityNumber(value) ? null : { saIdentityNumber: true };
}
