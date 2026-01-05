import { browser } from "wxt/browser"
import { isChromiumTarget } from "@/config/platform"

export const setTitle = ({ title }: { title: string }) => {
  if (isChromiumTarget) {
    chrome.action.setTitle({ title })
  } else {
    browser.browserAction.setTitle({ title })
  }
}

export const setBadgeBackgroundColor = ({ color }: { color: string }) => {
  if (isChromiumTarget) {
    chrome.action.setBadgeBackgroundColor({ color })
  } else {
    browser.browserAction.setBadgeBackgroundColor({ color })
  }
}

export const setBadgeText = ({ text }: { text: string }) => {
  if (isChromiumTarget) {
    chrome.action.setBadgeText({ text })
  } else {
    browser.browserAction.setBadgeText({ text })
  }
}
