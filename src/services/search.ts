import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  defineSetting,
  getSetting,
  setSetting
} from "@/services/settings/registry"

const TOTAL_SEARCH_RESULTS = 2
const DEFAULT_PROVIDER = "duckduckgo"

const AVAILABLE_PROVIDERS = ["google", "duckduckgo"] as const

type SearchProvider = (typeof AVAILABLE_PROVIDERS)[number]

const SIMPLE_SEARCH_SETTING = defineSetting(
  "isSimpleInternetSearch",
  true,
  (value) => coerceBoolean(value, true)
)

const VISIT_SPECIFIC_SITE_SETTING = defineSetting(
  "isVisitSpecificWebsite",
  true,
  (value) => coerceBoolean(value, true)
)

const SEARCH_PROVIDER_SETTING = defineSetting(
  "searchProvider",
  DEFAULT_PROVIDER as SearchProvider,
  (value) => {
    const normalized = String(value || "").toLowerCase()
    return AVAILABLE_PROVIDERS.includes(normalized as SearchProvider)
      ? (normalized as SearchProvider)
      : (DEFAULT_PROVIDER as SearchProvider)
  }
)

const TOTAL_SEARCH_RESULTS_SETTING = defineSetting(
  "totalSearchResults",
  TOTAL_SEARCH_RESULTS,
  (value) => {
    const coerced = coerceNumber(value, TOTAL_SEARCH_RESULTS)
    return coerced > 0 ? coerced : TOTAL_SEARCH_RESULTS
  }
)

const SEARXNG_URL_SETTING = defineSetting(
  "searxngURL",
  "",
  (value) => coerceString(value, "")
)

const SEARXNG_JSON_MODE_SETTING = defineSetting(
  "searxngJSONMode",
  false,
  (value) => coerceBoolean(value, false)
)

const BRAVE_API_KEY_SETTING = defineSetting(
  "braveApiKey",
  "",
  (value) => coerceString(value, "")
)

const TAVILY_API_KEY_SETTING = defineSetting(
  "tavilyApiKey",
  "",
  (value) => coerceString(value, "")
)

const FIRECRAWL_API_KEY_SETTING = defineSetting(
  "firecrawlAPIKey",
  "",
  (value) => coerceString(value, "")
)

const EXA_API_KEY_SETTING = defineSetting(
  "exaAPIKey",
  "",
  (value) => coerceString(value, "")
)

const GOOGLE_DOMAIN_SETTING = defineSetting(
  "searchGoogleDomain",
  "google.com",
  (value) => coerceString(value, "google.com")
)

const DEFAULT_INTERNET_SEARCH_ON_SETTING = defineSetting(
  "defaultInternetSearchOn",
  false,
  (value) => coerceBoolean(value, false)
)

export const getIsSimpleInternetSearch = async () => {
  return await getSetting(SIMPLE_SEARCH_SETTING)
}

export const getIsVisitSpecificWebsite = async () => {
  return await getSetting(VISIT_SPECIFIC_SITE_SETTING)
}

export const setIsVisitSpecificWebsite = async (
  isVisitSpecificWebsite: boolean
) => {
  await setSetting(VISIT_SPECIFIC_SITE_SETTING, isVisitSpecificWebsite)
}

export const setIsSimpleInternetSearch = async (
  isSimpleInternetSearch: boolean
) => {
  await setSetting(SIMPLE_SEARCH_SETTING, isSimpleInternetSearch)
}

export const getSearchProvider = async (): Promise<SearchProvider> =>
  await getSetting(SEARCH_PROVIDER_SETTING)

export const setSearchProvider = async (searchProvider: string) => {
  await setSetting(SEARCH_PROVIDER_SETTING, searchProvider as SearchProvider)
}

export const totalSearchResults = async () => {
  return await getSetting(TOTAL_SEARCH_RESULTS_SETTING)
}

export const setTotalSearchResults = async (totalSearchResults: number) => {
  await setSetting(TOTAL_SEARCH_RESULTS_SETTING, totalSearchResults)
}

export const getSearxngURL = async () => {
  return await getSetting(SEARXNG_URL_SETTING)
}

export const isSearxngJSONMode = async () => {
  return await getSetting(SEARXNG_JSON_MODE_SETTING)
}

export const setSearxngJSONMode = async (searxngJSONMode: boolean) => {
  await setSetting(SEARXNG_JSON_MODE_SETTING, searxngJSONMode)
}

export const setSearxngURL = async (searxngURL: string) => {
  await setSetting(SEARXNG_URL_SETTING, searxngURL)
}

export const getBraveApiKey = async () => {
  return await getSetting(BRAVE_API_KEY_SETTING)
}

export const getTavilyApiKey = async () => {
  return await getSetting(TAVILY_API_KEY_SETTING)
}

export const getFirecrawlAPIKey = async () => {
  return await getSetting(FIRECRAWL_API_KEY_SETTING)
}

export const setBraveApiKey = async (braveApiKey: string) => {
  await setSetting(BRAVE_API_KEY_SETTING, braveApiKey)
}

export const setFirecrawlAPIKey = async (firecrawlAPIKey: string) => {
  await setSetting(FIRECRAWL_API_KEY_SETTING, firecrawlAPIKey)
}

export const getExaAPIKey = async () => {
  return await getSetting(EXA_API_KEY_SETTING)
}

export const setExaAPIKey = async (exaAPIKey: string) => {
  await setSetting(EXA_API_KEY_SETTING, exaAPIKey)
}

export const setTavilyApiKey = async (tavilyApiKey: string) => {
  await setSetting(TAVILY_API_KEY_SETTING, tavilyApiKey)
}

export const getGoogleDomain = async () => {
  return await getSetting(GOOGLE_DOMAIN_SETTING)
}

export const setGoogleDomain = async (domain: string) => {
  await setSetting(GOOGLE_DOMAIN_SETTING, domain)
}

export const getInternetSearchOn = async () => {
  return await getSetting(DEFAULT_INTERNET_SEARCH_ON_SETTING)
}

export const setInternetSearchOn = async (defaultInternetSearchOn: boolean) => {
  await setSetting(DEFAULT_INTERNET_SEARCH_ON_SETTING, defaultInternetSearchOn)
}

export const getSearchSettings = async () => {
  const [
    isSimpleInternetSearch,
    searchProvider,
    totalSearchResult,
    visitSpecificWebsite,
    searxngURL,
    searxngJSONMode,
    braveApiKey,
    tavilyApiKey,
    googleDomain,
    defaultInternetSearchOn,
    exaAPIKey,
    firecrawlAPIKey
  ] = await Promise.all([
    getIsSimpleInternetSearch(),
    getSearchProvider(),
    totalSearchResults(),
    getIsVisitSpecificWebsite(),
    getSearxngURL(),
    isSearxngJSONMode(),
    getBraveApiKey(),
    getTavilyApiKey(),
    getGoogleDomain(),
    getInternetSearchOn(),
    getExaAPIKey(),
    getFirecrawlAPIKey()
  ])

  return {
    isSimpleInternetSearch,
    searchProvider,
    totalSearchResults: totalSearchResult,
    visitSpecificWebsite,
    searxngURL,
    searxngJSONMode,
    braveApiKey,
    tavilyApiKey,
    googleDomain,
    defaultInternetSearchOn,
    exaAPIKey,
    firecrawlAPIKey
  }
}

export const setSearchSettings = async ({
  isSimpleInternetSearch,
  searchProvider,
  totalSearchResults,
  visitSpecificWebsite,
  searxngJSONMode,
  searxngURL,
  braveApiKey,
  tavilyApiKey,
  googleDomain,
  defaultInternetSearchOn,
  exaAPIKey,
  firecrawlAPIKey
}: {
  isSimpleInternetSearch: boolean
  searchProvider: string
  totalSearchResults: number
  visitSpecificWebsite: boolean
  searxngURL: string
  searxngJSONMode: boolean
  braveApiKey: string
  tavilyApiKey: string
  googleDomain: string,
  defaultInternetSearchOn: boolean
  exaAPIKey: string,
  firecrawlAPIKey: string
}) => {
  await Promise.all([
    setIsSimpleInternetSearch(isSimpleInternetSearch),
    setSearchProvider(searchProvider),
    setTotalSearchResults(totalSearchResults),
    setIsVisitSpecificWebsite(visitSpecificWebsite),
    setSearxngJSONMode(searxngJSONMode),
    setSearxngURL(searxngURL),
    setBraveApiKey(braveApiKey),
    setTavilyApiKey(tavilyApiKey),
    setGoogleDomain(googleDomain),
    setInternetSearchOn(defaultInternetSearchOn),
    setExaAPIKey(exaAPIKey),
    setFirecrawlAPIKey(firecrawlAPIKey)
  ])
}
