// Per-firm hand-curated keyword lists. Supersedes the generic
// LAW_FIRM_KEYWORD_TEMPLATES in keywordTemplates.ts when a firm has a
// known strategy. Generic templates remain the fallback for new firms or
// when the SEO team hasn't drafted a custom list yet.
//
// Keyed by clients.firm_name (exact match). For multi-location firms,
// set `location_label` to attach a keyword to a specific client_location;
// omit it to attach to the primary location.

export type StrategicKeyword = {
  keyword: string
  search_type: 'organic' | 'local_pack' | 'maps' | 'ai_mode'
  priority: 'low' | 'medium' | 'high'
  /** Match a specific client_locations.label. Omit for the primary location. */
  location_label?: string
}

export const STRATEGIC_KEYWORD_TEMPLATES: Record<string, StrategicKeyword[]> = {
  'Dooley Noted': [
    { keyword: 'probate lawyer austin tx',            search_type: 'organic', priority: 'high' },
    { keyword: 'probate attorney austin',             search_type: 'organic', priority: 'high' },
    { keyword: 'estate attorney austin tx',           search_type: 'organic', priority: 'high' },
    { keyword: 'will contest lawyer austin',          search_type: 'organic', priority: 'high' },
    { keyword: 'contested probate attorney austin',   search_type: 'organic', priority: 'high' },
    { keyword: 'probate court attorney austin',       search_type: 'organic', priority: 'medium' },
    { keyword: 'estate planning lawyer austin',       search_type: 'organic', priority: 'medium' },
    { keyword: 'probate lawyer round rock tx',        search_type: 'organic', priority: 'medium' },
    { keyword: 'probate lawyer cedar park tx',        search_type: 'organic', priority: 'medium' },
    { keyword: 'immigration lawyer austin tx',        search_type: 'organic', priority: 'low' },
  ],

  'Reiersen Law': [
    { keyword: 'personal injury lawyer kennewick wa', search_type: 'organic', priority: 'high' },
    { keyword: 'car accident attorney kennewick wa',  search_type: 'organic', priority: 'high' },
    { keyword: 'personal injury lawyer pasco wa',     search_type: 'organic', priority: 'high' },
    { keyword: 'car accident lawyer richland wa',     search_type: 'organic', priority: 'high' },
    { keyword: 'truck accident lawyer tri cities wa', search_type: 'organic', priority: 'medium' },
    { keyword: 'motorcycle accident attorney kennewick', search_type: 'organic', priority: 'medium' },
    { keyword: 'wrongful death lawyer kennewick wa',  search_type: 'organic', priority: 'medium' },
    { keyword: 'injury attorney near me kennewick',   search_type: 'organic', priority: 'medium' },
    { keyword: 'best personal injury lawyer tri cities', search_type: 'organic', priority: 'medium' },
  ],

  'Movahedi Law': [
    { keyword: 'immigration lawyer washington dc',    search_type: 'organic', priority: 'high' },
    { keyword: 'immigration attorney dc',             search_type: 'organic', priority: 'high' },
    { keyword: 'deportation defense lawyer dc',       search_type: 'organic', priority: 'high' },
    { keyword: 'asylum lawyer washington dc',         search_type: 'organic', priority: 'high' },
    { keyword: 'green card lawyer dc',                search_type: 'organic', priority: 'high' },
    { keyword: 'visa lawyer washington dc',           search_type: 'organic', priority: 'medium' },
    { keyword: 'h1b visa attorney dc',                search_type: 'organic', priority: 'medium' },
    { keyword: 'family immigration lawyer dc',        search_type: 'organic', priority: 'medium' },
    { keyword: 'immigration lawyer near me dc',       search_type: 'organic', priority: 'medium' },
  ],

  'Olson Law Office PC': [
    { keyword: 'criminal defense attorney great falls mt', search_type: 'organic', priority: 'high' },
    { keyword: 'dui lawyer great falls mt',           search_type: 'organic', priority: 'high' },
    { keyword: 'drug crime attorney great falls',     search_type: 'organic', priority: 'high' },
    { keyword: 'criminal lawyer great falls montana', search_type: 'organic', priority: 'high' },
    { keyword: 'felony defense lawyer great falls',   search_type: 'organic', priority: 'medium' },
    { keyword: 'assault charges attorney great falls', search_type: 'organic', priority: 'medium' },
    { keyword: 'domestic violence lawyer great falls mt', search_type: 'organic', priority: 'medium' },
    { keyword: 'best criminal defense lawyer great falls', search_type: 'organic', priority: 'medium' },
  ],

  'Daniels Law PA': [
    { keyword: 'divorce lawyer fort myers fl',        search_type: 'organic', priority: 'high' },
    { keyword: 'divorce attorney fort myers',         search_type: 'organic', priority: 'high' },
    { keyword: 'family law attorney fort myers',      search_type: 'organic', priority: 'high' },
    { keyword: 'child custody lawyer fort myers',     search_type: 'organic', priority: 'high' },
    { keyword: 'child support attorney fort myers',   search_type: 'organic', priority: 'medium' },
    { keyword: 'alimony lawyer fort myers fl',        search_type: 'organic', priority: 'medium' },
    { keyword: 'contested divorce lawyer fort myers', search_type: 'organic', priority: 'medium' },
    { keyword: 'high asset divorce attorney fort myers', search_type: 'organic', priority: 'medium' },
    { keyword: 'divorce attorney near me fort myers', search_type: 'organic', priority: 'medium' },
  ],

  'Gilliam Law': [
    // Chicago HQ
    { keyword: 'immigration lawyer chicago il',        search_type: 'organic', priority: 'high',   location_label: 'Chicago HQ' },
    { keyword: 'immigration attorney chicago',         search_type: 'organic', priority: 'high',   location_label: 'Chicago HQ' },
    { keyword: 'deportation defense lawyer chicago',   search_type: 'organic', priority: 'high',   location_label: 'Chicago HQ' },
    { keyword: 'asylum lawyer chicago il',             search_type: 'organic', priority: 'high',   location_label: 'Chicago HQ' },
    { keyword: 'green card lawyer chicago',            search_type: 'organic', priority: 'high',   location_label: 'Chicago HQ' },
    { keyword: 'visa lawyer chicago il',               search_type: 'organic', priority: 'medium', location_label: 'Chicago HQ' },
    { keyword: 'family immigration lawyer chicago',    search_type: 'organic', priority: 'medium', location_label: 'Chicago HQ' },
    { keyword: 'citizenship lawyer chicago il',        search_type: 'organic', priority: 'medium', location_label: 'Chicago HQ' },
    { keyword: 'immigration lawyer near me chicago',   search_type: 'organic', priority: 'medium', location_label: 'Chicago HQ' },
    // Tennessee Satellite (Nashville)
    { keyword: 'immigration lawyer nashville tn',      search_type: 'organic', priority: 'high',   location_label: 'Tennessee Satellite' },
    { keyword: 'immigration attorney nashville',       search_type: 'organic', priority: 'high',   location_label: 'Tennessee Satellite' },
    { keyword: 'deportation defense lawyer nashville', search_type: 'organic', priority: 'high',   location_label: 'Tennessee Satellite' },
    { keyword: 'asylum lawyer nashville tn',           search_type: 'organic', priority: 'high',   location_label: 'Tennessee Satellite' },
    { keyword: 'green card lawyer nashville',          search_type: 'organic', priority: 'high',   location_label: 'Tennessee Satellite' },
    { keyword: 'visa lawyer nashville tn',             search_type: 'organic', priority: 'medium', location_label: 'Tennessee Satellite' },
    { keyword: 'family immigration lawyer nashville',  search_type: 'organic', priority: 'medium', location_label: 'Tennessee Satellite' },
    { keyword: 'citizenship lawyer nashville tn',      search_type: 'organic', priority: 'medium', location_label: 'Tennessee Satellite' },
    { keyword: 'immigration lawyer near me nashville', search_type: 'organic', priority: 'medium', location_label: 'Tennessee Satellite' },
  ],
}
