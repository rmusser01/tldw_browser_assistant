import ICU, { type IcuConfig } from "i18next-icu"
import type { i18n, InterpolationOptions, Interpolator } from "i18next"

declare module "i18next-icu" {
  interface IcuInstance<TOptions = IcuConfig> {
    parse(
      res: string,
      options: Record<string, unknown>,
      lng: string,
      ns: string,
      key: string,
      info?: { resolved?: { res?: string } }
    ): string
  }
}

// Bridge ICU formatting with existing {{var}} interpolation.
export default class ICUWithInterpolation extends ICU {
  private interpolator?: Interpolator
  private interpolationOptions?: InterpolationOptions

  init(i18next: i18n, options?: IcuConfig) {
    super.init(i18next, options)
    this.interpolator = i18next?.services?.interpolator
    this.interpolationOptions = i18next?.options?.interpolation
  }

  parse(
    res: string,
    options: Record<string, unknown>,
    lng: string,
    ns: string,
    key: string,
    info?: { resolved?: { res?: string } }
  ) {
    const interpolationOptions =
      (options as { interpolation?: InterpolationOptions })?.interpolation ??
      this.interpolationOptions ??
      {}
    const interpolated =
      typeof res === "string" && this.interpolator
        ? this.interpolator.interpolate(
            res,
            options as Record<string, unknown>,
            lng,
            interpolationOptions
          )
        : res
    return super.parse(interpolated, options, lng, ns, key, info)
  }
}
