import { isFirefoxTarget } from "@/config/platform"

export const isFireFox = isFirefoxTarget

export const isFireFoxPrivateMode =
  isFireFox && browser.extension.inIncognitoContext
