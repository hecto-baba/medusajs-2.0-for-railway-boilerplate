"use client"

import {
  type VendorQuestionField,
  type VendorQuestionOption,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Input,
  Label,
  RadioGroup,
  Select,
  Switch,
  Text,
  Textarea,
} from "@medusajs/ui"
import { useState } from "react"
import {
  ArrowUpTray,
  DocumentText,
  MapPin,
  Photo,
  Plus,
  XMarkMini,
} from "@medusajs/icons"

interface DynamicFieldProps {
  field: VendorQuestionField
  value: any
  onChange: (val: any) => void
  error?: string
}

const DEFAULT_POPULAR_CITIES = [
  "Mumbai",
  "Delhi NCR",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Surat",
  "Lucknow",
  "Chandigarh",
  "Kochi",
  "Indore",
  "Noida",
  "Gurugram",
  "Goa",
  "Bhopal",
  "Patna",
  "Nagpur",
]

/**
 * Interactive Multi-City / Location Picker Component
 * Supports both typing custom cities (with Enter/comma separation)
 * and 1-click toggling from popular/suggested city chips.
 */
function LocationPickerField({
  id,
  field,
  value,
  onChange,
  error,
  resolvedOptions,
}: {
  id?: string
  field: VendorQuestionField
  value: any
  onChange: (val: string[]) => void
  error?: string
  resolvedOptions: VendorQuestionOption[]
}) {
  const [cityInput, setCityInput] = useState("")

  // Normalize initial value to string[]
  const selectedCities: string[] = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const handleAddCity = (rawInput?: string) => {
    const textToAdd = (rawInput ?? cityInput).trim()
    if (!textToAdd) return

    // Split by comma in case user pastes or types "Mumbai, Pune, Nashik"
    const newItems = textToAdd
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    const updated = Array.from(new Set([...selectedCities, ...newItems]))
    onChange(updated)
    setCityInput("")
  }

  const handleRemoveCity = (cityToRemove: string) => {
    onChange(selectedCities.filter((c) => c !== cityToRemove))
  }

  const handleToggleCity = (city: string) => {
    if (selectedCities.includes(city)) {
      handleRemoveCity(city)
    } else {
      onChange([...selectedCities, city])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      handleAddCity()
    }
  }

  const suggestions =
    resolvedOptions.length > 0
      ? resolvedOptions.map((o) => o.label || o.value)
      : DEFAULT_POPULAR_CITIES

  return (
    <div className="flex flex-col gap-y-2.5 pt-0.5" id={id}>
      {/* Input bar to add custom city */}
      <div className="flex items-center gap-x-2">
        <div className="relative flex-1">
          <Input
            placeholder={
              field.placeholder ??
              "Type city/region name and press Enter (e.g. Mumbai, Pune)..."
            }
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-invalid={!!error}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => handleAddCity()}
          disabled={!cityInput.trim()}
          className="shrink-0 flex items-center gap-x-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Selected Cities Display */}
      {selectedCities.length > 0 && (
        <div className="flex flex-col gap-y-1.5 p-2.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ui-fg-subtle flex items-center gap-x-1">
              <MapPin className="h-3.5 w-3.5 text-ui-fg-interactive" />
              Selected Cities ({selectedCities.length})
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-ui-fg-muted hover:text-ui-fg-error transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedCities.map((city) => (
              <span
                key={city}
                className="inline-flex items-center gap-x-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-ui-bg-base text-ui-fg-base border border-ui-border-base shadow-2xs"
              >
                <MapPin className="h-3 w-3 text-ui-fg-interactive shrink-0" />
                <span>{city}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCity(city)}
                  className="text-ui-fg-muted hover:text-ui-fg-error transition-colors ml-0.5 rounded-full p-0.5 hover:bg-ui-bg-subtle"
                  title={`Remove ${city}`}
                >
                  <XMarkMini className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick suggestions */}
      <div className="flex flex-col gap-y-1 pt-1">
        <span className="text-[11px] font-medium text-ui-fg-muted">
          Quick suggestions (click to add/remove):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((city) => {
            const isSelected = selectedCities.includes(city)
            return (
              <button
                key={city}
                type="button"
                onClick={() => handleToggleCity(city)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors flex items-center gap-x-1 ${
                  isSelected
                    ? "bg-ui-bg-interactive text-ui-fg-on-color border-transparent shadow-xs"
                    : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-subtle-hover hover:text-ui-fg-base"
                }`}
              >
                {isSelected ? "✓ " : "+ "}
                {city}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
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
  } else if (
    typeof field.options === "string" &&
    field.options.startsWith("YEAR_RANGE:")
  ) {
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

      if (
        normalizedType === "IMAGE" &&
        field.minCount &&
        field.minCount > 1
      ) {
        // Multi-image list
        const currentList = Array.isArray(value) ? value : value ? [value] : []
        onChange([...currentList, ...uploadedUrls])
      } else {
        onChange(uploadedUrls[0] || URL.createObjectURL(files[0]))
      }
    } catch {
      // Local fallback representation if upload service is offline
      const names = Array.from(files).map((f) => f.name)
      if (
        normalizedType === "IMAGE" &&
        field.minCount &&
        field.minCount > 1
      ) {
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
          <Label
            htmlFor={field.id}
            className="text-ui-fg-base font-semibold text-xs flex items-center gap-x-1"
          >
            {field.label}
            {field.required ? (
              <span className="text-ui-fg-error" title="Required">
                *
              </span>
            ) : null}
          </Label>
          {field.minCount ? (
            <span className="text-[11px] text-ui-fg-muted font-medium">
              (Min {field.minCount} required)
            </span>
          ) : null}
        </div>
        {helpText ? (
          <Text
            size="xsmall"
            className="text-ui-fg-subtle text-[11px] leading-relaxed"
          >
            {helpText}
          </Text>
        ) : null}
      </div>

      {/* LOCATION_PICKER / CITIES */}
      {(normalizedType === "LOCATION_PICKER" ||
        normalizedType === "CITIES" ||
        normalizedType === "CITY_PICKER") && (
        <LocationPickerField
          id={field.id}
          field={field}
          value={value}
          onChange={onChange}
          error={error}
          resolvedOptions={resolvedOptions}
        />
      )}

      {/* TEXT, EMAIL, PHONE */}
      {(normalizedType === "TEXT" ||
        normalizedType === "EMAIL" ||
        normalizedType === "PHONE") && (
        <Input
          id={field.id}
          type={
            normalizedType === "EMAIL"
              ? "email"
              : normalizedType === "PHONE"
              ? "tel"
              : "text"
          }
          placeholder={
            field.placeholder ?? `Enter ${field.label.toLowerCase()}`
          }
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* TEXTAREA */}
      {normalizedType === "TEXTAREA" && (
        <Textarea
          id={field.id}
          placeholder={
            field.placeholder ?? `Enter ${field.label.toLowerCase()}`
          }
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
            <Select.Value
              placeholder={field.placeholder ?? "Select an option"}
            />
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
              <RadioGroup.Item
                value={opt.value}
                id={`${field.id}-${opt.value}`}
              />
              <Label
                htmlFor={`${field.id}-${opt.value}`}
                className="text-xs text-ui-fg-base cursor-pointer"
              >
                {opt.label}
                {opt.description ? (
                  <span className="text-ui-fg-muted block text-[11px]">
                    {opt.description}
                  </span>
                ) : null}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {/* MULTI_SELECT */}
      {normalizedType === "MULTI_SELECT" && (
        <div className="flex flex-col gap-y-2 pt-1">
          {resolvedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {resolvedOptions.map((opt) => {
                const currentArray: string[] = Array.isArray(value)
                  ? value
                  : []
                const isSelected = currentArray.includes(opt.value)

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onChange(
                          currentArray.filter((v) => v !== opt.value)
                        )
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
          ) : (
            <LocationPickerField
              id={field.id}
              field={field}
              value={value}
              onChange={onChange}
              error={error}
              resolvedOptions={resolvedOptions}
            />
          )}
        </div>
      )}

      {/* ADDRESS / LOCATION_GEO */}
      {(normalizedType === "ADDRESS" ||
        normalizedType === "LOCATION_GEO") && (
        <Input
          id={field.id}
          placeholder={
            field.placeholder ??
            "Full address including building, street, locality and pincode"
          }
          value={
            typeof value === "object" ? value?.address ?? "" : value ?? ""
          }
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* OPERATING_HOURS */}
      {normalizedType === "OPERATING_HOURS" && (
        <Input
          id={field.id}
          placeholder={
            field.placeholder ??
            "e.g. Mon-Sat: 9:00 AM - 9:00 PM, Sun: 10:00 AM - 6:00 PM"
          }
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      )}

      {/* IMAGE / FILE_UPLOAD */}
      {(normalizedType === "IMAGE" ||
        normalizedType === "FILE_UPLOAD") && (
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
                      <span className="truncate">
                        {itemUrl.split("/").pop()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          value.filter((_: any, i: number) => i !== idx)
                        )
                      }
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
                <Badge color="green" size="xsmall">
                  Uploaded
                </Badge>
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
                {uploading
                  ? "Uploading..."
                  : `Click to upload ${field.label.toLowerCase()}`}
              </span>
              <span className="text-[11px] text-ui-fg-muted">
                {normalizedType === "IMAGE"
                  ? "PNG, JPG or WebP (min 3 photos recommended)"
                  : "PDF, PNG, JPG or DOCX up to 10MB"}
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


