import React, { useEffect, useState } from "react"
import { Collapse, Form, Input, Modal, Switch, message } from "antd"
import { useTranslation } from "react-i18next"
import { createWatchlistJob, updateWatchlistJob } from "@/services/watchlists"
import type {
  JobScope,
  WatchlistFilter,
  WatchlistJob,
  WatchlistJobCreate
} from "@/types/watchlists"
import { ScopeSelector } from "./ScopeSelector"
import { FilterBuilder } from "./FilterBuilder"
import { SchedulePicker } from "./SchedulePicker"

interface JobFormModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initialValues?: WatchlistJob
}

interface FormValues {
  name: string
  description: string
  active: boolean
}

export const JobFormModal: React.FC<JobFormModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialValues
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)

  const isEditing = !!initialValues

  // Managed state for complex fields
  const [scope, setScope] = useState<JobScope>({})
  const [filters, setFilters] = useState<WatchlistFilter[]>([])
  const [schedule, setSchedule] = useState<string | null>(null)
  const [timezone, setTimezone] = useState("UTC")

  // Reset form when modal opens/closes or initialValues change
  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          name: initialValues.name,
          description: initialValues.description || "",
          active: initialValues.active
        })
        setScope(initialValues.scope || {})
        setFilters(initialValues.job_filters?.filters || [])
        setSchedule(initialValues.schedule_expr || null)
        setTimezone(initialValues.timezone || "UTC")
      } else {
        form.resetFields()
        form.setFieldsValue({
          name: "",
          description: "",
          active: true
        })
        setScope({})
        setFilters([])
        setSchedule(null)
        setTimezone("UTC")
      }
    }
  }, [open, initialValues, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // Validate scope
      const hasScope =
        (scope.sources?.length ?? 0) > 0 ||
        (scope.groups?.length ?? 0) > 0 ||
        (scope.tags?.length ?? 0) > 0

      if (!hasScope) {
        message.error(t("watchlists:jobs.form.scopeRequired", "Please select at least one source, group, or tag"))
        return
      }

      setSubmitting(true)

      const jobData: WatchlistJobCreate = {
        name: values.name,
        description: values.description || undefined,
        active: values.active,
        scope,
        schedule_expr: schedule || undefined,
        timezone: timezone || undefined,
        job_filters: filters.length > 0 ? { filters } : undefined
      }

      if (isEditing && initialValues) {
        await updateWatchlistJob(initialValues.id, jobData)
        message.success(t("watchlists:jobs.updated", "Job updated"))
      } else {
        await createWatchlistJob(jobData)
        message.success(t("watchlists:jobs.created", "Job created"))
      }

      onSuccess()
    } catch (err) {
      console.error("Form submit error:", err)
      if (err && typeof err === "object" && "errorFields" in err) {
        // Validation error - handled by form
        return
      }
      message.error(t("watchlists:jobs.saveError", "Failed to save job"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  const collapseItems = [
    {
      key: "scope",
      label: (
        <span className="font-medium">
          {t("watchlists:jobs.form.scope", "Scope")}
          <span className="text-red-500 ml-1">*</span>
        </span>
      ),
      children: <ScopeSelector value={scope} onChange={setScope} />,
      forceRender: true
    },
    {
      key: "schedule",
      label: (
        <span className="font-medium">
          {t("watchlists:jobs.form.schedule", "Schedule")}
        </span>
      ),
      children: (
        <SchedulePicker
          value={schedule}
          onChange={setSchedule}
          timezone={timezone}
          onTimezoneChange={setTimezone}
        />
      )
    },
    {
      key: "filters",
      label: (
        <span className="font-medium">
          {t("watchlists:jobs.form.filters", "Filters")}
          {filters.length > 0 && (
            <span className="ml-2 text-zinc-500">({filters.length})</span>
          )}
        </span>
      ),
      children: <FilterBuilder value={filters} onChange={setFilters} />
    }
  ]

  return (
    <Modal
      title={
        isEditing
          ? t("watchlists:jobs.editJob", "Edit Job")
          : t("watchlists:jobs.addJob", "Add Job")
      }
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={isEditing ? t("common:save", "Save") : t("common:create", "Create")}
      cancelText={t("common:cancel", "Cancel")}
      confirmLoading={submitting}
      destroyOnClose
      width={700}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="name"
          label={t("watchlists:jobs.form.name", "Name")}
          rules={[
            {
              required: true,
              message: t("watchlists:jobs.form.nameRequired", "Please enter a name")
            },
            {
              max: 200,
              message: t("watchlists:jobs.form.nameTooLong", "Name must be less than 200 characters")
            }
          ]}
        >
          <Input
            placeholder={t("watchlists:jobs.form.namePlaceholder", "e.g., Daily Tech News")}
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={t("watchlists:jobs.form.description", "Description")}
        >
          <Input.TextArea
            placeholder={t(
              "watchlists:jobs.form.descriptionPlaceholder",
              "Optional description of what this job does"
            )}
            rows={2}
          />
        </Form.Item>

        <Form.Item
          name="active"
          label={t("watchlists:jobs.form.active", "Active")}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>

      <Collapse
        items={collapseItems}
        defaultActiveKey={["scope"]}
        className="mt-4"
        expandIconPosition="end"
      />
    </Modal>
  )
}
