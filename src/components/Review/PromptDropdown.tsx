import React from "react"
import { Button, Dropdown, Input, List } from "antd"

import type { PromptSearchResult } from "@/components/Review/usePromptSearch"

type PromptPreset = {
  label: string
  value: string
}

type PromptDropdownProps = {
  triggerLabel: string
  searchLabel: string
  includeLocalLabel: string
  includeServerLabel: string
  presetsLabel: string
  systemPromptLabel: string
  userPrefixLabel: string
  saveDefaultsLabel: string
  query: string
  onQueryChange: (value: string) => void
  onSearch: (value: string) => void | Promise<void>
  loading: boolean
  results: PromptSearchResult[]
  onSelectResult: (result: PromptSearchResult) => void
  includeLocal: boolean
  onIncludeLocalChange: (value: boolean) => void
  includeServer: boolean
  onIncludeServerChange: (value: boolean) => void
  presets: PromptPreset[]
  systemPrompt: string
  onSystemPromptChange: (value: string) => void
  userPrefix: string
  onUserPrefixChange: (value: string) => void
  onSaveDefaults: () => void
}

export const PromptDropdown: React.FC<PromptDropdownProps> = ({
  triggerLabel,
  searchLabel,
  includeLocalLabel,
  includeServerLabel,
  presetsLabel,
  systemPromptLabel,
  userPrefixLabel,
  saveDefaultsLabel,
  query,
  onQueryChange,
  onSearch,
  loading,
  results,
  onSelectResult,
  includeLocal,
  onIncludeLocalChange,
  includeServer,
  onIncludeServerChange,
  presets,
  systemPrompt,
  onSystemPromptChange,
  userPrefix,
  onUserPrefixChange,
  onSaveDefaults
}) => {
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomLeft"
      popupRender={() => (
        <div className="p-2 w-[420px] bg-surface border border-border rounded shadow">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-text-muted">{searchLabel}</div>
            <div className="flex items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={includeLocal}
                  onChange={(e) => onIncludeLocalChange(e.target.checked)}
                />{" "}
                {includeLocalLabel}
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={includeServer}
                  onChange={(e) => onIncludeServerChange(e.target.checked)}
                />{" "}
                {includeServerLabel}
              </label>
            </div>
          </div>
          <Input.Search
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onSearch={onSearch}
            loading={loading}
            placeholder={searchLabel}
            allowClear
          />
          {results.length > 0 && (
            <div className="mt-2 max-h-40 overflow-auto rounded border border-border">
              <List
                size="small"
                dataSource={results}
                renderItem={(item) => (
                  <List.Item
                    className="!px-2 !py-1 hover:bg-surface2 cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelectResult(item)}>
                    <div className="truncate text-sm">{item.title}</div>
                  </List.Item>
                )}
              />
            </div>
          )}
          {presets.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-text-muted mb-1">{presetsLabel}</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    size="small"
                    onClick={() => onSystemPromptChange(preset.value)}>
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-text-muted mb-1">{systemPromptLabel}</div>
          <textarea
            className="w-full text-sm p-2 rounded border border-border mt-1"
            rows={4}
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
          />
          <div className="text-xs text-text-muted mt-2 mb-1">
            {userPrefixLabel}
          </div>
          <textarea
            className="w-full text-sm p-2 rounded border border-border"
            rows={3}
            value={userPrefix}
            onChange={(e) => onUserPrefixChange(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button size="small" onClick={onSaveDefaults}>
              {saveDefaultsLabel}
            </Button>
          </div>
        </div>
      )}>
      <button
        className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1 text-text hover:bg-surface2 "
        aria-haspopup="true">
        {triggerLabel}
      </button>
    </Dropdown>
  )
}
