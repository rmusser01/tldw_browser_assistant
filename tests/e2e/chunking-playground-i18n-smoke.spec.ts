import { test, expect } from "@playwright/test"
import path from "path"
import { launchWithExtension } from "./utils/extension"

type LocaleFixture = {
  locale: string
  title: RegExp
  cta: string
}

const localeFixtures: LocaleFixture[] = [
  {
    locale: "en",
    title: /Chunking Playground/i,
    cta: "Chunk Text"
  },
  {
    locale: "fr",
    title: /Bac à sable de segmentation/i,
    cta: "Segmenter le texte"
  }
]

const openChunkingPlayground = async (
  context: Awaited<ReturnType<typeof launchWithExtension>>["context"],
  optionsUrl: string,
  locale: string
) => {
  const page = await context.newPage()
  await page.addInitScript((lang) => {
    window.localStorage.setItem("i18nextLng", lang)
  }, locale)
  await page.goto(`${optionsUrl}#/chunking-playground`)
  return page
}

test.describe("Chunking Playground i18n smoke", () => {
  for (const fixture of localeFixtures) {
    test(`renders chunking playground in ${fixture.locale}`, async () => {
      const extPath = path.resolve("build/chrome-mv3")
      const { context, optionsUrl } = await launchWithExtension(extPath)

      const page = await openChunkingPlayground(
        context,
        optionsUrl,
        fixture.locale
      )

      await expect(
        page.getByRole("heading", { name: fixture.title })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: fixture.cta })
      ).toBeVisible()

      await context.close()
    })
  }
})
