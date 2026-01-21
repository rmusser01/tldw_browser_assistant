import React from 'react'
import type { TFunction } from 'i18next'
import { Button, Checkbox, Input, Modal, Typography } from 'antd'

type KeywordPickerModalProps = {
  open: boolean
  availableKeywords: string[]
  filteredKeywordPickerOptions: string[]
  keywordPickerQuery: string
  keywordPickerSelection: string[]
  onCancel: () => void
  onApply: () => void
  onQueryChange: (value: string) => void
  onSelectionChange: (values: string[]) => void
  onSelectAll: () => void
  onClear: () => void
  t: TFunction
}

const KeywordPickerModal: React.FC<KeywordPickerModalProps> = ({
  open,
  availableKeywords,
  filteredKeywordPickerOptions,
  keywordPickerQuery,
  keywordPickerSelection,
  onCancel,
  onApply,
  onQueryChange,
  onSelectionChange,
  onSelectAll,
  onClear,
  t
}) => (
  <Modal
    open={open}
    title={t('option:notesSearch.keywordPickerTitle', {
      defaultValue: 'Browse keywords'
    })}
    onCancel={onCancel}
    onOk={onApply}
    okText={t('option:notesSearch.keywordPickerApply', {
      defaultValue: 'Apply filters'
    })}
    cancelText={t('common:cancel', { defaultValue: 'Cancel' })}
    destroyOnHidden
  >
    <div className="space-y-3">
      <Input
        allowClear
        placeholder={t('option:notesSearch.keywordPickerSearch', {
          defaultValue: 'Search keywords'
        })}
        value={keywordPickerQuery}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <Typography.Text type="secondary" className="text-xs text-text-muted">
          {t('option:notesSearch.keywordPickerCount', {
            defaultValue: '{{count}} keywords',
            count: availableKeywords.length
          })}
        </Typography.Text>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            onClick={onSelectAll}
            disabled={availableKeywords.length === 0}
          >
            {t('option:notesSearch.keywordPickerSelectAll', {
              defaultValue: 'Select all'
            })}
          </Button>
          <Button
            size="small"
            onClick={onClear}
            disabled={keywordPickerSelection.length === 0}
          >
            {t('option:notesSearch.keywordPickerClear', {
              defaultValue: 'Clear'
            })}
          </Button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto rounded-lg border border-border bg-surface2 p-3">
        {filteredKeywordPickerOptions.length === 0 ? (
          <Typography.Text
            type="secondary"
            className="block text-xs text-text-muted text-center"
          >
            {t('option:notesSearch.keywordPickerEmpty', {
              defaultValue: 'No keywords found'
            })}
          </Typography.Text>
        ) : (
          <Checkbox.Group
            value={keywordPickerSelection}
            onChange={(vals) => onSelectionChange(vals as string[])}
            className="w-full"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredKeywordPickerOptions.map((keyword) => (
                <Checkbox key={keyword} value={keyword}>
                  {keyword}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        )}
      </div>
    </div>
  </Modal>
)

export default KeywordPickerModal
