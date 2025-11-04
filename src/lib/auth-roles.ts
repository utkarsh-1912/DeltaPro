
export type UserRole = 'admin' | 'hr' | 'pm' | 'user';

// ---CONFIGURATION---
// Add email addresses to the appropriate roles.
const ADMIN_EMAILS: string[] = ['admin@example.com', 'admin@rotapro.com'];
const HR_EMAILS: string[] = ['hr@example.com', 'hr@rotapro.com'];
const PM_EMAILS: string[] = ['pm@example.com', 'pm@rotapro.com'];
// ---END CONFIGURATION---

/**
 * Determines a user's role based on their email address.
 * @param email The user's email address.
 * @returns The determined UserRole.
 */
export function getUserRole(email: string): UserRole {
  const normalizedEmail = email.toLowerCase();

  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    return 'admin';
  }
  if (HR_EMAILS.includes(normalizedEmail)) {
    return 'hr';
  }
  if (PM_EMAILS.includes(normalizedEmail)) {
    return 'pm';
  }
  return 'user';
}
