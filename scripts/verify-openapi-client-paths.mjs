#!/usr/bin/env node
/**
 * Verify that:
 *   1) All ClientPath entries in src/services/tldw/openapi-guard.ts
 *      exist in the local openapi.json.
 *   2) The MEDIA_ADD_SCHEMA_FALLBACK field list remains a subset of the
 *      /api/v1/media/add request schema in openapi.json.
 *
 * This is a lightweight, build-time safety net to catch drift between
 * the extension's manually-maintained API types and the server's
 * OpenAPI spec, without bundling the 1.4MB JSON into the runtime.
 *
 * Usage:
 *   npm run verify:openapi
 *   bun run verify:openapi
 */

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import url from 'node:url'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const guardFile = path.join(root, 'src/services/tldw/openapi-guard.ts')
const fallbackFile = path.join(root, 'src/services/tldw/fallback-schemas.ts')
const specFile = path.join(root, 'openapi.json')

function normalizePath(p) {
  if (!p) return ''
  let v = String(p).trim()
  if (!v.startsWith('/')) v = '/' + v
  // Strip trailing slashes to tolerate /path vs /path/
  v = v.replace(/\/+$/, '')
  return v || '/'
}

function loadSpecPaths() {
  if (!fs.existsSync(specFile)) {
    console.error(`openapi.json not found at ${specFile}`)
    process.exit(1)
  }
  let json
  try {
    const text = fs.readFileSync(specFile, 'utf8')
    json = JSON.parse(text)
  } catch (err) {
    console.error('Failed to read or parse openapi.json:', err)
    process.exit(1)
  }
  const paths = json && typeof json === 'object' && json.paths
  if (!paths || typeof paths !== 'object') {
    console.error('openapi.json does not contain a valid "paths" object')
    process.exit(1)
  }
  return new Set(Object.keys(paths).map(normalizePath))
}

function extractClientPathsFromTypeScript(src) {
  let ts
  try {
    ts = require('typescript')
  } catch {
    return []
  }

  const sourceFile = ts.createSourceFile(
    guardFile,
    src,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  )

  for (const statement of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name?.text !== 'ClientPath') continue
    if (!ts.isUnionTypeNode(statement.type)) return []

    const paths = []
    for (const typeNode of statement.type.types) {
      const node = ts.isParenthesizedTypeNode(typeNode) ? typeNode.type : typeNode
      if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
        paths.push(node.literal.text)
      }
    }
    return paths
  }

  return []
}

function loadMediaAddProperties(json) {
  const mediaPath = json.paths && json.paths['/api/v1/media/add']
  if (!mediaPath || !mediaPath.post || !mediaPath.post.requestBody) {
    console.error('openapi.json does not contain /api/v1/media/add with a POST requestBody')
    process.exit(1)
  }
  const content = mediaPath.post.requestBody.content
  if (!content || !content['multipart/form-data']) {
    console.error(
      'openapi.json does not define multipart/form-data content for /api/v1/media/add requestBody'
    )
    process.exit(1)
  }
  const schema = content['multipart/form-data'].schema
  if (!schema || typeof schema !== 'object') {
    console.error(
      'openapi.json multipart/form-data schema for /api/v1/media/add requestBody is missing or invalid'
    )
    process.exit(1)
  }

  let properties
  if (schema.$ref) {
    const refPrefix = '#/components/schemas/'
    if (!schema.$ref.startsWith(refPrefix)) {
      console.error(`Unsupported $ref format for /api/v1/media/add schema: ${schema.$ref}`)
      process.exit(1)
    }
    const name = schema.$ref.slice(refPrefix.length)
    const comp = json.components && json.components.schemas && json.components.schemas[name]
    if (!comp || !comp.properties) {
      console.error(
        `Referenced schema ${name} for /api/v1/media/add does not define a properties object`
      )
      process.exit(1)
    }
    properties = comp.properties
  } else if (schema.properties) {
    properties = schema.properties
  } else {
    console.error(
      'openapi.json /api/v1/media/add schema does not define a properties object or $ref'
    )
    process.exit(1)
  }

  if (!properties || typeof properties !== 'object') {
    console.error(
      'openapi.json /api/v1/media/add properties object is missing or not an object after resolution'
    )
    process.exit(1)
  }

  return new Set(Object.keys(properties))
}

function extractClientPaths() {
  if (!fs.existsSync(guardFile)) {
    console.error(`openapi-guard.ts not found at ${guardFile}`)
    process.exit(1)
  }
  const src = fs.readFileSync(guardFile, 'utf8')
  const astPaths = extractClientPathsFromTypeScript(src)
  if (astPaths.length > 0) return [...new Set(astPaths)]

  const startRegex = /export\s+type\s+ClientPath\s*=\s*/m
  const startMatch = startRegex.exec(src)
  if (!startMatch) {
    console.error('Could not locate "export type ClientPath" in openapi-guard.ts')
    process.exit(1)
  }

  const afterStart = startMatch.index + startMatch[0].length
  const rest = src.slice(afterStart)

  // ClientPath is expected to appear before the next top-level export.
  const endMatch = /^\s*export\s/m.exec(rest)
  const typeRhs = endMatch ? rest.slice(0, endMatch.index) : rest

  // Strip comments so blank/comment lines can't truncate parsing and we don't
  // accidentally pick up string literals from commented-out examples.
  const withoutComments = typeRhs
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  const paths = []
  const unionLiteralRegex = /(?:^|\|)\s*(["'])([^"'\\]*(?:\\.[^"'\\]*)*)\1/gm
  for (const match of withoutComments.matchAll(unionLiteralRegex)) {
    paths.push(match[2])
  }

  if (paths.length === 0) {
    console.error('No ClientPath entries were parsed from openapi-guard.ts')
    process.exit(1)
  }

  return [...new Set(paths)]
}

function extractFallbackFieldNames() {
  if (!fs.existsSync(fallbackFile)) {
    console.error(`fallback-schemas.ts not found at ${fallbackFile}`)
    process.exit(1)
  }

  const src = fs.readFileSync(fallbackFile, 'utf8')
  const marker = 'export const MEDIA_ADD_SCHEMA_FALLBACK'
  const start = src.indexOf(marker)
  if (start === -1) {
    console.error(`Could not locate "${marker}" in fallback-schemas.ts`)
    process.exit(1)
  }

  const arrStart = src.indexOf('[', start)
  const arrEnd = src.indexOf(']\n', arrStart)
  if (arrStart === -1 || arrEnd === -1) {
    console.error('Could not locate MEDIA_ADD_SCHEMA_FALLBACK array literal block')
    process.exit(1)
  }

  const block = src.slice(arrStart, arrEnd)
  const names = []
  const re = /name:\s*['"]([^'"]+)['"]/g
  for (const match of block.matchAll(re)) {
    names.push(match[1])
  }

  if (names.length === 0) {
    console.error('No MEDIA_ADD_SCHEMA_FALLBACK entries were parsed from fallback-schemas.ts')
    process.exit(1)
  }

  return names
}

function verifyClientPaths(specJson) {
  const specPaths = loadSpecPaths()
  const clientPaths = extractClientPaths()

  const missing = []
  for (const p of clientPaths) {
    const norm = normalizePath(p)
    if (!specPaths.has(norm)) {
      missing.push({ path: p, normalized: norm })
    }
  }

  if (missing.length > 0) {
    console.error('❌ ClientPath entries missing from openapi.json (after normalization):')
    for (const m of missing) {
      console.error(`  - ${m.path} (normalized: ${m.normalized})`)
    }
    console.error(
      '\nEither update ClientPath in src/services/tldw/openapi-guard.ts, ' +
        'or ensure your local openapi.json is up to date.'
    )
    process.exit(1)
  }

  console.log(
    `✅ Verified ${clientPaths.length} ClientPath entries against openapi.json; all paths are present.`
  )
}

function verifyMediaAddFallback(specJson) {
  const specProps = loadMediaAddProperties(specJson)
  const fallbackNames = extractFallbackFieldNames()

  const missing = fallbackNames.filter((name) => !specProps.has(name))

  if (missing.length > 0) {
    console.error(
      '❌ MEDIA_ADD_SCHEMA_FALLBACK contains field names not present in the /api/v1/media/add schema:'
    )
    for (const name of missing) {
      console.error(`  - ${name}`)
    }
    console.error(
      '\nEither update MEDIA_ADD_SCHEMA_FALLBACK in src/services/tldw/fallback-schemas.ts, ' +
        'or ensure your local openapi.json is up to date.'
    )
    process.exit(1)
  }

  console.log(
    `✅ Verified ${fallbackNames.length} MEDIA_ADD_SCHEMA_FALLBACK fields against /api/v1/media/add schema; all names are present.`
  )
}

function main() {
  let specJson
  try {
    const text = fs.readFileSync(specFile, 'utf8')
    specJson = JSON.parse(text)
  } catch (err) {
    console.error('Failed to read or parse openapi.json for verification:', err)
    process.exit(1)
  }

  verifyClientPaths(specJson)
  verifyMediaAddFallback(specJson)
}

main()
