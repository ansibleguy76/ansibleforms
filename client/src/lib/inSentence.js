// A label as it reads inside a sentence : "Add repository", "Edit mail server", not "Add
// Repository". Its first letter is lowered, unless the first word is an acronym (SSO provider,
// LDAP, SSH key) or the language capitalizes its nouns (German) ; a language without capitals
// (Japanese, Chinese) is left as it is by the same rule.

// the languages whose nouns keep their capital inside a sentence
const NOUNS_CAPITALIZED = ['de'];

/**
 * A label lowered for the middle of a sentence.
 *
 * Args:
 *   label (string): the label, as a title shows it (Repository).
 *   locale (string): the language it is shown in.
 *
 * Returns:
 *   string: the label in a sentence (repository).
 */
export function inSentence(label, locale = 'en') {
  if (!label || NOUNS_CAPITALIZED.includes(String(locale).slice(0, 2))) return label || '';
  const first = label.split(/\s+/)[0];
  // a capital, then lower case letters only : a word, not an acronym (SSO) nor a name (OAuth2)
  if (!/^\p{Lu}\p{Ll}*$/u.test(first)) return label;
  return label.charAt(0).toLocaleLowerCase(locale) + label.slice(1);
}
