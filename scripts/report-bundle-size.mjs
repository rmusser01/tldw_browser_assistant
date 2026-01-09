import fs from "node:fs"
import path from "node:path"

const candidates = [
  path.resolve("build/chrome-mv3"),
  path.resolve(".output/chrome-mv3")
]

const root = candidates.find((dir) => fs.existsSync(dir))

if (!root) {
  console.error(
    "No build output found. Run `bun run build:chrome` first."
  )
  process.exit(1)
}

const includeExtensions = new Set([".js", ".css", ".html", ".json"])

const collectFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
      continue
    }
    const ext = path.extname(entry.name)
    if (includeExtensions.has(ext)) {
      files.push(fullPath)
    }
  }
  return files
}

const files = collectFiles(root)
const sizes = files.map((filePath) => {
  const stats = fs.statSync(filePath)
  return {
    filePath,
    size: stats.size
  }
})

sizes.sort((a, b) => b.size - a.size)

const totalBytes = sizes.reduce((sum, item) => sum + item.size, 0)
const toKb = (bytes) => (bytes / 1024).toFixed(1)

console.log(`Bundle size report for: ${root}`)
console.log(`Total size: ${toKb(totalBytes)} KB`)
console.log("")
console.log("Top 15 largest files:")
sizes.slice(0, 15).forEach((item, index) => {
  const relPath = path.relative(root, item.filePath)
  console.log(`${String(index + 1).padStart(2, " ")}. ${toKb(item.size)} KB  ${relPath}`)
})
