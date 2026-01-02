import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'path'

export default async function globalSetup() {
  // If a built chrome extension already exists, skip rebuilding.
  const builtChromePath = path.resolve('build/chrome-mv3')
  const forceBuildChrome =
    process.env.FORCE_BUILD_CHROME === '1' ||
    process.env.FORCE_BUILD_CHROME === 'true'

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
    return
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
