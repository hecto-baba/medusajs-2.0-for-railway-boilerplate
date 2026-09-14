"use client"

import {
  deleteVendorPriceList,
  getVendorPriceList,
} from "@lib/data/vendor-client"
import { ActionMenu } from "@modules/common"
import { useBreadcrumbTitle } from "@modules/layout"
import { ArrowLeft, CurrencyDollar, PencilSquare, Plus, Trash } from "@medusajs/icons"
import { Badge, Button, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ConfigurationSection } from "./configuration-section"
import { GeneralSection } from "./general-section"
import { ProductsSection } from "./products-section"
import { PriceListEditDrawer } from "../forms/price-list-edit-drawer"
import { PriceListPricesModal } from "../forms/price-list-prices-modal"

type PriceListDetailProps = {
  id: string
}

export const PriceListDetail = ({ id }: PriceListDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPricesOpen, setIsPricesOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-price-list", id],
    queryFn: () => getVendorPriceList(id),
  })

  const priceList = data?.price_list

  useBreadcrumbTitle(priceList?.title)

  const deleteMutation = useMutation({
    mutationFn: (priceListId: string) => deleteVendorPriceList(priceListId),
    onSuccess: () => {
      toast.success("Price list deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-price-lists"] })
      router.push("/pricing")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete price list")
    },
  })

  const handleDelete = async () => {
    if (!priceList) return

    const confirmed = await prompt({
      title: "Delete Price List",
      description: `Are you sure you want to delete "${priceList.title}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate(priceList.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text size="small" className="text-ui-fg-subtle">
          Loading price list details...
        </Text>
      </div>
    )
  }

  if (error || !priceList) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-y-4">
        <Text size="small" className="text-ui-fg-error">
          Price list not found or access denied.
        </Text>
        <Link href="/pricing">
          <Button variant="secondary" size="small">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Price Lists
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-4">
          <Link href="/pricing">
            <Button variant="secondary" size="small">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-x-2">
              <Heading level="h1">{priceList.title}</Heading>
              <Badge
                size="small"
                color={priceList.status === "active" ? "green" : "grey"}
              >
                {priceList.status === "active" ? "Active" : "Draft"}
              </Badge>
              <Badge
                size="small"
                color={priceList.type === "sale" ? "blue" : "purple"}
              >
                {priceList.type === "sale" ? "Sale" : "Override"}
              </Badge>
            </div>
            {priceList.description && (
              <Text size="small" className="text-ui-fg-subtle mt-0.5">
                {priceList.description}
              </Text>
            )}
          </div>
        </div>

        <div className="flex items-center gap-x-2">
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: "Edit Details",
                    icon: <PencilSquare className="h-4 w-4" />,
                    onClick: () => setIsEditOpen(true),
                  },
                  {
                    label: "Add Products & Prices",
                    icon: <Plus className="h-4 w-4" />,
                    onClick: () => setIsPricesOpen(true),
                  },
                  {
                    label: "Delete Price List",
                    icon: <Trash className="h-4 w-4 text-ui-fg-error" />,
                    onClick: handleDelete,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="flex flex-col gap-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GeneralSection priceList={priceList} />
          <ConfigurationSection priceList={priceList} />
        </div>

        <ProductsSection priceList={priceList} />
      </div>

      {/* Edit Drawer & Prices Modal */}
      <PriceListEditDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        priceList={priceList}
      />
      <PriceListPricesModal
        open={isPricesOpen}
        onOpenChange={setIsPricesOpen}
        priceList={priceList}
      />
    </div>
  )
}
