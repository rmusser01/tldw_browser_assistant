const fs = require('fs');
const path = require('path');

const assetsBase = path.join('src', 'assets', 'locale');
const glossaryPath = path.join(__dirname, 'i18n-glossary.json');

const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));

function getPathValue(obj, segments) {
  let current = obj;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

const cache = new Map();

function loadLocaleFile(locale, fileBase) {
  const cacheKey = `${locale}/${fileBase}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const filePath = path.join(assetsBase, locale, `${fileBase}.json`);
  if (!fs.existsSync(filePath)) {
    cache.set(cacheKey, null);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  cache.set(cacheKey, data);
  return data;
}

const errors = [];

for (const term of glossary.terms || []) {
  const matchMode = term.match || 'contains';
  if (!term.paths || !term.translations) {
    errors.push(`Glossary term "${term.id || term.source}" is missing paths or translations.`);
    continue;
  }

  for (const [locale, translationsRaw] of Object.entries(term.translations)) {
    const translations = Array.isArray(translationsRaw) ? translationsRaw : [translationsRaw];

    for (const pathSpec of term.paths) {
      const [fileBase, ...segments] = pathSpec.split('.');
      const fileData = loadLocaleFile(locale, fileBase);

      if (!fileData) {
        errors.push(`[${locale}] missing file: ${fileBase}.json for term "${term.id || term.source}"`);
        continue;
      }

      const value = getPathValue(fileData, segments);
      if (typeof value !== 'string') {
        errors.push(
          `[${locale}] ${fileBase}.${segments.join('.')} missing or not a string for term "${term.id || term.source}"`
        );
        continue;
      }

      const matches = translations.some((translation) => {
        return matchMode === 'exact' ? value === translation : value.includes(translation);
      });

      if (!matches) {
        errors.push(
          `[${locale}] ${fileBase}.${segments.join('.')} expected ${matchMode} match for ${JSON.stringify(translations)}`
        );
      }
    }
  }
}

if (errors.length) {
  console.error('Glossary check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
} else {
  console.log('Glossary check passed.');
}
