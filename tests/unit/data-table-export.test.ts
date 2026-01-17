import { describe, expect, test } from "bun:test"
import type { DataTable } from "../../src/types/data-tables"
import {
  exportDataTableToJSON,
  exportToCSV,
  exportToExcel
} from "../../src/utils/data-table-export"

const makeSampleTable = (): DataTable => ({
  id: "table-1",
  name: "Sample Table",
  description: "Test table",
  prompt: "Generate a sample table",
  columns: [
    { id: "col-1", name: "Name", type: "text" },
    { id: "col-2", name: "Price", type: "number", format: "USD" }
  ],
  rows: [
    { Name: "Widget", Price: 10 },
    { Name: "Gadget", Price: 20 }
  ],
  sources: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  row_count: 2
})

describe("data table export", () => {
  test("exports CSV with headers and rows", async () => {
    const table = makeSampleTable()
    const blob = exportToCSV(table)
    const text = await blob.text()
    expect(text).toBe("Name,Price\nWidget,10\nGadget,20")
  })

  test("exports JSON with metadata", async () => {
    const table = makeSampleTable()
    const blob = exportDataTableToJSON(table)
    const data = JSON.parse(await blob.text())
    expect(data.name).toBe("Sample Table")
    expect(data.columns).toHaveLength(2)
    expect(data.rows[0]).toEqual({ Name: "Widget", Price: 10 })
    expect(data.metadata.row_count).toBe(2)
  })

  test("exports Excel workbook with values", async () => {
    const table = makeSampleTable()
    const blob = await exportToExcel(table)
    expect(blob.size).toBeGreaterThan(0)

    const XLSX = await import("xlsx")
    const buffer = await blob.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    expect(sheet.A1?.v).toBe("Name")
    expect(sheet.A2?.v).toBe("Widget")
    expect(sheet.B2?.v).toBe(10)
  })
})
