import { HttpsError } from 'firebase-functions/v2/https';

export interface ActivityRequirements {
  gender?: ('male' | 'female' | 'diverse')[];
  requireProfilePicture?: boolean;
  requireVerification?: boolean;
  minimumRating?: number;
  ageRange?: { min?: number; max?: number };
}

/**
 * Calculates user's current age in years given a date of birth.
 */
export function calculateAgeFromBirthdate(birthdateInput: any, nowMs = Date.now()): number | null {
  if (!birthdateInput) return null;

  let dobDate: Date | null = null;
  if (birthdateInput instanceof Date) {
    dobDate = birthdateInput;
  } else if (typeof birthdateInput === 'string' || typeof birthdateInput === 'number') {
    const parsed = new Date(birthdateInput);
    if (!isNaN(parsed.getTime())) {
      dobDate = parsed;
    }
  } else if (typeof birthdateInput === 'object' && typeof birthdateInput.toDate === 'function') {
    dobDate = birthdateInput.toDate();
  } else if (typeof birthdateInput === 'object' && typeof birthdateInput.seconds === 'number') {
    dobDate = new Date(birthdateInput.seconds * 1000);
  }

  if (!dobDate || isNaN(dobDate.getTime())) {
    return null;
  }

  const now = new Date(nowMs);
  let age = now.getFullYear() - dobDate.getFullYear();
  const monthDiff = now.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dobDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Derives canonical user age:
 * 1. Valid server-stored birthday (or dateOfBirth / birthDate) -> calculate age relative to current date.
 * 2. Otherwise valid numeric age.
 * 3. Returns null if missing or invalid.
 */
export function getUserAge(userProfile: any, nowMs = Date.now()): number | null {
  if (!userProfile) return null;

  // 1. Birthday / Date of birth check
  const dobInput = userProfile.birthday || userProfile.dateOfBirth || userProfile.birthDate || userProfile.dob;
  if (dobInput) {
    const calculatedAge = calculateAgeFromBirthdate(dobInput, nowMs);
    if (calculatedAge !== null) {
      return calculatedAge;
    }
  }

  // 2. Numeric age field check
  if (typeof userProfile.age === 'number' && !isNaN(userProfile.age) && userProfile.age > 0) {
    return Math.floor(userProfile.age);
  }

  return null;
}

/**
 * Evaluates whether a user meets activity requirements.
 * Throws HttpsError('permission-denied', ...) if any requirement fails or if age evaluation is fail-closed.
 */
export function validateUserRequirements(
  userProfile: any,
  requirements?: ActivityRequirements | null,
  nowMs = Date.now()
): void {
  if (!requirements) return;

  // 1. Profile picture requirement
  if (requirements.requireProfilePicture && (!userProfile?.photoURL || typeof userProfile.photoURL !== 'string' || !userProfile.photoURL.trim())) {
    throw new HttpsError('permission-denied', 'Ein verifiziertes Profilbild ist für diese Aktivität erforderlich.');
  }

  // 2. Verification requirement
  if (requirements.requireVerification && userProfile?.kycStatus !== 'verified') {
    throw new HttpsError('permission-denied', 'Eine verifizierte Identität ist für diese Aktivität erforderlich.');
  }

  // 3. Minimum rating requirement
  if (typeof requirements.minimumRating === 'number' && requirements.minimumRating > 0) {
    const userRating = typeof userProfile?.averageRating === 'number' ? userProfile.averageRating : 0;
    if (userRating < requirements.minimumRating) {
      throw new HttpsError('permission-denied', 'Deine durchschnittliche Bewertung erfüllt nicht die Mindestanforderung.');
    }
  }

  // 4. Gender requirement
  if (Array.isArray(requirements.gender) && requirements.gender.length > 0) {
    const userGender = (userProfile?.gender || '').toString().toLowerCase().trim();
    const allowedGenders = requirements.gender.map((g) => (g || '').toString().toLowerCase().trim());
    if (!userGender || !allowedGenders.includes(userGender)) {
      throw new HttpsError('permission-denied', 'Dein Profilgeschlecht erfüllt nicht die verlangte Geschlechtsanforderung.');
    }
  }

  // 5. Age range requirement (FAIL-CLOSED)
  const minAge = typeof requirements.ageRange?.min === 'number' ? requirements.ageRange.min : null;
  const maxAge = typeof requirements.ageRange?.max === 'number' ? requirements.ageRange.max : null;

  if (minAge !== null || maxAge !== null) {
    const userAge = getUserAge(userProfile, nowMs);
    if (userAge === null) {
      throw new HttpsError('permission-denied', 'Ein gültiges Geburtsdatum oder Alter ist für Aktivitäten mit Altersbeschränkung erforderlich.');
    }

    if (minAge !== null && userAge < minAge) {
      throw new HttpsError('permission-denied', `Du erfüllst das Mindestalter von ${minAge} Jahren nicht.`);
    }

    if (maxAge !== null && userAge > maxAge) {
      throw new HttpsError('permission-denied', `Du überschreitest das Maximalalter von ${maxAge} Jahren.`);
    }
  }
}
