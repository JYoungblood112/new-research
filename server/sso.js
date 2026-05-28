const CMU_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@andrew\.cmu\.edu$/i;

export function validateCmuEmail(email) {
  return CMU_EMAIL_REGEX.test(email ?? '');
}
