#!/usr/bin/env node
/**
 * Verify that all ClientPath entries in src/services/tldw/openapi-guard.ts
 * exist in the local openapi.json.
 *
 * This is a lightweight, build-time safety net to catch drift between
 * the extension's manually-maintained ClientPath union and the server's
 * OpenAPI spec, without bundling the 1.4MB JSON into the runtime.
 *
 * Usage:
 *   npm run verify:openapi
 *   bun run verify:openapi
 */

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const guardFile = path.join(root, 'src/services/tldw/openapi-guard.ts')
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

function extractClientPaths() {
  if (!fs.existsSync(guardFile)) {
    console.error(`openapi-guard.ts not found at ${guardFile}`)
    process.exit(1)
  }
  const src = fs.readFileSync(guardFile, 'utf8')
  const lines = src.split('\n')
  const start = lines.findIndex((line) => line.includes('export type ClientPath'))
  if (start === -1) {
    console.error('Could not locate "export type ClientPath" in openapi-guard.ts')
    process.exit(1)
  }

  const paths = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    // Stop when we leave the union block
    if (!line.includes('|')) break
    const m = line.match(/"([^"]+)"/)
    if (m) paths.push(m[1])
  }

  if (paths.length === 0) {
    console.error('No ClientPath entries were parsed from openapi-guard.ts')
    process.exit(1)
  }

  return paths
}

function main() {
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

main()

