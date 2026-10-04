"use client"

import {
  getVendorEnquiryConfig,
  listVendorProductEnquiries,
  upsertVendorEnquiryConfig,
  type VendorEnquiryFieldDefinition,
  type VendorProduct,
} from "@lib/data/vendor-client"
import { EnquiryFieldBuilder } from "@modules/enquiries/components/enquiry-field-builder"
import {
  ENQUIRY_STATUS_COLOR,
  ENQUIRY_STATUS_LABEL,
  EnquiryReplyDrawer,
  formatEnquiryDate,
} from "@modules/enquiries/components/enquiry-reply-drawer"
import { Badge, Button, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Section } from "./section"

// Stable reference: a fresh `[]` each render would make the field builder's
// reset effect fire on every parent render and wipe in-progress edits.
const NO_FIELDS: VendorEnquiryFieldDefinition[] = []

/**
 * Enquiries for one product: turn them on, build the question form, and
 * answer what customers ask. Mirrors the platform admin's product-enquiries
 * widget, with the same two states (off / on) as Rental and Appointment.
 *
 * Turning enquiries on makes the product enquiry-only - the backend refuses
 * to add it to a cart - so enabling asks for confirmation first.
 */
export const EnquirySection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [activeEnquiryId, setActiveEnquiryId] = useState<string | null>(null)

  const configKey = ["vendor-enquiry-config", product.id]
  const listKey = ["vendor-product-enquiries", product.id]

  // Both are display queries: they load on mount, with no `enabled` gate, so
  // the section shows its real state on a plain page refresh.
  const {
    data: configData,
    isLoading: configLoading,
    isError: configError,
    error: configErrorValue,
  } = useQuery({
    queryKey: configKey,
    queryFn: () => getVendorEnquiryConfig(product.id),
    retry: false,
  })

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useQuery({
    queryKey: listKey,
    queryFn: () => listVendorProductEnquiries(product.id),
    retry: false,
  })

  const { mutateAsync: save, isPending: saving } = useMutation({
    mutationFn: (body: Parameters<typeof upsertVendorEnquiryConfig>[1]) =>
      upsertVendorEnquiryConfig(product.id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configKey }),
  })

  const config = configData?.enquiry_config ?? null
  const isEnabled = config?.status === "active"
  const enquiries = listData?.enquiries ?? []
  const pendingCount = enquiries.filter((e) => e.status === "pending").length
  const loading = configLoading || listLoading
  // A failed read must not look like "enquiries are off" or "no enquiries":
  // the first would invite enabling something already on, the second hides
  // real customer questions.
  const failed = configError || listError

  const confirmEnable = () =>
    prompt({
      title: "Make this product enquiry-only?",
      description:
        "While enquiries are on, customers can't add this product to the cart - they can only send you a question. A product can also use only one sale mode, so turn off Rental, Appointment or Expression of Interest first if it uses one.",
      confirmText: "Continue",
      cancelText: "Cancel",
    })

  const onEnableClick = async () => {
    if (await confirmEnable()) {
      setBuilderOpen(true)
    }
  }

  const onSaveFields = async (fields: VendorEnquiryFieldDefinition[]) => {
    try {
      await save({ status: "active", custom_fields: fields })
      toast.success("Enquiry settings saved")
      setBuilderOpen(false)
    } catch (error) {
      // The backend's message is specific (e.g. "turn Rental off first").
      toast.error(
        error instanceof Error ? error.message : "Could not save enquiry settings."
      )
    }
  }

  const onDisable = async () => {
    const confirmed = await prompt({
      title: "Turn off enquiries?",
      description:
        "Customers will be able to add this product to the cart again. Existing enquiries stay visible here.",
      confirmText: "Turn off",
      cancelText: "Cancel",
    })
    if (!confirmed) return

    try {
      await save({ status: "inactive" })
      toast.success("Enquiries turned off")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not turn off enquiries."
      )
    }
  }

  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: listKey })
    queryClient.invalidateQueries({ queryKey: ["vendor-enquiries"] })
  }

  return (
    <>
      <Section
        title="Enquiries"
        actions={
          loading || failed ? null : (
            <>
              {isEnabled && pendingCount > 0 && (
                <Badge size="2xsmall" color="orange">
                  {pendingCount} new
                </Badge>
              )}
              <Badge size="2xsmall" color={isEnabled ? "green" : "grey"}>
                {isEnabled ? "Active" : "Inactive"}
              </Badge>
            </>
          )
        }
      >
        {loading && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        )}

        {!loading && failed && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-error">
              {configErrorValue instanceof Error
                ? configErrorValue.message
                : "Could not load enquiries. Refresh the page to try again."}
            </Text>
          </div>
        )}

        {!loading && !failed && !isEnabled && (
          <>
            <div className="px-6 py-4">
              <Text className="text-ui-fg-subtle">
                This product is not currently accepting enquiries. Turning them on
                makes it enquiry-only: customers can ask a question but can't add
                it to the cart.
              </Text>
            </div>
            <div className="flex justify-end px-6 py-4">
              <Button size="small" variant="secondary" onClick={onEnableClick}>
                Enable Enquiries
              </Button>
            </div>
          </>
        )}

        {!loading && !failed && isEnabled && (
          <>
            <div className="px-6 py-3">
              <Text size="small" className="text-ui-fg-subtle">
                Enquiry-only: this product can't be added to the cart.
              </Text>
            </div>

            {enquiries.length === 0 && (
              <div className="px-6 py-4">
                <Text className="text-ui-fg-subtle">
                  No enquiries yet for this product.
                </Text>
              </div>
            )}

            {enquiries.map((enquiry) => (
              <button
                key={enquiry.id}
                type="button"
                onClick={() => setActiveEnquiryId(enquiry.id)}
                className="flex w-full items-center justify-between gap-x-4 px-6 py-4 text-left hover:bg-ui-bg-subtle-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-x-2">
                    <Text size="small" weight="plus">
                      {enquiry.customer_email}
                    </Text>
                    <Badge size="2xsmall" color={ENQUIRY_STATUS_COLOR[enquiry.status]}>
                      {ENQUIRY_STATUS_LABEL[enquiry.status]}
                    </Badge>
                  </div>
                  <Text size="small" className="truncate text-ui-fg-subtle">
                    {enquiry.message}
                  </Text>
                </div>
                <Text size="xsmall" className="shrink-0 text-ui-fg-subtle">
                  {formatEnquiryDate(enquiry.created_at)}
                </Text>
              </button>
            ))}

            <div className="flex justify-end gap-x-2 px-6 py-4">
              <Button
                size="small"
                variant="secondary"
                onClick={onDisable}
                disabled={saving}
                isLoading={saving}
              >
                Turn off
              </Button>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setBuilderOpen(true)}
              >
                Edit fields
              </Button>
            </div>
          </>
        )}
      </Section>

      <EnquiryFieldBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initialFields={config?.custom_fields ?? NO_FIELDS}
        isEnabling={!isEnabled}
        isSaving={saving}
        onSave={onSaveFields}
      />

      <EnquiryReplyDrawer
        enquiryId={activeEnquiryId}
        onClose={() => setActiveEnquiryId(null)}
        onChanged={refreshList}
      />
    </>
  )
}
