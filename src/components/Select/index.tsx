import React, { useState, useRef, useEffect, useMemo } from "react"
import { Search, RotateCw, ChevronDown } from "lucide-react"
import { LoadingIndicator } from "./LoadingIndicator"
import { Empty } from "antd"

export interface SelectOption {
  label: string | JSX.Element
  value: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange: (option: SelectOption) => void
  placeholder?: string
  onRefresh?: () => void
  className?: string
  dropdownClassName?: string
  optionClassName?: string
  searchClassName?: string
  disabled?: boolean
  isLoading?: boolean
  loadingText?: string
  filterOption?: (input: string, option: SelectOption) => boolean
}

export const PageAssistSelect: React.FC<SelectProps> = ({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  onRefresh,
  className = "",
  dropdownClassName = "",
  optionClassName = "",
  searchClassName = "",
  disabled = false,
  isLoading = false,
  loadingText = "Loading...",
  filterOption
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredOptions, setFilteredOptions] = useState<SelectOption[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const optionsContainerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    try {
      if (isOpen && optionsContainerRef.current && value) {
        const selectedOptionElement = optionsContainerRef.current.querySelector(
          `[data-value="${value}"]`
        )
        if (selectedOptionElement) {
          selectedOptionElement.scrollIntoView({ block: "nearest" })
        }
      }
    } catch (error) {
      console.error("Error scrolling to selected option:", error)
    }
    
  }, [isOpen, value])

  useEffect(() => {
    if (!options) return

    const filtered = options.filter((option) => {
      if (!searchTerm) return true

      if (filterOption) {
        return filterOption(searchTerm, option)
      }

      if (typeof option.label === "string") {
        return option.label.toLowerCase().includes(searchTerm.toLowerCase())
      }

      if (React.isValidElement(option.label)) {
        const textContent = extractTextFromJSX(option.label)
        return textContent.toLowerCase().includes(searchTerm.toLowerCase())
      }

      return false
    })
    setFilteredOptions(filtered)
    setActiveIndex(-1)
  }, [searchTerm, options, filterOption])

  const extractTextFromJSX = (element: React.ReactElement): string => {
    if (typeof element.props.children === "string") {
      return element.props.children
    }

    if (Array.isArray(element.props.children)) {
      return element.props.children
        .map((child) => {
          if (typeof child === "string") return child
          if (React.isValidElement(child)) return extractTextFromJSX(child)
          return ""
        })
        .join(" ")
    }

    if (React.isValidElement(element.props.children)) {
      return extractTextFromJSX(element.props.children)
    }

    return ""
  }

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRefresh?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || isLoading) return

    switch (e.key) {
      case "Enter":
        if (isOpen && activeIndex >= 0) {
          e.preventDefault()
          const selectedOption = filteredOptions[activeIndex]
          if (selectedOption) {
            onChange(selectedOption)
            setIsOpen(false)
            setSearchTerm("")
          }
        } else {
          setIsOpen(!isOpen)
        }
        break
      case " ":
        if (!isOpen) {
          e.preventDefault()
          setIsOpen(true)
        }
        break
      case "Escape":
        setIsOpen(false)
        break
      case "ArrowDown":
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setActiveIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          )
        }
        break
      case "ArrowUp":
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
    }
  }

  const defaultSelectClass = `
    flex items-center justify-between p-2.5 rounded-lg border
    ${disabled || isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
    ${isOpen ? "ring-2 ring-focus" : ""}
    bg-surface border-border text-text
    transition-all duration-200
  `

  const defaultDropdownClass = `
    absolute z-50 w-full mt-1 bg-surface text-text rounded-lg shadow-lg 
    border border-border
  `

  const defaultSearchClass = `
    w-full pl-8 pr-8 py-1.5 rounded-md
    bg-surface2 border border-border
    focus:outline-none focus:ring-2 focus:ring-focus
    text-text placeholder:text-text-subtle
  `

  const defaultOptionClass = `
    p-2 cursor-pointer transition-colors duration-150
  `

  const selectedOption = useMemo(() => {
    if (!value || !options) return null
    return options?.find((opt) => opt.value === value)
  }, [value, options])

  if (!options) {
    return (
      <div className={`relative w-full ${className}`}>
        <div className={`${defaultSelectClass} ${className}`}>
          <LoadingIndicator />
          <span>{loadingText}</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="select-dropdown"
        aria-label={placeholder}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`${defaultSelectClass} ${className}`}>
        <span className="!truncate flex items-center gap-2 select-none">
          {isLoading && <LoadingIndicator  />}
          {isLoading ? (
            loadingText
          ) : selectedOption ? (
            selectedOption.label
          ) : (
            <span className="text-text-subtle font-semibold text-[14px]">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </div>

      {isOpen && (
        <div
          id="select-dropdown"
          role="listbox"
          className={`${defaultDropdownClass} ${dropdownClassName}`}>
          <div className="p-2 border-b border-border">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className={`${defaultSearchClass} ${searchClassName}`}
                disabled={isLoading}
                aria-label="Search options"
              />
                <Search
                  aria-hidden="true"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-subtle"
                />
              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  aria-label="Refresh options"
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2
                    hover:text-primary transition-colors duration-200
                    ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}>
                  <RotateCw
                    aria-hidden="true"
                    className={`w-4 h-4 text-text-subtle ${isLoading ? "animate-spin" : ""}`}
                  />
                </button>
              )}{" "}
            </div>
          </div>

          <div
            ref={optionsContainerRef}
            className="max-h-60 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-4 text-center text-text-muted flex items-center justify-center gap-2">
                <LoadingIndicator />
                <span>{loadingText}</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-6">
                <Empty />
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={value === option.value}
                  data-value={option.value}
                  onClick={() => {
                    onChange(option)
                    setIsOpen(false)
                    setSearchTerm("")
                  }}
                  className={`
                    ${defaultOptionClass}
                    ${value === option.value ? "bg-primary/10" : "hover:bg-surface2"}
                    ${activeIndex === index ? "bg-surface2" : ""}
                    ${optionClassName}`}>
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
