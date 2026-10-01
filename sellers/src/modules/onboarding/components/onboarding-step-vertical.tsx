"use client"

import {
  Badge,
  Button,
  Heading,
  Input,
  Label,
  Select,
  Text,
} from "@medusajs/ui"
import {
  useTaxonomySegments,
  useTaxonomyVendorTypes,
  useTaxonomyVendorCategories,
} from "../hooks/use-onboarding"
import { useState, useMemo } from "react"
import { BuildingStorefront, Buildings, Tag, Sparkles } from "@medusajs/icons"

interface StepVerticalProps {
  segmentId?: string
  vendorTypeId?: string
  vendorCategoryId?: string
  onChange: (updates: {
    segmentId?: string
    vendorTypeId?: string
    vendorCategoryId?: string
  }) => void
  onNext: () => void
  isSaving: boolean
}

export function OnboardingStepVertical({
  segmentId,
  vendorTypeId,
  vendorCategoryId,
  onChange,
  onNext,
  isSaving,
}: StepVerticalProps) {
  const [segmentSearch, setSegmentSearch] = useState("")
  const [categorySearch, setCategorySearch] = useState("")

  const { data: segments = [], isLoading: isLoadingSegments } =
    useTaxonomySegments()

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === segmentId),
    [segments, segmentId]
  )

  const { data: vendorTypes = [], isLoading: isLoadingVendorTypes } =
    useTaxonomyVendorTypes({
      segmentCode: selectedSegment?.code,
      segmentId: selectedSegment?.id,
    })

  const selectedVendorType = useMemo(
    () => vendorTypes.find((vt) => vt.id === vendorTypeId),
    [vendorTypes, vendorTypeId]
  )

  const { data: vendorCategories = [], isLoading: isLoadingCategories } =
    useTaxonomyVendorCategories({
      segmentCode: selectedSegment?.code,
      segmentId: selectedSegment?.id,
      vendorTypeCode: selectedVendorType?.code,
      vendorTypeId: selectedVendorType?.id,
    })

  const filteredSegments = useMemo(() => {
    if (!segmentSearch.trim()) return segments
    const q = segmentSearch.toLowerCase()
    return segments.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    )
  }, [segments, segmentSearch])

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return vendorCategories
    const q = categorySearch.toLowerCase()
    return vendorCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    )
  }, [vendorCategories, categorySearch])

  const canProceed = Boolean(segmentId && vendorTypeId && vendorCategoryId)

  return (
    <div className="flex flex-col gap-y-8">
      {/* Header Info */}
      <div className="flex flex-col gap-y-2 border-b border-ui-border-base pb-5">
        <div className="flex items-center gap-x-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ui-bg-interactive text-ui-fg-on-color">
            <BuildingStorefront className="h-4 w-4" />
          </span>
          <Heading level="h2" className="text-xl font-semibold text-ui-fg-base">
            Business Vertical & Store Classification
          </Heading>
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Choose your primary industry vertical, transaction model, and store category.
          This customizes your seller dashboard, required verification steps, and catalog structure.
        </Text>
      </div>

      {/* 1. Segment Selection */}
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-ui-fg-base flex items-center gap-x-1.5">
            <span>1. Select Business Vertical (Segment)</span>
            <span className="text-ui-fg-error">*</span>
          </Label>
          <div className="w-56">
            <Input
              size="small"
              placeholder="Search verticals..."
              value={segmentSearch}
              onChange={(e) => setSegmentSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoadingSegments ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-ui-bg-subtle animate-pulse border border-ui-border-base"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {filteredSegments.map((segment) => {
              const isSelected = segment.id === segmentId
              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => {
                    onChange({
                      segmentId: segment.id,
                      // Reset child selections on segment change
                      vendorTypeId: undefined,
                      vendorCategoryId: undefined,
                    })
                  }}
                  className={`flex flex-col text-left p-3.5 rounded-lg border transition-all ${
                    isSelected
                      ? "border-ui-border-interactive bg-ui-bg-interactive/5 ring-1 ring-ui-border-interactive"
                      : "border-ui-border-base bg-ui-bg-base hover:border-ui-border-strong hover:bg-ui-bg-subtle"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-sm text-ui-fg-base truncate">
                      {segment.name}
                    </span>
                    <Badge size="xsmall" color={isSelected ? "blue" : "grey"}>
                      {segment.code}
                    </Badge>
                  </div>
                  <Text size="xsmall" className="text-ui-fg-subtle line-clamp-2">
                    {segment.description ?? `All businesses operating in ${segment.name}`}
                  </Text>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Vendor Type Selection */}
      {segmentId && (
        <div className="flex flex-col gap-y-3 pt-2 border-t border-ui-border-base">
          <Label className="text-sm font-semibold text-ui-fg-base flex items-center gap-x-1.5">
            <span>2. Select Operating Model (Vendor Type)</span>
            <span className="text-ui-fg-error">*</span>
          </Label>

          {isLoadingVendorTypes ? (
            <div className="h-16 rounded-lg bg-ui-bg-subtle animate-pulse border border-ui-border-base" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {vendorTypes.map((vt) => {
                const isSelected = vt.id === vendorTypeId
                return (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        vendorTypeId: vt.id,
                        vendorCategoryId: undefined,
                      })
                    }
                    className={`flex flex-col text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? "border-ui-border-interactive bg-ui-bg-interactive/5 ring-1 ring-ui-border-interactive"
                        : "border-ui-border-base bg-ui-bg-base hover:border-ui-border-strong hover:bg-ui-bg-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-sm text-ui-fg-base truncate">
                        {vt.name}
                      </span>
                      <Badge size="xsmall" color={isSelected ? "purple" : "grey"}>
                        {vt.code}
                      </Badge>
                    </div>
                    <Text size="xsmall" className="text-ui-fg-subtle line-clamp-2">
                      {vt.description ?? `Standard ${vt.name.toLowerCase()} operations`}
                    </Text>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Vendor Category / Store Classification */}
      {segmentId && vendorTypeId && (
        <div className="flex flex-col gap-y-3 pt-2 border-t border-ui-border-base">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-ui-fg-base flex items-center gap-x-1.5">
              <span>3. Store Classification (Vendor Category)</span>
              <span className="text-ui-fg-error">*</span>
            </Label>
            <div className="w-56">
              <Input
                size="small"
                placeholder="Filter categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>
          </div>

          {isLoadingCategories ? (
            <div className="h-20 rounded-lg bg-ui-bg-subtle animate-pulse border border-ui-border-base" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
              {filteredCategories.map((vc) => {
                const isSelected = vc.id === vendorCategoryId
                return (
                  <button
                    key={vc.id}
                    type="button"
                    onClick={() => onChange({ vendorCategoryId: vc.id })}
                    className={`flex flex-col text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? "border-ui-border-interactive bg-ui-bg-interactive/5 ring-1 ring-ui-border-interactive"
                        : "border-ui-border-base bg-ui-bg-base hover:border-ui-border-strong hover:bg-ui-bg-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-sm text-ui-fg-base truncate">
                        {vc.name}
                      </span>
                      {vc.onboardingMode ? (
                        <Badge size="xsmall" color="green">
                          {vc.onboardingMode}
                        </Badge>
                      ) : null}
                    </div>
                    <Text size="xsmall" className="text-ui-fg-subtle line-clamp-2">
                      {vc.description ?? `Store classification for ${vc.name}`}
                    </Text>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-end gap-x-3 pt-6 border-t border-ui-border-base">
        <Button
          variant="primary"
          disabled={!canProceed || isSaving}
          isLoading={isSaving}
          onClick={onNext}
        >
          Save & Continue to Business Identity →
        </Button>
      </div>
    </div>
  )
}
