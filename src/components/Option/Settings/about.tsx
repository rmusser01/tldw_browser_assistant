import { getOllamaURL } from "~/services/tldw-server"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "antd"
import { cleanUrl } from "@/libs/clean-url"
import { Descriptions } from "antd"
import fetcher from "@/libs/fetcher"
import { translateMessage } from "@/i18n/translateMessage"

export const AboutApp = () => {
  const { t } = useTranslation("settings")

  const { data, status } = useQuery({
    queryKey: ["fetchOllamaURL"],
    queryFn: async () => {
      const chromeVersion = browser.runtime.getManifest().version
      try {
        const url = await getOllamaURL()
        const req = await fetcher(`${cleanUrl(url)}/api/version`)

        if (!req.ok) {
          return {
            ollama: "N/A",
            chromeVersion
          }
        }

        const res = (await req.json()) as { version: string }
        return {
          ollama: res.version,
          chromeVersion
        }
      } catch {
        return {
          ollama: "N/A",
          chromeVersion
        }
      }
    }
  })

  return (
    <div className="flex flex-col space-y-3">
      {status === "pending" && <Skeleton paragraph={{ rows: 4 }} active />}
      {status === "error" && (
        <div className="text-red-500 dark:text-red-400">
          {translateMessage(
            t,
            "settings:about.errorLoading",
            "Failed to load version information."
          )}
        </div>
      )}
      {status === "success" && (
        <div className="flex flex-col space-y-4">
          <div>
            <h2 className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
              {translateMessage(t, "settings:about.heading", "About")}
            </h2>
            <div className="border-b border-gray-200 dark:border-gray-600 mt-3 mb-4"></div>
          </div>
          <Descriptions
            column={1}
            size="middle"
            items={[
              {
                key: 1,
                label: translateMessage(
                  t,
                  "settings:about.chromeVersion",
                  "tldw Browser_Assistant Version"
                ),
                children: data.chromeVersion
              },
              {
                key: 2,
                label: translateMessage(
                  t,
                  "settings:about.ollamaVersion",
                  "Server Version"
                ),
                children: data.ollama
              },
              {
                key: 3,
                label: "GitHub",
                children: (
                  <a
                    href="https://github.com/rmusser01/tldw_browser_assistant"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 dark:text-blue-400">
                    tldw Assistant on GitHub
                  </a>
                )
              }
            ]}
          />
        </div>
      )}
    </div>
  )
}
