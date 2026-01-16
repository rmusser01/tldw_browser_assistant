import { defineConfig } from "wxt"
import react from "@vitejs/plugin-react"
import topLevelAwait from "vite-plugin-top-level-await"
import { parse } from "acorn"
import MagicString from "magic-string"
import { walk } from "estree-walker"
import type { Plugin } from "vite"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const pkg = require("./package.json")

const isEnvEnabled = (value?: string) =>
  /^(1|true|yes|y|on)$/i.test((value ?? "").trim())

// Force a single React instance during dev to avoid hook dispatcher mismatches.
const reactAliases = [
  { find: /^react$/, replacement: require.resolve("react") },
  { find: /^react-dom$/, replacement: require.resolve("react-dom") },
  { find: /^react-dom\/client$/, replacement: require.resolve("react-dom/client") },
  { find: /^react\/jsx-runtime$/, replacement: require.resolve("react/jsx-runtime") },
  { find: /^react\/jsx-dev-runtime$/, replacement: require.resolve("react/jsx-dev-runtime") }
]

const nodePolyfills = [
  { find: /^stream$/, replacement: "stream-browserify" },
  { find: /^buffer$/, replacement: "buffer" }
]

const isFirefox = process.env.TARGET === "firefox"
const isDevelopment = process.env.NODE_ENV === "development"
const isHmrDisabled = isEnvEnabled(process.env.WXT_DISABLE_HMR)
const isRunnerDisabled = isEnvEnabled(process.env.WXT_DISABLE_RUNNER)

// Enable bundle analysis for ANALYZE values like: "1", "true", "yes", "on" (case-insensitive)
const analyzeBundle = isEnvEnabled(process.env.ANALYZE)

const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) return undefined
  return "vendor"
}

const chunkSplitPlugin = (): Plugin => ({
  name: "wxt-manual-chunks",
  config(config) {
    if (config.build?.lib) return
    const rollupOptions = config.build?.rollupOptions ?? {}
    const output = rollupOptions.output
    const applyManualChunks = (out: any) => {
      if (out?.inlineDynamicImports) return out
      return { ...out, manualChunks }
    }
    const nextOutput = Array.isArray(output)
      ? output.map((out) => applyManualChunks(out))
      : applyManualChunks(output ?? {})

    config.build = {
      ...config.build,
      rollupOptions: {
        ...rollupOptions,
        output: nextOutput
      }
    }
  }
})

const safeInnerHTMLPlugin = (): Plugin => ({
  name: "sanitize-innerhtml",
  enforce: "post",
  transform(code, id) {
    if (!id || id.includes("node_modules")) return null
    if (!code.includes("innerHTML")) return null

    const ast = parse(code, { ecmaVersion: "latest", sourceType: "module" }) as any
    const ms = new MagicString(code)
    let replaced = 0

    walk(ast as any, {
      enter(node: any) {
        if (
          node.type === "AssignmentExpression" &&
          node.operator === "=" &&
          node.left?.type === "MemberExpression"
        ) {
          const property = node.left.property
          const isInnerHTML =
            (!node.left.computed &&
              property?.type === "Identifier" &&
              property.name === "innerHTML") ||
            (node.left.computed &&
              ((property?.type === "Literal" && property.value === "innerHTML") ||
                (property?.type === "Identifier" && property.name === "innerHTML")))

          if (!isInnerHTML) return

          const target = code.slice(node.left.object.start, node.left.object.end)
          const value = code.slice(node.right.start, node.right.end)

          ms.overwrite(node.start, node.end, `__setSafeInnerHTML(${target}, ${value})`)
          replaced += 1
        }
      }
    })

    if (!replaced) return null

    const helper = `
import * as __DOMPurifyModule from "dompurify";
const __createDOMPurify =
  // ESM default export or CJS default property
  typeof __DOMPurifyModule === "object" &&
  __DOMPurifyModule &&
  "default" in __DOMPurifyModule
    ? // @ts-ignore
      __DOMPurifyModule.default
    : __DOMPurifyModule;
const DOMPurify =
  typeof __createDOMPurify === "function"
    ? __createDOMPurify(typeof window !== "undefined" ? window : undefined)
    : __createDOMPurify;

const __setSafeInnerHTML = (el, html) => {
  if (!el) return;
  const doc = el.ownerDocument || document;
  const raw = html?.valueOf?.() ?? html ?? "";
  const sanitized = DOMPurify.sanitize(String(raw), { RETURN_TRUSTED_TYPE: false });
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
  const range = doc.createRange();
  range.selectNodeContents(el);
  const markup =
    el.namespaceURI === "http://www.w3.org/2000/svg"
      ? "<svg xmlns=\\"http://www.w3.org/2000/svg\\">" + sanitized + "</svg>"
      : sanitized;
  const fragment = range.createContextualFragment(markup);
  const target =
    el.namespaceURI === "http://www.w3.org/2000/svg" ? fragment.firstChild : fragment;
  if (!target) return;
  if (el.namespaceURI === "http://www.w3.org/2000/svg") {
    while (target.firstChild) {
      el.appendChild(target.firstChild);
    }
  } else {
    el.appendChild(target);
  }
};
`

    const strictMatch = code.match(/^(?:\\s*['"]use strict['"];?)/)
    const insertPos = strictMatch ? strictMatch[0].length : 0

    if (insertPos) {
      ms.appendLeft(insertPos, helper)
    } else {
      ms.prepend(helper)
    }

    return {
      code: ms.toString(),
      map: ms.generateMap({ hires: true })
    }
  }
})

const chromeMV3Permissions = [
  "storage",
  "sidePanel",
  "activeTab",
  "scripting",
  "unlimitedStorage",
  "contextMenus",
  "tts",
  "notifications",
  "alarms"
]

const firefoxMV2Permissions = [
  "storage",
  "activeTab",
  "scripting",
  "unlimitedStorage",
  "contextMenus",
  "alarms",
  "notifications",
  "http://*/*",
  "https://*/*",
  "file://*/*"
]

const chromeExtensionPagesCsp = isDevelopment
  ? "script-src 'self' 'wasm-unsafe-eval' http://localhost:* http://127.0.0.1:*; object-src 'self';"
  : "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"

const firefoxExtensionPagesCsp =
  "script-src 'self' 'wasm-unsafe-eval' blob:; object-src 'self'; worker-src 'self' blob:;"

const extensionPagesCsp = isFirefox
  ? firefoxExtensionPagesCsp
  : chromeExtensionPagesCsp

// Bundle analysis plugin (enabled via ANALYZE env flag)
const bundleAnalyzerPlugin = async (): Promise<Plugin | null> => {
  if (!analyzeBundle) return null
  try {
    const { visualizer } = await import("rollup-plugin-visualizer")
    const plugin = visualizer({
      filename: "build/bundle-stats.html",
      // Avoid opening a browser tab automatically in CI environments.
      open: !process.env.CI,
      gzipSize: true,
      brotliSize: true,
      template: "treemap"
    }) as Plugin

    // Ensure it only affects production bundle builds (not dev server transforms).
    if ((plugin as any).apply === undefined) {
      ;(plugin as any).apply = "build"
    }

    return plugin
  } catch (err) {
    const code = (err as any)?.code
    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      console.warn(
        "rollup-plugin-visualizer not installed. Run: bun add -D rollup-plugin-visualizer"
      )
    } else {
      console.error("Failed to configure bundle analyzer:", err)
    }
    return null
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: async () => {
    const analyzerPlugin = await bundleAnalyzerPlugin()
    return {
      plugins: [
        react(),
        safeInnerHTMLPlugin(),
        chunkSplitPlugin(),
        topLevelAwait({
          promiseExportName: "__tla",
          promiseImportName: (i) => `__tla_${i}`
        }),
        ...(analyzerPlugin ? [analyzerPlugin] : [])
      ],
      define: {
        global: "globalThis"
      },
      // Ensure every entry (options, sidepanel, content scripts) shares a single React instance.
      resolve: {
        dedupe: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime"
        ],
        alias: [...reactAliases, ...nodePolyfills]
      },
      // Keep HMR enabled so dep optimization can trigger a full reload.
      server: {
        hmr: isHmrDisabled ? false : { overlay: false },
        warmup: {
          clientFiles: [
            "src/entries/options/main.tsx",
            "src/entries/sidepanel/main.tsx"
          ]
        }
      },
      optimizeDeps: {
        // Prebundle React + crawl lazy-loaded UI to avoid mixed module graphs on cold start.
        force: true,
        holdUntilCrawlEnd: true,
        include: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "buffer",
          "stream-browserify"
        ],
        entries: [
          "src/entries/options/index.html",
          "src/entries/sidepanel/index.html",
          "src/entries/options/main.tsx",
          "src/entries/sidepanel/main.tsx",
          "src/components/**/*.{ts,tsx}",
          "src/routes/**/*.{ts,tsx}"
        ]
      },
      build: {
        // Firefox MV2 validator chokes on modern ESM in chunks; downlevel and turn off module preload there.
        target: isFirefox ? "es2017" : "esnext",
        modulePreload: isFirefox ? false : undefined
      }
    }
  },
  runner: {
    disabled: isRunnerDisabled
  },
  entrypointsDir: "entries",
  srcDir: "src",
  outDir: "build",

  manifest: ({
    version: pkg.version,
    name:
      process.env.TARGET === "firefox"
        ? "tldw Assistant"
        : "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    action: {},
    author: "tldw-team",
    browser_specific_settings:
      process.env.TARGET === "firefox"
        ? {
            gecko: {
              id: "tldw-assistant@tldw"
            }
          }
        : undefined,
    // Allow outbound calls to the user's tldw_server (local or remote) without an extra permission prompt.
    host_permissions: ["http://*/*", "https://*/*"],
    optional_host_permissions: undefined,
    commands: {
      _execute_action: {
        description: "Open the Web UI",
        suggested_key: {
          default: "Ctrl+Shift+L"
        }
      },
      execute_side_panel: {
        description: "Open the side panel",
        suggested_key: {
          default: "Ctrl+Shift+Y"
        }
      }
    },
    content_security_policy: {
      extension_pages: extensionPagesCsp
    },
    permissions:
      process.env.TARGET === "firefox"
        ? firefoxMV2Permissions
        : chromeMV3Permissions
  } as any)
}) as any
