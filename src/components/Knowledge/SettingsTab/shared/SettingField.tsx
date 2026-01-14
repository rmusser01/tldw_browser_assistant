import React from "react"
import { Input, InputNumber, Select, Switch } from "antd"
import type { InputRef } from "antd"

type BaseFieldProps = {
  label: string
  helper?: string
  visible?: boolean
}

type TextFieldProps = BaseFieldProps & {
  type: "text"
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

type NumberFieldProps = BaseFieldProps & {
  type: "number"
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

type SelectFieldProps = BaseFieldProps & {
  type: "select"
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}

type MultiSelectFieldProps = BaseFieldProps & {
  type: "multiselect"
  value: string[]
  onChange: (value: string[]) => void
  options: { label: string; value: string }[]
}

type SwitchFieldProps = BaseFieldProps & {
  type: "switch"
  value: boolean
  onChange: (value: boolean) => void
}

type TextAreaFieldProps = BaseFieldProps & {
  type: "textarea"
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export type SettingFieldProps =
  | TextFieldProps
  | NumberFieldProps
  | SelectFieldProps
  | MultiSelectFieldProps
  | SwitchFieldProps
  | TextAreaFieldProps

/**
 * Unified setting field component that replaces inline render functions
 *
 * Supports: text, number, select, multiselect, switch, textarea
 * Memoized to prevent unnecessary re-renders when parent state changes.
 */
export const SettingField: React.FC<SettingFieldProps> = React.memo((props) => {
  const { label, helper, visible = true } = props

  if (!visible) return null

  const renderField = () => {
    switch (props.type) {
      case "text":
        return (
          <Input
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            aria-label={label}
          />
        )

      case "number":
        return (
          <InputNumber
            value={props.value}
            onChange={(val) => {
              if (val === null || val === undefined) return
              const parsed = Number(val)
              if (Number.isFinite(parsed)) {
                props.onChange(parsed)
              }
            }}
            min={props.min}
            max={props.max}
            step={props.step}
            aria-label={label}
            className="w-full"
          />
        )

      case "select":
        return (
          <Select
            value={props.value}
            onChange={(val) => props.onChange(String(val))}
            options={props.options}
            aria-label={label}
            className="w-full"
          />
        )

      case "multiselect":
        return (
          <Select
            mode="multiple"
            value={props.value}
            onChange={(val) => props.onChange(val as string[])}
            options={props.options}
            aria-label={label}
            className="w-full"
          />
        )

      case "switch":
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={props.value}
              onChange={props.onChange}
              aria-label={label}
            />
            <span className="text-xs text-text">{label}</span>
          </div>
        )

      case "textarea":
        return (
          <Input.TextArea
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            rows={props.rows ?? 3}
            aria-label={label}
          />
        )

      default:
        return null
    }
  }

  // Switch has label inline, others have label above
  if (props.type === "switch") {
    return (
      <div className="flex flex-col gap-1">
        {renderField()}
        {helper && (
          <span className="text-[11px] text-text-muted ml-10">{helper}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text">{label}</span>
      {renderField()}
      {helper && <span className="text-[11px] text-text-muted">{helper}</span>}
    </div>
  )
})
