"use client"

import {
  type VendorQuestionField,
  type VendorQuestionOption,
} from "@lib/data/vendor-client"
import {
  Badge,
  Input,
  Label,
  RadioGroup,
  Select,
  Switch,
  Text,
  Textarea,
} from "@medusajs/ui"
import { useState } from "react"
import { ArrowUpTray, CheckCircleSolid, DocumentText, Photo } from "@medusajs/icons"

interface DynamicFieldProps {
  field: VendorQuestionField
  value: any
  onChange: (val: any) => void
  error?: string
}

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  error,
}: DynamicFieldProps) {
  const [uploading, setUploading] = useState(false)

  // Resolve options (expand dynamic range strings if present)
  let resolvedOptions: VendorQuestionOption[] = []
  if (Array.isArray(field.options)) {
    resolvedOptions = field.options
  } else if (typeof field.options === "string" && field.options.startsWith("YEAR_RANGE:")) {
    const parts = field.options.split(":")
    const startYear = parseInt(parts[1], 10) || 1950
    const currentYear = new Date().getFullYear()
    for (let y = currentYear; y >= startYear; y--) {
      resolvedOptions.push({ label: String(y), value: String(y) })
    }
  }

  const normalizedType = String(field.type || "text").toUpperCase()
  const helpText = field.helpText || field.description

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i])
      }

      const res = await fetch("/api/vendors/uploads", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const json = await res.json()
      const uploadedUrls = (json.files || []).map((f: any) => f.url)

      if (normalizedType === "IMAGE" && (field.minCount && field.minCount > 1)) {
        // Multi-image list
        const currentList = Array.isArray(value) ? value : value ? [value] : []
        onChange([...currentList, ...uploadedUrls])
      } else {
        onChange(uploadedUrls[0] || URL.createObjectURL(files[0]))
      }
    } catch {
      // Local fallback representation if upload service is offline
      const names = Array.from(files).map((f) => f.name)
      if (normalizedType === "IMAGE" && (field.minCount && field.minCount > 1)) {
        const currentList = Array.isArray(value) ? value : value ? [value] : []
        onChange([...currentList, ...names])
      } else {
        onChange(names[0])
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-1.5">
      <div className="flex flex-col gap-y-0.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.id} className="text-ui-fg-base font-semibold text-xs flex items-center gap-x-1">
            {field.label}
            {field.required ? (
              <span className="text-ui-fg-error" title="Required">*</span>
            ) : null}
          </Label>
          {field.minCount ? (
            <span className="text-[11px] text-ui-fg-muted font-medium">
              (Min {field.minCount} required)
            </span>
          ) : null}
        </div>
        {helpText ? (
          <Text size="xsmall" className="text-ui-fg-subtle text-[11px] leading-relaxed">
            {helpText}
          </Text>
        ) : null}
      </div>

      {/* TEXT, EMAIL, PHONE */}
      {(normalizedType === "TEXT" || normalizedType === "EMAIL" || normalizedType === "PHONE") && (
        <Input
          id={field.id}
          type={normalizedType === "EMAIL" ? "email" : normalizedType === "PHONE" ? "tel" : "text"}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* TEXTAREA */}
      {normalizedType === "TEXTAREA" && (
        <Textarea
          id={field.id}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          aria-invalid={!!error}
        />
      )}

      {/* NUMBER */}
      {normalizedType === "NUMBER" && (
        <Input
          id={field.id}
          type="number"
          placeholder={field.placeholder ?? "0"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.valueAsNumber || e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* DATE */}
      {normalizedType === "DATE" && (
        <Input
          id={field.id}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* BOOLEAN / YES/NO */}
      {(normalizedType === "BOOLEAN" || normalizedType === "YES/NO") && (
        <div className="flex items-center gap-x-3 py-1">
          <Switch
            id={field.id}
            checked={Boolean(value)}
            onCheckedChange={onChange}
          />
          <Text size="small" className="text-ui-fg-base font-medium text-xs">
            {Boolean(value) ? "Yes / Available" : "No / Not Available"}
          </Text>
        </div>
      )}

      {/* SELECT / DROPDOWN */}
      {(normalizedType === "SELECT" || normalizedType === "DROPDOWN") && (
        <Select
          value={value ? String(value) : undefined}
          onValueChange={onChange}
        >
          <Select.Trigger id={field.id}>
            <Select.Value placeholder={field.placeholder ?? "Select an option"} />
          </Select.Trigger>
          <Select.Content>
            {resolvedOptions.map((opt) => (
              <Select.Item key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )}

      {/* RADIO */}
      {normalizedType === "RADIO" && (
        <RadioGroup
          value={value ? String(value) : undefined}
          onValueChange={onChange}
          className="flex flex-col gap-y-2 pt-1"
        >
          {resolvedOptions.map((opt) => (
            <div key={opt.value} className="flex items-center gap-x-2">
              <RadioGroup.Item value={opt.value} id={`${field.id}-${opt.value}`} />
              <Label htmlFor={`${field.id}-${opt.value}`} className="text-xs text-ui-fg-base cursor-pointer">
                {opt.label}
                {opt.description ? (
                  <span className="text-ui-fg-muted block text-[11px]">{opt.description}</span>
                ) : null}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {/* MULTI_SELECT */}
      {normalizedType === "MULTI_SELECT" && (
        <div className="flex flex-wrap gap-2 pt-1">
          {resolvedOptions.map((opt) => {
            const currentArray: string[] = Array.isArray(value) ? value : []
            const isSelected = currentArray.includes(opt.value)

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onChange(currentArray.filter((v) => v !== opt.value))
                  } else {
                    onChange([...currentArray, opt.value])
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-ui-button-inverted text-ui-fg-on-inverted border-transparent shadow-sm"
                    : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-subtle-hover"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ADDRESS / LOCATION_GEO */}
      {(normalizedType === "ADDRESS" || normalizedType === "LOCATION_GEO") && (
        <Input
          id={field.id}
          placeholder={field.placeholder ?? "Full address including building, street, locality and pincode"}
          value={typeof value === "object" ? value?.address ?? "" : value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* OPERATING_HOURS */}
      {normalizedType === "OPERATING_HOURS" && (
        <Input
          id={field.id}
          placeholder={field.placeholder ?? "e.g. Mon-Sat: 9:00 AM - 9:00 PM, Sun: 10:00 AM - 6:00 PM"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* IMAGE / FILE_UPLOAD */}
      {(normalizedType === "IMAGE" || normalizedType === "FILE_UPLOAD") && (
        <div className="flex flex-col gap-y-2">
          {/* If multi-image list */}
          {Array.isArray(value) && value.length > 0 ? (
            <div className="flex flex-col gap-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {value.map((itemUrl: string, idx: number) => (
                  <div
                    key={idx}
                    className="relative group flex items-center justify-between p-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-xs"
                  >
                    <div className="flex items-center gap-x-1.5 truncate">
                      <Photo className="text-ui-fg-interactive shrink-0 h-4 w-4" />
                      <span className="truncate">{itemUrl.split("/").pop()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(value.filter((_: any, i: number) => i !== idx))}
                      className="text-ui-fg-error hover:underline text-[11px] ml-1 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex items-center justify-center p-2.5 border border-dashed border-ui-border-strong hover:border-ui-border-interactive rounded-lg cursor-pointer bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors text-xs font-medium text-ui-fg-interactive">
                <ArrowUpTray className="h-3.5 w-3.5 mr-1" />
                {uploading ? "Uploading..." : "Add more photos"}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          ) : value && typeof value === "string" ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
              <div className="flex items-center gap-x-2 truncate">
                {normalizedType === "IMAGE" ? (
                  <Photo className="text-ui-fg-interactive shrink-0 h-4 w-4" />
                ) : (
                  <DocumentText className="text-ui-fg-interactive shrink-0 h-4 w-4" />
                )}
                <span className="text-xs text-ui-fg-base truncate font-medium">
                  {value.split("/").pop()}
                </span>
                <Badge color="green" size="xsmall">Uploaded</Badge>
              </div>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-ui-fg-error hover:underline ml-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-4 border border-dashed border-ui-border-strong hover:border-ui-border-interactive rounded-lg cursor-pointer bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover transition-colors">
              <ArrowUpTray className="text-ui-fg-muted mb-1 h-5 w-5" />
              <span className="text-xs font-medium text-ui-fg-base">
                {uploading ? "Uploading..." : `Click to upload ${field.label.toLowerCase()}`}
              </span>
              <span className="text-[11px] text-ui-fg-muted">
                {normalizedType === "IMAGE" ? "PNG, JPG or WebP (min 3 photos recommended)" : "PDF, PNG, JPG or DOCX up to 10MB"}
              </span>
              <input
                type="file"
                multiple={normalizedType === "IMAGE"}
                accept={normalizedType === "IMAGE" ? "image/*" : "*"}
                className="hidden"
                disabled={uploading}
                onChange={handleFileUpload}
              />
            </label>
          )}
        </div>
      )}

      {error ? (
        <Text size="xsmall" className="text-ui-fg-error font-medium">
          {error}
        </Text>
      ) : null}
    </div>
  )
}

