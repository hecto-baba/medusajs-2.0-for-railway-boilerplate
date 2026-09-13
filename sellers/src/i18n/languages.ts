/**
 * Selectable languages for the vendor panel.
 *
 * The admin dashboard ships 30+ fully translated languages. Replicating that
 * translated content is not something to fabricate, so this list intentionally
 * has one entry: the mechanism (i18next, the language picker, the translation
 * file structure) is built to admin parity, and further languages are added by
 * dropping a new JSON file here and a display_name below - no code changes.
 */
export const languages: { code: string; display_name: string }[] = [
  { code: "en", display_name: "English" },
]
