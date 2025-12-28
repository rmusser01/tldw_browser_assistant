const fs = require('fs');
const path = require('path');

const assetsBase = path.join('src', 'assets', 'locale');
const publicBase = path.join('src', 'public', '_locales');
const localeMap = {
  ja: 'ja-JP',
  zh_TW: 'zh-TW',
  zh_CN: 'zh',
};
const defaultFiles = ['playground.json', 'sidepanel.json'];

const targetFiles = process.argv.slice(2);
const files = targetFiles.length ? targetFiles : defaultFiles;

function flatten(obj, prefix = '', out = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const next = prefix ? `${prefix}_${key}` : key;
      flatten(value, next, out);
    }
  } else {
    out[prefix] = obj;
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
    const flat = flatten(assets);
    const output = {};
    for (const [key, value] of Object.entries(flat)) {
      output[key] = { message: value };
    }
    const outPath = path.join(publicBase, locale, filename);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  }
}
