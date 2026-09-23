import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Badge,
  Button,
  Table,
  Drawer,
  Input,
  Select,
  toast,
} from "@medusajs/ui"
import { Plus, ArrowUpRightOnBox } from "@medusajs/icons"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { useEffect, useState } from "react"
import { DigitalProduct, MediaType } from "../types"

const ProductDigitalMediaWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const [digitalProduct, setDigitalProduct] = useState<DigitalProduct | null>(null)
  const [loading, setLoading] = useState(true)

  // Upload modal state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.PREVIEW)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchDigitalProduct = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/admin/digital-products?product_id=${product.id}&limit=50`, {
        credentials: "include",
      })
      if (!res.ok) {
        return
      }

      const data = await res.json()
      const found = (data.digital_products || []).find((dp: any) => {
        const variant = Array.isArray(dp.product_variant)
          ? dp.product_variant[0]
          : dp.product_variant
        return (
          variant?.product_id === product.id ||
          variant?.product?.id === product.id
        )
      })

      if (found) {
        // Fetch full details with file URLs
        const detailRes = await fetch(`/admin/digital-products/${found.id}`, {
          credentials: "include",
        })
        if (detailRes.ok) {
          const detailData = await detailRes.json()
          setDigitalProduct(detailData.digital_product)
        } else {
          setDigitalProduct(found)
        }
      } else {
        setDigitalProduct(null)
      }
    } catch (e) {
      console.error("Failed to fetch product digital media:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (product?.id) {
      fetchDigitalProduct()
    }
  }, [product?.id])

  // If no digital product is associated with this product, do not render the widget
  if (loading) {
    return null
  }

  if (!digitalProduct) {
    return null
  }

  const medias = digitalProduct.medias || []

  const handleUploadAndAttach = async () => {
    if (!file) {
      toast.error("Error", { description: "Please select a file to upload." })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("files", file)

      const uploadRes = await fetch(`/admin/digital-products/upload/${mediaType}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.files?.[0]) {
        throw new Error(uploadData.message || "Failed to upload file")
      }

      const uploadedFile = uploadData.files[0]

      const attachRes = await fetch(`/admin/digital-products/${digitalProduct.id}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          medias: [
            {
              type: mediaType,
              file_id: uploadedFile.id,
              mime_type: file.type || "application/octet-stream",
            },
          ],
        }),
      })

      if (!attachRes.ok) {
        const attachData = await attachRes.json()
        throw new Error(attachData.message || "Failed to attach media")
      }

      toast.success("Success", { description: "Media attached successfully!" })
      setFile(null)
      setDrawerOpen(false)
      fetchDigitalProduct()
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "Failed to attach media",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Container className="p-0 overflow-hidden">
      <div className="p-6 flex items-center justify-between border-b">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">Digital Product Media</Heading>
          <Badge color="purple">{digitalProduct.name}</Badge>
        </div>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Trigger asChild>
            <Button size="small" variant="secondary">
              <Plus /> Add Media
            </Button>
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>Attach Digital Media File</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-ui-fg-subtle block mb-1">
                  Media Type
                </label>
                <Select
                  value={mediaType}
                  onValueChange={(val) => setMediaType(val as MediaType)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={MediaType.PREVIEW}>
                      Preview (Public Access)
                    </Select.Item>
                    <Select.Item value={MediaType.MAIN}>
                      Main (Protected Download)
                    </Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-ui-fg-subtle block mb-1">
                  Choose File
                </label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button
                onClick={handleUploadAndAttach}
                disabled={!file || uploading}
                isLoading={uploading}
                className="w-full"
              >
                Upload & Attach Media
              </Button>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className="w-24">Type</Table.HeaderCell>
            <Table.HeaderCell>File ID</Table.HeaderCell>
            <Table.HeaderCell>MIME Type</Table.HeaderCell>
            <Table.HeaderCell className="w-24 text-right">Action</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {medias.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={4} className="text-center py-6 text-ui-fg-subtle">
                No digital files attached to this product.
              </Table.Cell>
            </Table.Row>
          ) : (
            medias.map((media) => (
              <Table.Row key={media.id}>
                <Table.Cell>
                  <Badge
                    color={media.type === "main" ? "purple" : "blue"}
                    size="small"
                  >
                    {media.type === "main" ? "Main" : "Preview"}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="font-mono text-xs text-ui-fg-base">
                  {media.fileId}
                </Table.Cell>
                <Table.Cell className="text-sm text-ui-fg-subtle">
                  {media.mimeType}
                </Table.Cell>
                <Table.Cell className="text-right">
                  {media.url ? (
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-ui-fg-interactive hover:underline inline-flex items-center gap-x-1"
                    >
                      <span>Download</span>
                      <ArrowUpRightOnBox className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-ui-fg-muted text-xs">-</span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductDigitalMediaWidget