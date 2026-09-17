"use client"

import {
  type VendorQuestionField,
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
import { ArrowUpTray, CheckCircleSolid, DocumentText } from "@medusajs/icons"

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("files", file)

      const res = await fetch("/api/vendors/uploads", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        throw new Error("Upload failed")
      }

      const json = await res.json()
      const fileUrl = json.files?.[0]?.url || URL.createObjectURL(file)
      onChange(fileUrl)
    } catch {
      // Local fallback representation if upload service is offline
      onChange(file.name)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={field.id} className="text-ui-fg-base font-medium text-xs flex items-center gap-x-1">
          {field.label}
          {field.required ? (
            <span className="text-ui-fg-error" title="Required">*</span>
          ) : (
            <span className="text-ui-fg-muted text-[10px] font-normal">(Optional)</span>
          )}
        </Label>
        {field.description ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {field.description}
          </Text>
        ) : null}
      </div>

      {field.type === "TEXT" && (
        <Input
          id={field.id}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {field.type === "TEXTAREA" && (
        <Textarea
          id={field.id}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          aria-invalid={!!error}
        />
      )}

      {field.type === "NUMBER" && (
        <Input
          id={field.id}
          type="number"
          placeholder={field.placeholder ?? "0"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.valueAsNumber || e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {field.type === "DATE" && (
        <Input
          id={field.id}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {field.type === "BOOLEAN" && (
        <div className="flex items-center gap-x-2 py-1">
          <Switch
            id={field.id}
            checked={Boolean(value)}
            onCheckedChange={onChange}
          />
          <Text size="small" className="text-ui-fg-subtle">
            {Boolean(value) ? "Yes / Enabled" : "No / Disabled"}
          </Text>
        </div>
      )}

      {field.type === "SELECT" && (
        <Select
          value={value ? String(value) : undefined}
          onValueChange={onChange}
        >
          <Select.Trigger id={field.id}>
            <Select.Value placeholder={field.placeholder ?? "Select an option"} />
          </Select.Trigger>
          <Select.Content>
            {(field.options || []).map((opt) => (
              <Select.Item key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )}

      {field.type === "RADIO" && (
        <RadioGroup
          value={value ? String(value) : undefined}
          onValueChange={onChange}
          className="flex flex-col gap-y-2 pt-1"
        >
          {(field.options || []).map((opt) => (
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

      {field.type === "MULTI_SELECT" && (
        <div className="flex flex-wrap gap-2 pt-1">
          {(field.options || []).map((opt) => {
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
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  isSelected
                    ? "bg-ui-button-inverted text-ui-fg-on-inverted border-transparent"
                    : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-subtle-hover"
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {field.type === "LOCATION_GEO" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-3">
            <Input
              id={`${field.id}-address`}
              placeholder="Full physical street address"
              value={typeof value === "object" ? value?.address ?? "" : value ?? ""}
              onChange={(e) =>
                onChange({
                  ...(typeof value === "object" ? value : {}),
                  address: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Input
              placeholder="City / Region"
              value={typeof value === "object" ? value?.city ?? "" : ""}
              onChange={(e) =>
                onChange({
                  ...(typeof value === "object" ? value : {}),
                  city: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Input
              placeholder="Postal / Zip code"
              value={typeof value === "object" ? value?.postalCode ?? "" : ""}
              onChange={(e) =>
                onChange({
                  ...(typeof value === "object" ? value : {}),
                  postalCode: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Input
              placeholder="Country"
              value={typeof value === "object" ? value?.country ?? "" : ""}
              onChange={(e) =>
                onChange({
                  ...(typeof value === "object" ? value : {}),
                  country: e.target.value,
                })
              }
            />
          </div>
        </div>
      )}

      {field.type === "FILE_UPLOAD" && (
        <div className="flex flex-col gap-y-2">
          {value ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
              <div className="flex items-center gap-x-2 truncate">
                <DocumentText className="text-ui-fg-interactive shrink-0" />
                <span className="text-xs text-ui-fg-base truncate font-medium">
                  {typeof value === "string" ? value.split("/").pop() : "Uploaded document"}
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
              <ArrowUpTray className="text-ui-fg-muted mb-1" />
              <span className="text-xs font-medium text-ui-fg-base">
                {uploading ? "Uploading document..." : "Click to upload document or file"}
              </span>
              <span className="text-[11px] text-ui-fg-muted">
                PDF, PNG, JPG or DOCX up to 10MB
              </span>
              <input
                type="file"
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
