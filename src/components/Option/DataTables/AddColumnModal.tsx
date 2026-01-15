import React, { useEffect } from "react"
import { Form, Input, Modal, Select } from "antd"
import { useTranslation } from "react-i18next"
import type { ColumnType, DataTableColumn } from "@/types/data-tables"

interface AddColumnModalProps {
  open: boolean
  onClose: () => void
  onAdd: (column: DataTableColumn) => void
  existingColumns: DataTableColumn[]
}

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "boolean", label: "Boolean (Yes/No)" },
  { value: "currency", label: "Currency" }
]

/**
 * AddColumnModal
 *
 * Modal for adding a new column to the table.
 */
export const AddColumnModal: React.FC<AddColumnModalProps> = ({
  open,
  onClose,
  onAdd,
  existingColumns
}) => {
  const { t } = useTranslation(["dataTables", "common"])
  const [form] = Form.useForm()

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields()
    }
  }, [open, form])

  // Handle submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const column: DataTableColumn = {
        id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: values.name.trim(),
        type: values.type,
        description: values.description?.trim() || undefined
      }
      onAdd(column)
      form.resetFields()
    } catch {
      // Validation failed
    }
  }

  // Validate column name is unique
  const validateUniqueName = (_: any, value: string) => {
    if (!value) return Promise.resolve()
    const trimmed = value.trim().toLowerCase()
    const exists = existingColumns.some(
      (col) => col.name.toLowerCase() === trimmed
    )
    if (exists) {
      return Promise.reject(
        new Error(
          t("dataTables:columnNameExists", "A column with this name already exists")
        )
      )
    }
    return Promise.resolve()
  }

  return (
    <Modal
      title={t("dataTables:addColumn", "Add Column")}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={t("dataTables:add", "Add")}
      cancelText={t("common:cancel", "Cancel")}
      destroyOnClose
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="name"
          label={t("dataTables:columnName", "Column Name")}
          rules={[
            {
              required: true,
              message: t("dataTables:columnNameRequired", "Please enter a column name")
            },
            {
              max: 50,
              message: t(
                "dataTables:columnNameTooLong",
                "Column name must be 50 characters or less"
              )
            },
            { validator: validateUniqueName }
          ]}
        >
          <Input
            placeholder={t("dataTables:columnNamePlaceholder", "e.g., Price, Status, Date")}
            maxLength={50}
          />
        </Form.Item>

        <Form.Item
          name="type"
          label={t("dataTables:columnType", "Column Type")}
          initialValue="text"
          rules={[
            {
              required: true,
              message: t("dataTables:columnTypeRequired", "Please select a column type")
            }
          ]}
        >
          <Select options={COLUMN_TYPES} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t("dataTables:columnDescription", "Description (optional)")}
          extra={t(
            "dataTables:columnDescriptionHint",
            "A brief description of what this column contains"
          )}
        >
          <Input.TextArea
            rows={2}
            placeholder={t(
              "dataTables:columnDescriptionPlaceholder",
              "e.g., The price of the item in USD"
            )}
            maxLength={200}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
