// Law-firm keyword templates per practice area. Used by the admin seeding UI
// to one-click bulk-add a sensible starter set.
//
// {city} is replaced at expansion time. "near me" templates are kept verbatim
// (Google personalizes those by user location, so leaving them as-is is correct).

export type PracticeArea =
  | 'personal_injury'
  | 'family_law'
  | 'criminal_defense'
  | 'immigration'
  | 'estate_planning'
  | 'employment_law'

export const PRACTICE_AREA_LABELS: Record<PracticeArea, string> = {
  personal_injury: 'Personal Injury',
  family_law: 'Family Law',
  criminal_defense: 'Criminal Defense',
  immigration: 'Immigration',
  estate_planning: 'Estate Planning',
  employment_law: 'Employment Law',
}

export const LAW_FIRM_KEYWORD_TEMPLATES: Record<PracticeArea, string[]> = {
  personal_injury: [
    'personal injury lawyer {city}',
    'personal injury attorney {city}',
    'car accident lawyer {city}',
    'car accident attorney {city}',
    'truck accident lawyer {city}',
    'motorcycle accident lawyer {city}',
    'slip and fall lawyer {city}',
    'wrongful death attorney {city}',
    'best personal injury lawyer near me',
    'injury attorney near me',
  ],
  family_law: [
    'divorce lawyer {city}',
    'family law attorney {city}',
    'child custody lawyer {city}',
    'divorce attorney near me',
    'custody attorney near me',
  ],
  criminal_defense: [
    'criminal defense attorney {city}',
    'dui lawyer {city}',
    'domestic violence lawyer {city}',
    'criminal lawyer near me',
    'dui attorney near me',
  ],
  immigration: [
    'immigration lawyer {city}',
    'green card lawyer {city}',
    'deportation defense lawyer {city}',
    'immigration attorney near me',
  ],
  estate_planning: [
    'estate planning attorney {city}',
    'trust lawyer {city}',
    'probate attorney {city}',
    'will and trust attorney near me',
  ],
  employment_law: [
    'employment lawyer {city}',
    'wrongful termination attorney {city}',
    'workplace discrimination lawyer {city}',
    'employment attorney near me',
  ],
}

export function expandKeywordTemplates(
  practiceArea: PracticeArea,
  city: string
): string[] {
  const templates = LAW_FIRM_KEYWORD_TEMPLATES[practiceArea] ?? []
  const safeCity = city.trim()
  return templates.map((t) => t.replace('{city}', safeCity))
}
