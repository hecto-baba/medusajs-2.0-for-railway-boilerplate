import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Button,
  Drawer,
  Input,
  Label,
  Select,
  Switch,
  toast,
  Badge,
  usePrompt,
} from "@medusajs/ui"
import { useQuery, useMutation } from "@tanstack/react-query"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useEffect, useState } from "react"

type RentalUnit = "hour" | "day" | "week" | "month" | "custom"
type DepositType = "fixed" | "percentage"

const UNIT_LABEL: Record<RentalUnit, string> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
  month: "Month",
  custom: "Custom (days)",
}

const UNIT_NOUN_PLURAL: Record<RentalUnit, string> = {
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
  custom: "days",
}

type RentalConfig = {
  id: string
  product_id: string
  min_rental_days: number
  max_rental_days: number | null
  rental_unit: RentalUnit
  min_rental_units: number
  max_rental_units: number | null
  security_deposit_amount: number
  security_deposit_type: DepositType
  requires_time_selection: boolean
  status: "active" | "inactive"
}

type RentalConfigResponse = {
  rental_config: RentalConfig | null
}

const ProductRentalConfigWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rentalUnit, setRentalUnit] = useState<RentalUnit>("day")
  const [minRentalUnits, setMinRentalUnits] = useState(1)
  const [maxRentalUnits, setMaxRentalUnits] = useState<number | null>(null)
  const [depositType, setDepositType] = useState<DepositType>("fixed")
  const [depositAmount, setDepositAmount] = useState(0)
  const [requiresTimeSelection, setRequiresTimeSelection] = useState(false)
  const confirm = usePrompt()

  const { data, isLoading, refetch } = useQuery<RentalConfigResponse>({
    queryFn: () =>
      sdk.client.fetch(`/admin/products/${product.id}/rental-config`),
    queryKey: [["products", product.id, "rental-config"]],
  })

  const upsertMutation = useMutation({
    mutationFn: async (config: {
      rental_unit?: RentalUnit
      min_rental_units?: number
      max_rental_units?: number | null
      security_deposit_amount?: number
      security_deposit_type?: DepositType
      requires_time_selection?: boolean
      status?: "active" | "inactive"
    }) => {
      return sdk.client.fetch(`/admin/products/${product.id}/rental-config`, {
        method: "POST",
        body: config,
      })
    },
    onSuccess: () => {
      toast.success("Rental configuration updated successfully")
      refetch()
      setDrawerOpen(false)
    },
    onError: () => {
      toast.error("Failed to update rental configuration")
    },
  })

  useEffect(() => {
    if (data?.rental_config) {
      const config = data.rental_config
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
  }, [data?.rental_config])

  const handleOpenDrawer = () => {
    setDrawerOpen(true)
  }

  // Min/max are numbers *in the selected unit* - "7 to 30" means days under
  // one unit and months under another. Carrying the same numbers across a
  // unit switch silently reinterprets them (a day-scaled "7 to 30" becomes a
  // 7-to-30-month requirement under "Month"), so the fields reset to a
  // neutral default whenever the unit actually changes.
  const handleUnitChange = async (unit: RentalUnit) => {
    if (unit === rentalUnit) {
      return
    }

    if (
      minRentalUnits !== 1 ||
      maxRentalUnits !== null
    ) {
      const confirmed = await confirm({
        title: "Change rental unit?",
        description: `Switching from ${UNIT_LABEL[rentalUnit]} to ${UNIT_LABEL[unit]} will reset the minimum and maximum duration, since those numbers are specific to the current unit.`,
        variant: "confirmation",
      })

      if (!confirmed) {
        return
      }
    }

    setRentalUnit(unit)
    setMinRentalUnits(1)
    setMaxRentalUnits(null)
  }

  const handleSubmit = () => {
    upsertMutation.mutate({
      rental_unit: rentalUnit,
      min_rental_units: minRentalUnits,
      max_rental_units: maxRentalUnits,
      security_deposit_amount: depositAmount,
      security_deposit_type: depositType,
      requires_time_selection: requiresTimeSelection,
    })
  }

  const handleToggleStatus = async () => {
    if (!data?.rental_config) return

    const newStatus =
      data.rental_config.status === "active" ?
        "inactive" : "active"
    const action =
      newStatus === "inactive" ? "Deactivate" : "Activate"

    if (await confirm({
      title: `${action} rental configuration?`,
      description: `Are you sure you want to ${action.toLowerCase()} this rental configuration?`,
      variant: newStatus === "inactive" ? "danger" : "confirmation",
    })) {
      upsertMutation.mutate({
        status: newStatus
      })
    }
  }

  const activeConfig = data?.rental_config
  const activeUnit: RentalUnit = activeConfig?.rental_unit ?? "day"
  const activeMinUnits = activeConfig?.min_rental_units ?? activeConfig?.min_rental_days ?? 1
  const activeMaxUnits =
    activeConfig?.max_rental_units !== undefined
      ? activeConfig?.max_rental_units
      : activeConfig?.max_rental_days

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Rental Configuration</Heading>
          {!isLoading && data?.rental_config && (
            <Badge color={data.rental_config.status === "active" ? "green" : "grey"} size="2xsmall">
              {data.rental_config.status === "active" ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="px-6 py-4">
            <Text className="text-ui-fg-subtle">Loading...</Text>
          </div>
        )}

        {!isLoading && !data?.rental_config && (
          <>
            <div className="px-6 py-4">
              <Text className="text-ui-fg-subtle">This product is not currently available for rental.</Text>
            </div>
            <div className="flex justify-end border-t px-6 py-4">
              <Button size="small" onClick={handleOpenDrawer} variant="secondary">
                Make Rentable
              </Button>
            </div>
          </>
        )}

        {!isLoading && data?.rental_config && (
          <div className="divide-y">
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Rental Unit
              </Text>
              <Text className="text-ui-fg-subtle text-right">{UNIT_LABEL[activeUnit]}</Text>
            </div>
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Min Duration
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {activeMinUnits} {UNIT_NOUN_PLURAL[activeUnit]}
              </Text>
            </div>
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Max Duration
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {activeMaxUnits != null ? `${activeMaxUnits} ${UNIT_NOUN_PLURAL[activeUnit]}` : "Unlimited"}
              </Text>
            </div>
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Security Deposit
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {activeConfig?.security_deposit_amount
                  ? activeConfig.security_deposit_type === "percentage"
                    ? `${activeConfig.security_deposit_amount}% of total`
                    : activeConfig.security_deposit_amount.toFixed(2)
                  : "None"}
              </Text>
            </div>
            <div className="grid grid-cols-2 items-center px-6 py-4">
              <Text size="small" weight="plus" className="mb-1">
                Pickup/Return Time
              </Text>
              <Text className="text-ui-fg-subtle text-right">
                {activeConfig?.requires_time_selection ? "Required" : "Not required"}
              </Text>
            </div>
            <div className="flex gap-2 px-6 py-4 justify-end">
              <Button size="small" variant="secondary" onClick={handleOpenDrawer}>
                Edit
              </Button>
              <Button
                size="small"
                variant={"primary"}
                onClick={handleToggleStatus}
                disabled={upsertMutation.isPending}
                isLoading={upsertMutation.isPending}
              >
                {data.rental_config.status === "active"
                  ? "Deactivate"
                  : "Activate"
                }
              </Button>
            </div>
          </div>
        )}
      </Container>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {data?.rental_config ? "Edit" : "Add"} Rental Configuration
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rental_unit">Rental Unit</Label>
              <Select
                value={rentalUnit}
                onValueChange={(value) => handleUnitChange(value as RentalUnit)}
              >
                <Select.Trigger id="rental_unit">
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

            <div>
              <Label htmlFor="min_rental_units">
                Minimum Rental {UNIT_NOUN_PLURAL[rentalUnit]}
              </Label>
              <Input
                id="min_rental_units"
                type="number"
                min="1"
                value={minRentalUnits}
                onChange={(e) => setMinRentalUnits(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="max_rental_units">
                Maximum Rental {UNIT_NOUN_PLURAL[rentalUnit]} (leave empty for unlimited)
              </Label>
              <Input
                id="max_rental_units"
                type="number"
                min={minRentalUnits}
                value={maxRentalUnits ?? ""}
                onChange={(e) =>
                  setMaxRentalUnits(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>

            <hr />

            <div className="space-y-1">
              <Label htmlFor="deposit_type">Security Deposit</Label>
              <div className="flex gap-2">
                <Select
                  value={depositType}
                  onValueChange={(value) => setDepositType(value as DepositType)}
                >
                  <Select.Trigger id="deposit_type" className="w-40">
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
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Charged as a separate cart line item at checkout, refunded manually
                once the item is returned.
              </Text>
            </div>

            <hr />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requires_time_selection">Require pickup/return time</Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Ask the shopper for a specific pickup and return time, not just dates.
                </Text>
              </div>
              <Switch
                id="requires_time_selection"
                checked={requiresTimeSelection}
                onCheckedChange={setRequiresTimeSelection}
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={upsertMutation.isPending}
                isLoading={upsertMutation.isPending}
              >
                Save
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductRentalConfigWidget
