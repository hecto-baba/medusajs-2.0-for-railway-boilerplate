"use client"

import {
  deleteVendorPriceList,
  type VendorPriceList,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { PencilSquare, Trash } from "@medusajs/icons"
import { Container, Heading, StatusBadge, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { PriceListEditDrawer } from "../forms/price-list-edit-drawer"
import { getPriceListStatus } from "../price-lists-table"

type GeneralSectionProps = {
  priceList: VendorPriceList
}

export const GeneralSection = ({ priceList }: GeneralSectionProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)

  const { color, text } = getPriceListStatus(priceList)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorPriceList(id),
    onSuccess: () => {
      toast.success(
        `Price list "${priceList.title}" was successfully deleted.`
      )
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      router.push("/pricing")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete price list")
    },
  })

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Are you sure?",
      description: `You are about to delete the price list "${priceList.title}". This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (confirmed) {
      deleteMutation.mutate(priceList.id)
    }
  }

  const typeLabel = priceList.type === "sale" ? "Sale" : "Override"
  const overrideCount = priceList.prices_count ?? 0

  return (
    <>
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h1">{priceList.title}</Heading>
          <div className="flex items-center gap-x-4">
            <StatusBadge color={color}>{text}</StatusBadge>
            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      label: "Edit",
                      icon: <PencilSquare />,
                      onClick: () => setIsEditOpen(true),
                    },
                  ],
                },
                {
                  actions: [
                    {
                      label: "Delete",
                      icon: <Trash />,
                      onClick: handleDelete,
                    },
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
          <Text leading="compact" size="small" weight="plus">
            Type
          </Text>
          <Text size="small" className="text-pretty">
            {typeLabel}
          </Text>
        </div>

        <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
          <Text leading="compact" size="small" weight="plus">
            Description
          </Text>
          <Text size="small" className="text-pretty">
            {priceList.description || "-"}
          </Text>
        </div>

        <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
          <Text leading="compact" size="small" weight="plus">
            Price overrides
          </Text>
          <Text size="small" className="text-pretty">
            {overrideCount > 0 ? overrideCount : "-"}
          </Text>
        </div>
      </Container>

      <PriceListEditDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        priceList={priceList}
      />
    </>
  )
}
