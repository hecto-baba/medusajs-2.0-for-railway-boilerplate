"use client"

import {
  deleteVendorProductOption,
  getVendorProductOption,
  type VendorProductOptionItem,
} from "@lib/data/vendor-client"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import {
  ArrowLeft,
  PencilSquare,
  Trash,
} from "@medusajs/icons"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ProductOptionDrawer } from "../forms/product-option-drawer"

type ProductOptionDetailProps = {
  id: string
}

export const ProductOptionDetail = ({ id }: ProductOptionDetailProps) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [isEditOpen, setIsEditOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-product-option", id],
    queryFn: () => getVendorProductOption(id),
  })

  const option = data?.product_option

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendorProductOption(id),
    onSuccess: () => {
      toast.success("Product option deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["vendor-product-options"] })
      router.push("/products/options")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete product option")
    },
  })

  const handleDelete = async () => {
    if (!option) return

    const confirmed = await prompt({
      title: "Delete Product Option",
      description: `Are you sure you want to delete "${option.title}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    })

    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Text className="text-ui-fg-muted">Loading product option details...</Text>
      </div>
    )
  }

  if (error || !option) {
    return (
      <div className="flex flex-col items-center justify-center gap-y-4 p-16">
        <Text className="text-ui-fg-error">Product option not found or access denied.</Text>
        <Button variant="secondary" onClick={() => router.push("/products/options")}>
          <ArrowLeft /> Back to Options
        </Button>
      </div>
    )
  }

  const values = option.values || []

  return (
    <div className="flex flex-col gap-y-6 p-8 max-w-7xl mx-auto">
      {/* Top bar back link */}
      <div>
        <Link
          href="/products/options"
          className="text-ui-fg-subtle hover:text-ui-fg-base inline-flex items-center gap-x-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Options</span>
        </Link>
      </div>

      {/* Header Container */}
      <Container className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center gap-x-3">
              <Heading level="h1">{option.title}</Heading>
              <Badge color="grey" size="small">
                {values.length} {values.length === 1 ? "value" : "values"}
              </Badge>
            </div>

            {option.product ? (
              <div className="flex items-center gap-x-2 text-sm text-ui-fg-subtle">
                <span>Associated Product:</span>
                <Link
                  href={`/products/${option.product.id}`}
                  className="font-medium text-ui-fg-interactive hover:underline"
                >
                  {option.product.title}
                </Link>
              </div>
            ) : (
              <Text size="small" className="text-ui-fg-muted">
                Global Option Template
              </Text>
            )}

            <Text size="small" className="text-ui-fg-muted">
              Created on{" "}
              {new Date(option.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </div>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={() => setIsEditOpen(true)}
            >
              <PencilSquare className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              <Trash className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </Container>

      {/* Option Values Section */}
      <Container className="p-6 flex flex-col gap-y-4">
        <div>
          <Heading level="h2">Option Values</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            All defined values for {option.title} ({values.length})
          </Text>
        </div>

        <div className="border border-ui-border-base rounded-lg overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="w-16">#</Table.HeaderCell>
                <Table.HeaderCell>Value</Table.HeaderCell>
                <Table.HeaderCell>ID</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {values.length === 0 ? (
                <Table.Row>
                  <td colSpan={3} className="text-center py-8 text-ui-fg-muted">
                    No values defined for this option.
                  </td>
                </Table.Row>
              ) : (
                values.map((val: any, idx: number) => (
                  <Table.Row key={val.id || idx}>
                    <Table.Cell className="text-ui-fg-muted text-xs">
                      {idx + 1}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="grey" size="base" className="font-medium">
                        {val.value}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-ui-fg-muted font-mono text-xs">
                      {val.id || "—"}
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </div>
      </Container>

      {/* Edit Drawer */}
      <ProductOptionDrawer
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        option={option}
      />
    </div>
  )
}
