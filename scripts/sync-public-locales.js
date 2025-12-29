const fs = require('fs');
const path = require('path');

const assetsBase = path.join('src', 'assets', 'locale');
const publicBase = path.join('src', 'public', '_locales');
// Map public locale folder -> assets locale folder.
// Expected keys: folder names under src/public/_locales.
// Expected values: folder names under src/assets/locale.
const localeMap = {
  ja: 'ja-JP',
  zh_TW: 'zh-TW',
  zh_CN: 'zh',
};
const defaultLocaleForFiles = 'en';
// Default to all JSON locale files from assets; pass filenames as args to limit scope.
const defaultFiles = fs
  .readdirSync(path.join(assetsBase, defaultLocaleForFiles))
  .filter((file) => file.endsWith('.json'))
  .sort();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const backup = args.includes('--backup');
const targetFiles = args.filter((arg) => arg !== '--dry-run' && arg !== '--backup');
const files = targetFiles.length ? targetFiles : defaultFiles;

function normalizeMessage(value, key, invalid) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    console.error(`[sync-public-locales] Arrays are not supported: ${key}`);
    invalid.push(key);
    return null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    console.warn(`[sync-public-locales] Coercing ${key} to string.`);
    return String(value);
  }
  invalid.push(key);
  return null;
}

// Flatten nested assets locales into Chrome i18n keys: section.subkey -> section_subkey.
// Only string-ish leaves are written as { message: string } entries.
function flatten(obj, prefix = '', out = {}, invalid = []) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const next = prefix ? `${prefix}_${key}` : key;
      flatten(value, next, out, invalid);
    }
  } else {
    const normalized = normalizeMessage(obj, prefix, invalid);
    if (normalized !== null) {
      out[prefix] = normalized;
    }
  }
  return out;
}

const locales = fs
  .readdirSync(publicBase, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name);

for (const locale of locales) {
  const assetLocale = localeMap[locale] || locale;
  for (const filename of files) {
    const assetPath = path.join(assetsBase, assetLocale, filename);
    if (!fs.existsSync(assetPath)) {
      continue;
    }
    const assets = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
    const invalidLeaves = [];
    const flat = flatten(assets, '', {}, invalidLeaves);
    if (invalidLeaves.length) {
      console.warn(
        `[sync-public-locales] Skipped non-string values in ${assetPath}: ${invalidLeaves.join(
          ', '
        )}`
      );
      process.exitCode = 1;
    }
    const output = Object.fromEntries(
      Object.entries(flat).map(([key, value]) => [key, { message: value }])
    );
    const outPath = path.join(publicBase, locale, filename);
    // NOTE: This rewrites public locale files. Asset-derived keys overwrite existing values.
    let merged = output;
    let existingRaw = null;
    if (fs.existsSync(outPath)) {
      existingRaw = fs.readFileSync(outPath, 'utf8');
      const existing = JSON.parse(existingRaw);
      const publicOnlyKeys = Object.keys(existing).filter((key) => !(key in output));
      if (publicOnlyKeys.length) {
        console.warn(
          `[sync-public-locales] Preserving ${publicOnlyKeys.length} public-only keys in ${outPath}.`
        );
      }
      merged = { ...existing, ...output };
    }
    const nextJson = JSON.stringify(merged, null, 2) + '\n';
    if (existingRaw !== null && existingRaw === nextJson) {
      continue;
    }
    if (dryRun) {
      console.log(`[sync-public-locales] DRY RUN: would write ${outPath}`);
      continue;
    }
    if (backup && existingRaw !== null) {
      fs.writeFileSync(`${outPath}.bak`, existingRaw);
    }
    fs.writeFileSync(outPath, nextJson);
  }
}
