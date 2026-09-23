"use client"

import {
  getVendorRentalConfig,
  upsertVendorRentalConfig,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Input,
  Label,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Row, Section } from "./section"

/**
 * Rental terms for a product, mirroring the admin's Rental Configuration
 * widget.
 *
 * This is the store's own rental module rather than anything Medusa ships, so
 * the section is only useful where the module is in play - but it renders for
 * every product the same way the admin widget does, offering to enable rental
 * when there is no configuration yet.
 */
export const RentalSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [open, setOpen] = useState(false)
  const [minDays, setMinDays] = useState("1")
  const [maxDays, setMaxDays] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-rental-config", product.id],
    queryFn: () => getVendorRentalConfig(product.id),
    retry: false,
  })

  const config = data?.rental_config ?? null

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["vendor-rental-config", product.id],
    })

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: (body: Parameters<typeof upsertVendorRentalConfig>[1]) =>
      upsertVendorRentalConfig(product.id, body),
    onSuccess: refresh,
  })

  const openDrawer = () => {
    setMinDays(String(config?.min_rental_days ?? 1))
    setMaxDays(config?.max_rental_days ? String(config.max_rental_days) : "")
    setOpen(true)
  }

  const onSave = async () => {
    const min = Number(minDays)
    // Blank max means "no upper limit", which the API models as null - not 0.
    const max = maxDays.trim() ? Number(maxDays) : null

    if (!Number.isInteger(min) || min < 1) {
      toast.error("Minimum rental days must be a whole number of 1 or more.")
      return
    }

    if (max !== null && (!Number.isInteger(max) || max < 1)) {
      toast.error("Maximum rental days must be a whole number of 1 or more.")
      return
    }

    // Checked here because the API stores whatever it is given: a maximum
    // below the minimum would leave a product no valid rental period at all.
    if (max !== null && max < min) {
      toast.error("Maximum rental days cannot be less than the minimum.")
      return
    }

    try {
      await save({
        min_rental_days: min,
        max_rental_days: max,
        status: config?.status ?? "active",
      })
      toast.success("Rental configuration saved.")
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the rental configuration."
      )
    }
  }

  const onToggleStatus = async () => {
    if (!config) {
      return
    }

    const deactivating = config.status === "active"

    if (deactivating) {
      const confirmed = await prompt({
        title: "Deactivate rental",
        description:
          "Shoppers will no longer be able to rent this product. Existing rentals are unaffected.",
        confirmText: "Deactivate",
        cancelText: "Cancel",
      })

      if (!confirmed) {
        return
      }
    }

    try {
      await save({ status: deactivating ? "inactive" : "active" })
      toast.success(deactivating ? "Rental deactivated." : "Rental activated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not change the status."
      )
    }
  }

  if (isLoading) {
    return (
      <Section title="Rental Configuration">
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            Loading…
          </Text>
        </div>
      </Section>
    )
  }

  return (
    <Section
      title="Rental Configuration"
      actions={
        config ? (
          <StatusBadge color={config.status === "active" ? "green" : "grey"}>
            {config.status === "active" ? "Active" : "Inactive"}
          </StatusBadge>
        ) : null
      }
    >
      {config ? (
        <>
          <Row label="Min Rental Days">{config.min_rental_days}</Row>
          <Row label="Max Rental Days">{config.max_rental_days}</Row>
          <div className="flex items-center justify-end gap-x-2 px-6 py-4">
            <Button size="small" variant="secondary" onClick={openDrawer}>
              Edit
            </Button>
            <Button
              size="small"
              variant={config.status === "active" ? "danger" : "primary"}
              onClick={onToggleStatus}
              isLoading={isPending}
            >
              {config.status === "active" ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" className="text-ui-fg-muted">
            This product is not available to rent.
          </Text>
          <Button size="small" variant="secondary" onClick={openDrawer}>
            Enable rental
          </Button>
        </div>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {config ? "Edit rental configuration" : "Enable rental"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="min-rental-days">
                Min Rental Days
              </Label>
              <Input
                id="min-rental-days"
                type="number"
                min="1"
                step="1"
                value={minDays}
                onChange={(event) => setMinDays(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="max-rental-days">
                Max Rental Days
              </Label>
              <Input
                id="max-rental-days"
                type="number"
                min="1"
                step="1"
                value={maxDays}
                onChange={(event) => setMaxDays(event.target.value)}
                placeholder="No limit"
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Leave blank for no upper limit.
              </Text>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="small" onClick={onSave} isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Section>
  )
}
