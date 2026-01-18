import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'path'

export default async function globalSetup() {
  // If a built chrome extension already exists, skip rebuilding.
  const builtChromePath = path.resolve('build/chrome-mv3')
  const forceBuildChrome =
    process.env.FORCE_BUILD_CHROME === '1' ||
    process.env.FORCE_BUILD_CHROME === 'true'

  const getLatestMtime = (dir: string): number => {
    let latest = 0
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          latest = Math.max(latest, getLatestMtime(fullPath))
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath)
          if (stat.mtimeMs > latest) latest = stat.mtimeMs
        }
      }
    } catch {
      return latest
    }
    return latest
  }

  const getFileMtime = (filePath: string): number => {
    try {
      return fs.statSync(filePath).mtimeMs
    } catch {
      return 0
    }
  }

  const isDevBuild = (dir: string) => {
    const optionsPath = path.join(dir, 'options.html')
    if (!fs.existsSync(optionsPath)) return false
    const html = fs.readFileSync(optionsPath, 'utf8')
    return (
      html.includes('http://localhost:') ||
      html.includes('/@vite/client') ||
      html.includes('virtual:wxt-html-plugins')
    )
  }

  if (
    fs.existsSync(builtChromePath) &&
    !forceBuildChrome &&
    !isDevBuild(builtChromePath)
  ) {
    const buildStamp = path.join(builtChromePath, 'manifest.json')
    const buildMtime = getFileMtime(buildStamp)
    const latestSourceMtime = Math.max(
      getLatestMtime(path.resolve('src')),
      getFileMtime(path.resolve('wxt.config.ts')),
      getFileMtime(path.resolve('package.json')),
      getFileMtime(path.resolve('tailwind.config.js')),
      getFileMtime(path.resolve('tsconfig.json'))
    )
    if (buildMtime && latestSourceMtime <= buildMtime) {
      return
    }
  }

  // Build the extension once before running tests
  // Prefer npm (bun may be unavailable in some environments)
  try {
    execSync('npm run build:chrome', { stdio: 'inherit' })
  } catch {
    try {
      // Fallback: use wxt directly
      execSync('cross-env TARGET=chrome wxt build', { stdio: 'inherit' })
    } catch {
      // Last resort: bun (if present)
      execSync('bun run build:chrome', { stdio: 'inherit' })
    }
  }
}
