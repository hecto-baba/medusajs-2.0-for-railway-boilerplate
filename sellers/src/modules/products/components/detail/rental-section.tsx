"use client"

import {
  getVendorRentalConfig,
  upsertVendorRentalConfig,
  type VendorRentalDepositType,
  type VendorRentalUnit,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  Drawer,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Row, Section } from "./section"

const UNIT_LABEL: Record<VendorRentalUnit, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  custom: "Custom (days)",
}

const UNIT_NOUN_PLURAL: Record<VendorRentalUnit, string> = {
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
  custom: "days",
}

/**
 * Rental terms for a product, mirroring the admin's Rental Configuration
 * widget field-for-field (unit, unit-aware min/max, security deposit,
 * pickup/return time requirement) - previously this only exposed the
 * legacy day-only min/max pair, while the vendor API already accepted the
 * full field set. See backend/src/api/vendors/products/[id]/rental-config
 * for the schema this now fully exercises.
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
  const [rentalUnit, setRentalUnit] = useState<VendorRentalUnit>("day")
  const [minRentalUnits, setMinRentalUnits] = useState(1)
  const [maxRentalUnits, setMaxRentalUnits] = useState<number | null>(null)
  const [depositType, setDepositType] = useState<VendorRentalDepositType>("fixed")
  const [depositAmount, setDepositAmount] = useState(0)
  const [requiresTimeSelection, setRequiresTimeSelection] = useState(false)

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

  // Keeps the drawer's fields in sync whenever the config is (re)loaded,
  // matching the admin widget's same effect - without this, reopening the
  // drawer after a save could show stale local state instead of what was
  // actually persisted.
  useEffect(() => {
    if (config) {
      setRentalUnit(config.rental_unit ?? "day")
      setMinRentalUnits(config.min_rental_units ?? config.min_rental_days ?? 1)
      setMaxRentalUnits(
        config.max_rental_units !== undefined
          ? config.max_rental_units
          : config.max_rental_days
      )
      setDepositType(config.security_deposit_type ?? "fixed")
      setDepositAmount(config.security_deposit_amount ?? 0)
      setRequiresTimeSelection(config.requires_time_selection ?? false)
    }
  }, [config])

  const openDrawer = () => setOpen(true)

  // Min/max are numbers *in the selected unit* - "7 to 30" means days under
  // one unit and months under another. Carrying the same numbers across a
  // unit switch silently reinterprets them, so the fields reset to a neutral
  // default whenever the unit actually changes (mirrors the admin widget).
  const handleUnitChange = async (unit: VendorRentalUnit) => {
    if (unit === rentalUnit) {
      return
    }

    if (minRentalUnits !== 1 || maxRentalUnits !== null) {
      const confirmed = await prompt({
        title: "Change rental unit?",
        description: `Switching from ${UNIT_LABEL[rentalUnit]} to ${UNIT_LABEL[unit]} will reset the minimum and maximum duration, since those numbers are specific to the current unit.`,
        confirmText: "Change unit",
        cancelText: "Cancel",
      })

      if (!confirmed) {
        return
      }
    }

    setRentalUnit(unit)
    setMinRentalUnits(1)
    setMaxRentalUnits(null)
  }

  const onSave = async () => {
    if (!Number.isInteger(minRentalUnits) || minRentalUnits < 1) {
      toast.error(`Minimum rental ${UNIT_NOUN_PLURAL[rentalUnit]} must be a whole number of 1 or more.`)
      return
    }

    if (
      maxRentalUnits !== null &&
      (!Number.isInteger(maxRentalUnits) || maxRentalUnits < 1)
    ) {
      toast.error(`Maximum rental ${UNIT_NOUN_PLURAL[rentalUnit]} must be a whole number of 1 or more.`)
      return
    }

    // Checked here because the API stores whatever it is given: a maximum
    // below the minimum would leave a product no valid rental period at all.
    if (maxRentalUnits !== null && maxRentalUnits < minRentalUnits) {
      toast.error(`Maximum rental ${UNIT_NOUN_PLURAL[rentalUnit]} cannot be less than the minimum.`)
      return
    }

    if (depositAmount < 0) {
      toast.error("Security deposit amount cannot be negative.")
      return
    }

    try {
      await save({
        rental_unit: rentalUnit,
        min_rental_units: minRentalUnits,
        max_rental_units: maxRentalUnits,
        security_deposit_amount: depositAmount,
        security_deposit_type: depositType,
        requires_time_selection: requiresTimeSelection,
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

  const activeUnit: VendorRentalUnit = config?.rental_unit ?? "day"
  const activeMinUnits = config?.min_rental_units ?? config?.min_rental_days ?? 1
  const activeMaxUnits =
    config?.max_rental_units !== undefined
      ? config?.max_rental_units
      : config?.max_rental_days

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
          <Row label="Rental Unit">{UNIT_LABEL[activeUnit]}</Row>
          <Row label="Min Duration">
            {activeMinUnits} {UNIT_NOUN_PLURAL[activeUnit]}
          </Row>
          <Row label="Max Duration">
            {activeMaxUnits != null
              ? `${activeMaxUnits} ${UNIT_NOUN_PLURAL[activeUnit]}`
              : "Unlimited"}
          </Row>
          <Row label="Security Deposit">
            {config.security_deposit_amount
              ? config.security_deposit_type === "percentage"
                ? `${config.security_deposit_amount}% of total`
                : config.security_deposit_amount.toFixed(2)
              : "None"}
          </Row>
          <Row label="Pickup/Return Time">
            {config.requires_time_selection ? "Required" : "Not required"}
          </Row>
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
              <Label size="small" weight="plus" htmlFor="rental-unit">
                Rental Unit
              </Label>
              <Select
                value={rentalUnit}
                onValueChange={(value) => handleUnitChange(value as VendorRentalUnit)}
              >
                <Select.Trigger id="rental-unit">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="hour">Hour</Select.Item>
                  <Select.Item value="day">Day</Select.Item>
                  <Select.Item value="week">Week</Select.Item>
                  <Select.Item value="month">Month</Select.Item>
                  <Select.Item value="custom">Custom (plain day count)</Select.Item>
                </Select.Content>
              </Select>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="min-rental-units">
                Minimum Rental {UNIT_NOUN_PLURAL[rentalUnit]}
              </Label>
              <Input
                id="min-rental-units"
                type="number"
                min="1"
                step="1"
                value={minRentalUnits}
                onChange={(event) => setMinRentalUnits(Number(event.target.value))}
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="max-rental-units">
                Maximum Rental {UNIT_NOUN_PLURAL[rentalUnit]}
              </Label>
              <Input
                id="max-rental-units"
                type="number"
                min={minRentalUnits}
                step="1"
                value={maxRentalUnits ?? ""}
                onChange={(event) =>
                  setMaxRentalUnits(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                placeholder="No limit"
              />
              <Text size="xsmall" className="text-ui-fg-muted">
                Leave blank for no upper limit.
              </Text>
            </div>

            <hr />

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus" htmlFor="deposit-type">
                Security Deposit
              </Label>
              <div className="flex gap-x-2">
                <Select
                  value={depositType}
                  onValueChange={(value) =>
                    setDepositType(value as VendorRentalDepositType)
                  }
                >
                  <Select.Trigger id="deposit-type" className="w-40">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="fixed">Fixed amount</Select.Item>
                    <Select.Item value="percentage">% of total</Select.Item>
                  </Select.Content>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(Number(event.target.value))}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                Charged as a separate cart line item at checkout, refunded manually
                once the item is returned.
              </Text>
            </div>

            <hr />

            <div className="flex items-center justify-between">
              <div>
                <Label size="small" weight="plus" htmlFor="requires-time-selection">
                  Require pickup/return time
                </Label>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Ask the shopper for a specific pickup and return time, not just
                  dates.
                </Text>
              </div>
              <Switch
                id="requires-time-selection"
                checked={requiresTimeSelection}
                onCheckedChange={setRequiresTimeSelection}
              />
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
