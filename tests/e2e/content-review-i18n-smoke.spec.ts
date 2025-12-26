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
    title: /Content Review/i,
    cta: "Open Quick Ingest"
  },
  {
    locale: "es",
    title: /Revisi\u00f3n de contenido/i,
    cta: "Abrir Quick Ingest"
  }
]

const openContentReview = async (
  context: Awaited<ReturnType<typeof launchWithExtension>>["context"],
  optionsUrl: string,
  locale: string
) => {
  const page = await context.newPage()
  await page.addInitScript((lang) => {
    window.localStorage.setItem("i18nextLng", lang)
  }, locale)
  await page.goto(`${optionsUrl}#/content-review`)
  return page
}

test.describe("Content Review i18n smoke", () => {
  for (const fixture of localeFixtures) {
    test(`renders Content Review in ${fixture.locale}`, async () => {
      const extPath = path.resolve("build/chrome-mv3")
      const { context, optionsUrl } = await launchWithExtension(extPath)

      const page = await openContentReview(
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
