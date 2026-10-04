"use client"

import {
  createVendorPricingRule,
  deleteVendorPricingRule,
  listVendorPricingRules,
  listVendorProducts,
  listVendorResources,
  updateVendorPricingRule,
  type VendorPricingRule,
  type VendorPricingRuleInput,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  FocusModal,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { DAY_NAMES, WEEK_ORDER } from "../lib/format"

const ALL = "all"

const describeEffect = (rule: VendorPricingRule) => {
  const sign = rule.value >= 0 ? "+" : "-"
  const abs = Math.abs(rule.value)
  if (rule.type === "percent_adjust") return `${sign}${abs}%`
  const cur = (rule.currency_code ?? "").toUpperCase()
  return rule.type === "fixed_adjust" ? `${sign}${abs} ${cur}` : `Price = ${rule.value} ${cur}`
}

const describeWhen = (rule: VendorPricingRule) => {
  const days =
    rule.days_of_week && rule.days_of_week.length && rule.days_of_week.length < 7
      ? WEEK_ORDER.filter((d) => rule.days_of_week!.includes(d))
          .map((d) => DAY_NAMES[d].slice(0, 3))
          .join(", ")
      : "Every day"
  const band = rule.start_time && rule.end_time ? ` ${rule.start_time}–${rule.end_time}` : ""
  return `${days}${band}`
}

const RuleModal = ({
  open,
  onOpenChange,
  rule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: VendorPricingRule | null
}) => {
  const queryClient = useQueryClient()
  const editing = !!rule

  const [name, setName] = useState("")
  const [type, setType] = useState<VendorPricingRule["type"]>("percent_adjust")
  const [value, setValue] = useState("")
  const [currency, setCurrency] = useState("usd")
  const [resourceId, setResourceId] = useState(ALL)
  const [productId, setProductId] = useState(ALL)
  const [days, setDays] = useState<number[]>([])
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [validFrom, setValidFrom] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [priority, setPriority] = useState("0")

  useEffect(() => {
    if (!open) return
    setName(rule?.name ?? "")
    setType(rule?.type ?? "percent_adjust")
    setValue(rule ? String(rule.value) : "")
    setCurrency(rule?.currency_code ?? "usd")
    setResourceId(rule?.resource_id ?? ALL)
    setProductId(rule?.product_id ?? ALL)
    setDays(rule?.days_of_week ?? [])
    setStart(rule?.start_time ?? "")
    setEnd(rule?.end_time ?? "")
    setValidFrom(rule?.valid_from ? rule.valid_from.slice(0, 10) : "")
    setValidUntil(rule?.valid_until ? rule.valid_until.slice(0, 10) : "")
    setPriority(String(rule?.priority ?? 0))
  }, [open, rule])

  const resources = useQuery({ queryKey: ["vendor-resources"], queryFn: listVendorResources, enabled: open })
  const products = useQuery({
    queryKey: ["vendor-products-for-services"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const num = Number(value)
  const prio = Number(priority)
  const problem = !name.trim()
    ? "Give the rule a name."
    : value.trim() === "" || !Number.isFinite(num)
      ? "Enter an amount."
      : type === "percent_adjust" && (num <= -100 || num > 1000)
        ? "A percentage must be above -100 and at most 1000."
        : type === "override_price" && num < 0
          ? "An exact price cannot be negative."
          : type !== "percent_adjust" && currency.trim().length !== 3
            ? "Enter a 3-letter currency code, e.g. usd."
            : !!start !== !!end
              ? "Set both a start and an end time, or neither."
              : start && end && start >= end
                ? "Start time must be before end time."
                : validFrom && validUntil && validUntil < validFrom
                  ? "The end date cannot be before the start date."
                  : !Number.isInteger(prio) || prio < -1000 || prio > 1000
                    ? "Priority must be a whole number from -1000 to 1000."
                    : null

  const save = useMutation({
    mutationFn: () => {
      const body: VendorPricingRuleInput = {
        name: name.trim(),
        type,
        value: num,
        currency_code: type === "percent_adjust" ? null : currency.trim().toLowerCase(),
        resource_id: resourceId === ALL ? null : resourceId,
        product_id: productId === ALL ? null : productId,
        days_of_week: days.length ? days : null,
        start_time: start || null,
        end_time: end || null,
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        priority: prio,
      }
      return editing ? updateVendorPricingRule(rule!.id, body) : createVendorPricingRule(body)
    },
    onSuccess: () => {
      toast.success(editing ? "Rule updated" : "Rule created")
      queryClient.invalidateQueries({ queryKey: ["vendor-pricing-rules"] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.message || "Could not save the rule"),
  })

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title>{editing ? "Edit pricing rule" : "Add pricing rule"}</FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-8">
          <div className="flex w-full max-w-xl flex-col gap-y-5">
            <div className="flex flex-col gap-y-1">
              <Label size="small" weight="plus">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend premium" maxLength={120} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Resource</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All resources</Select.Item>
                    {(resources.data?.resources ?? []).map((r) => (
                      <Select.Item key={r.id} value={r.id}>{r.display_name}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Service</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All services</Select.Item>
                    {(products.data?.products ?? []).map((p) => (
                      <Select.Item key={p.id} value={p.id}>{p.title}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">Days (none selected = every day)</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_ORDER.map((d) => (
                  <Button
                    key={d}
                    size="small"
                    variant={days.includes(d) ? "primary" : "secondary"}
                    onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                  >
                    {DAY_NAMES[d].slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">From time (optional)</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">To time</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Valid from (optional)</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Valid until</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Days and times are the resource&rsquo;s own local time.
            </Text>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">Effect</Label>
                <Select value={type} onValueChange={(v) => setType(v as VendorPricingRule["type"])}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    <Select.Item value="percent_adjust">Change by %</Select.Item>
                    <Select.Item value="fixed_adjust">Add / subtract amount</Select.Item>
                    <Select.Item value="override_price">Set exact price</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-y-1">
                <Label size="small" weight="plus">
                  {type === "percent_adjust" ? "Percent (e.g. 20 or -15)" : "Amount"}
                </Label>
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              {type !== "percent_adjust" ? (
                <div className="flex flex-col gap-y-1">
                  <Label size="small" weight="plus">Currency</Label>
                  <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-y-1">
              <Label size="small" weight="plus">Priority</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-32" />
              <Text size="xsmall" className="text-ui-fg-subtle">
                When several rules match a booking, the highest priority wins; a rule for a
                specific resource and service beats a general one.
              </Text>
            </div>
            <Text size="small" className="text-ui-fg-error">{problem}</Text>
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!!problem || save.isPending} isLoading={save.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const PricingRules = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VendorPricingRule | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-pricing-rules"],
    queryFn: () => listVendorPricingRules(),
  })
  const resources = useQuery({ queryKey: ["vendor-resources"], queryFn: listVendorResources })
  const products = useQuery({
    queryKey: ["vendor-products-for-services"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
  })

  const resourceName = (id: string | null) =>
    id ? resources.data?.resources.find((r) => r.id === id)?.display_name ?? "Unknown" : "All resources"
  const productName = (id: string | null) =>
    id ? products.data?.products.find((p) => p.id === id)?.title ?? "Unknown" : "All services"

  const toggle = useMutation({
    mutationFn: ({ rule, active }: { rule: VendorPricingRule; active: boolean }) =>
      updateVendorPricingRule(rule.id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-pricing-rules"] }),
    onError: (e: any) => toast.error(e?.message || "Could not update the rule"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteVendorPricingRule(id),
    onSuccess: () => {
      toast.success("Rule deleted")
      queryClient.invalidateQueries({ queryKey: ["vendor-pricing-rules"] })
    },
    onError: (e: any) => toast.error(e?.message || "Could not delete the rule"),
  })

  const confirmRemove = async (rule: VendorPricingRule) => {
    const ok = await prompt({
      title: `Delete "${rule.name}"?`,
      description: "New bookings will use the normal price. Existing bookings are not changed.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })
    if (ok) remove.mutate(rule.id)
  }

  const rules = data?.pricing_rules ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Pricing rules</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Change a service&rsquo;s price automatically by weekday or time of day. The
            product&rsquo;s own price is the starting point.
          </Text>
        </div>
        <Button
          size="small"
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          Add rule
        </Button>
      </div>

      {isLoading ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-subtle">Loading...</Text></div>
      ) : isError ? (
        <div className="px-6 py-8"><Text size="small" className="text-ui-fg-error">{(error as Error)?.message}</Text></div>
      ) : !rules.length ? (
        <div className="px-6 py-12 text-center">
          <Text size="small" className="text-ui-fg-subtle">
            No pricing rules. Every booking uses the product&rsquo;s normal price.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Applies to</Table.HeaderCell>
              <Table.HeaderCell>When</Table.HeaderCell>
              <Table.HeaderCell>Effect</Table.HeaderCell>
              <Table.HeaderCell>Priority</Table.HeaderCell>
              <Table.HeaderCell>On</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rules.map((rule) => (
              <Table.Row
                key={rule.id}
                className="cursor-pointer"
                onClick={() => {
                  setEditing(rule)
                  setModalOpen(true)
                }}
              >
                <Table.Cell><Text size="small" weight="plus">{rule.name}</Text></Table.Cell>
                <Table.Cell>{resourceName(rule.resource_id)} · {productName(rule.product_id)}</Table.Cell>
                <Table.Cell>{describeWhen(rule)}</Table.Cell>
                <Table.Cell><Badge size="2xsmall" color="blue">{describeEffect(rule)}</Badge></Table.Cell>
                <Table.Cell>{rule.priority}</Table.Cell>
                <Table.Cell onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={rule.is_active}
                    disabled={toggle.isPending}
                    onCheckedChange={(active) => toggle.mutate({ rule, active })}
                    aria-label={`Toggle ${rule.name}`}
                  />
                </Table.Cell>
                <Table.Cell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" variant="transparent" aria-label="Delete rule" onClick={() => confirmRemove(rule)}>
                    <Trash />
                  </IconButton>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <RuleModal open={modalOpen} onOpenChange={setModalOpen} rule={editing} />
    </Container>
  )
}
