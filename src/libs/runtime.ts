/**
 * Rewrites the URL of a request to set the 'Origin' header based on the user's CORS settings.
 *
 * This function is used to handle CORS issues that may arise when making requests to certain domains.
 * It checks the user's advanced settings to determine if URL rewriting is enabled, and if so, it updates the
 * 'Origin' header of the request to the specified rewrite URL.
 *
 * @param domain - The domain of the request to be rewritten.
 * @returns - A Promise that resolves when the URL rewriting is complete.
 */
import { getAdvancedCORSSettings } from "@/services/app"
import { isChromiumTarget, isFirefoxTarget } from "@/config/platform"

export const urlRewriteRuntime = async function (domain: string) {
  if (browser.runtime && browser.runtime.id) {
    const { isEnableRewriteUrl, rewriteUrl, autoCORSFix } =
      await getAdvancedCORSSettings()

    if (!autoCORSFix) {
      if (isChromiumTarget) {
        try {
          await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1],
            addRules: []
          })
        } catch (e) {}
      }

      if (isFirefoxTarget) {
        try {
          browser.webRequest.onBeforeSendHeaders.removeListener(() => {})
        } catch (e) {}
      }

      return
    }

    if (isChromiumTarget) {
      const url = new URL(domain)
      const domains = [url.hostname]
      let origin = `${url.protocol}//${url.hostname}`
      if (isEnableRewriteUrl && rewriteUrl) {
        origin = rewriteUrl
      }
      const rules = [
        {
          id: 1,
          priority: 1,
          condition: {
            requestDomains: domains
          },
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              {
                header: "Origin",
                operation: "set",
                value: origin
              }
            ]
          }
        }
      ]
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map((r) => r.id),
        // @ts-ignore
        addRules: rules
      })
    }

    if (isFirefoxTarget) {
      const url = new URL(domain)
      const domains = [`*://${url.hostname}/*`]
      browser.webRequest.onBeforeSendHeaders.addListener(
        (details) => {
          let origin = `${url.protocol}//${url.hostname}`
          if (isEnableRewriteUrl && rewriteUrl) {
            origin = rewriteUrl
          }
          for (let i = 0; i < details.requestHeaders.length; i++) {
            if (details.requestHeaders[i].name === "Origin") {
              details.requestHeaders[i].value = origin
            }
          }
          return { requestHeaders: details.requestHeaders }
        },
        { urls: domains },
        ["blocking", "requestHeaders"]
      )
    }
  }
}
