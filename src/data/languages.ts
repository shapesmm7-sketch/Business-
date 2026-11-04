export interface AppLanguage {
  code: string;
  name: string;
  nativeName: string;
  country: string;
  flag: string;
}

/**
 * Supported International Languages for Brivu.
 * Local/regional dialects (like Luganda, Runyankole, etc.) are excluded so that
 * every available language is backed by a full, verified translation dictionary.
 */
export const WORLD_LANGUAGES: AppLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', country: 'United States / UK / Global', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', country: 'Spain, Mexico, Latin America', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', country: 'France, Canada, Francophonie', flag: '🇫🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', country: 'Egypt, Saudi Arabia, UAE, North Africa', flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', country: 'Brazil, Portugal, Angola, Mozambique', flag: '🇧🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', country: 'Germany, Austria, Switzerland', flag: '🇩🇪' },
  { code: 'sw', name: 'Swahili / Kiswahili', nativeName: 'Kiswahili', country: 'Kenya, Tanzania, Uganda, Rwanda, DRC', flag: '🇰🇪' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', country: 'India', flag: '🇮🇳' },
  { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文 (普通话)', country: 'China, Taiwan, Singapore', flag: '🇨🇳' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', country: 'Russia, Kazakhstan, Belarus', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', country: 'Japan', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', country: 'South Korea', flag: '🇰🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', country: 'Italy, Switzerland', flag: '🇮🇹' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', country: 'Indonesia', flag: '🇮🇩' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', country: 'Turkey, Northern Cyprus', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', country: 'Netherlands, Belgium, Suriname', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', country: 'Poland', flag: '🇵🇱' },
  { code: 'tl', name: 'Tagalog / Filipino', nativeName: 'Wikang Tagalog', country: 'Philippines', flag: '🇵🇭' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', country: 'Vietnam', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', country: 'Thailand', flag: '🇹🇭' },
];

export function getLanguageByCode(codeOrName?: string): AppLanguage {
  if (!codeOrName) return WORLD_LANGUAGES[0];
  const q = codeOrName.trim().toLowerCase();
  if (!q) return WORLD_LANGUAGES[0];

  // Exact match by code, name, or nativeName
  const exact = WORLD_LANGUAGES.find(
    (l) =>
      l.code.toLowerCase() === q ||
      l.name.toLowerCase() === q ||
      l.nativeName.toLowerCase() === q
  );
  if (exact) return exact;

  // Partial match fallback
  const found = WORLD_LANGUAGES.find((l) => {
    const lCode = l.code.toLowerCase();
    const lName = l.name.toLowerCase();
    const lNative = l.nativeName.toLowerCase();

    return (
      lCode === q ||
      lName === q ||
      lNative === q ||
      lName.includes(q) ||
      q.includes(lName) ||
      q.includes(lCode) ||
      lNative.includes(q)
    );
  });

  return found || WORLD_LANGUAGES[0];
}
