"use client"

import {
  createVendorAppointmentSlots,
  listVendorProducts,
  type VendorProduct,
} from "@lib/data/vendor-client"
import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type AppointmentCreateModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const AppointmentCreateModal = ({
  open,
  onOpenChange,
  onSuccess,
}: AppointmentCreateModalProps) => {
  const queryClient = useQueryClient()

  const [productId, setProductId] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("30")
  const [dateFrom, setDateFrom] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [dateTo, setDateTo] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [maxCapacity, setMaxCapacity] = useState("1")

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["vendor-products-appointment-picker"],
    queryFn: () => listVendorProducts({ limit: 100, offset: 0 }),
    enabled: open,
  })

  const products = productsData?.products ?? []

  const resetForm = () => {
    setProductId("")
    setDurationMinutes("30")
    setDateFrom(new Date().toISOString().slice(0, 10))
    setDateTo(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    setMaxCapacity("1")
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createVendorAppointmentSlots({
        service_product_id: productId,
        service_duration_minutes: Number(durationMinutes),
        date_from: `${dateFrom}T00:00:00.000Z`,
        date_to: `${dateTo}T00:00:00.000Z`,
        max_capacity: Number(maxCapacity) || 1,
      }),
    onSuccess: (data) => {
      toast.success(
        `${data.appointments.length} appointment slot(s) generated successfully`
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-appointments"] })
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(error?.message || "Could not create appointment slots")
    },
  })

  const validationError = !productId
    ? "Please select a service product"
    : !durationMinutes || Number(durationMinutes) < 1
      ? "Please specify a valid duration"
      : !dateFrom || !dateTo || dateFrom > dateTo
        ? "Please specify a valid date range"
        : null

  return (
    <FocusModal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) resetForm()
      }}
    >
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="small"
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
              disabled={!!validationError}
            >
              Add appointment
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-10">
          <div className="flex w-full max-w-lg flex-col gap-6 px-6">
            <div>
              <Heading level="h2">Add Appointment</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Schedule and generate bookable appointment slots for a service.
              </Text>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label size="small" weight="plus">
                  Service Product <span className="text-ui-fg-error">*</span>
                </Label>
                <Select
                  value={productId}
                  onValueChange={setProductId}
                  disabled={productsLoading}
                >
                  <Select.Trigger>
                    <Select.Value
                      placeholder={
                        productsLoading
                          ? "Loading services..."
                          : "Select a product / service..."
                      }
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {products.map((p) => (
                      <Select.Item key={p.id} value={p.id}>
                        {p.title}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Duration (minutes) <span className="text-ui-fg-error">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="30"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Capacity (per slot)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Date From <span className="text-ui-fg-error">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Date To <span className="text-ui-fg-error">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
