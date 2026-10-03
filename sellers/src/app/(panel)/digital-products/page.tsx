"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Label,
  Select,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ArrowDownTray,
  DocumentText,
  EllipsisHorizontal,
  Eye,
  Plus,
  Trash,
  CurrencyDollar,
  Sparkles,
} from "@medusajs/icons"
import {
  listVendorDigitalProducts,
  createVendorDigitalProduct,
  attachVendorDigitalProductMedia,
  deleteVendorDigitalProduct,
  deleteVendorDigitalProductMedia,
  uploadVendorFiles,
  VendorDigitalProduct,
  VendorMediaType,
} from "@lib/data/vendor-client"

export default function DigitalProductsPage() {
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 15

  // Drawers & Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [manageMediaProduct, setManageMediaProduct] = useState<VendorDigitalProduct | null>(null)
  const [editPriceProduct, setEditPriceProduct] = useState<VendorDigitalProduct | null>(null)

  // Create Form State
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createPrice, setCreatePrice] = useState("")
  const [createCurrency, setCreateCurrency] = useState("eur")
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Attach Media Form State (within manage drawer)
  const [newMediaType, setNewMediaType] = useState<string>(VendorMediaType.MAIN)
  const [newFileToAttach, setNewFileToAttach] = useState<File | null>(null)
  const [isAttaching, setIsAttaching] = useState(false)

  // Fetch Digital Products
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-digital-products", currentPage],
    queryFn: () =>
      listVendorDigitalProducts({
        limit: pageSize,
        offset: currentPage * pageSize,
      }),
  })

  const digitalProducts = data?.digital_products || []
  const totalCount = data?.count || 0

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVendorDigitalProduct(id),
    onSuccess: () => {
      toast.success("Success", { description: "Digital product deleted successfully" })
      queryClient.invalidateQueries({ queryKey: ["vendor-digital-products"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to delete digital product" })
    },
  })

  // Delete Media Item Mutation
  const deleteMediaMutation = useMutation({
    mutationFn: ({ productId, mediaId }: { productId: string; mediaId: string }) =>
      deleteVendorDigitalProductMedia(productId, mediaId),
    onSuccess: () => {
      toast.success("Success", { description: "Media removed successfully" })
      queryClient.invalidateQueries({ queryKey: ["vendor-digital-products"] })
      if (manageMediaProduct) {
        setManageMediaProduct((prev) =>
          prev
            ? {
                ...prev,
                medias: prev.medias?.filter((m) => m.id !== deleteMediaMutation.variables?.mediaId),
              }
            : null
        )
      }
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to remove media" })
    },
  })

  // Create Digital Product Handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) {
      toast.error("Validation error", { description: "Product title is required." })
      return
    }
    if (!mainFile) {
      toast.error("Validation error", { description: "Please upload the primary digital file." })
      return
    }

    try {
      setIsUploading(true)

      // 1. Upload files to vendor uploads
      const filesToUpload: File[] = [mainFile]
      if (previewFile) filesToUpload.push(previewFile)

      const uploadedFiles = await uploadVendorFiles(filesToUpload)

      const mainUploaded = uploadedFiles[0]
      const previewUploaded = previewFile ? uploadedFiles[1] : null

      const mediasPayload = [
        {
          type: VendorMediaType.MAIN,
          file_id: mainUploaded.id,
          mime_type: mainFile.type || "application/octet-stream",
        },
      ]

      if (previewUploaded && previewFile) {
        mediasPayload.push({
          type: VendorMediaType.PREVIEW,
          file_id: previewUploaded.id,
          mime_type: previewFile.type || "application/octet-stream",
        })
      }

      // 2. Format variant price
      const priceAmount = parseFloat(createPrice) || 0

      // 3. Create digital product
      await createVendorDigitalProduct({
        name: createName.trim(),
        medias: mediasPayload,
        product: {
          title: createName.trim(),
          description: createDescription.trim() || undefined,
          status: "published",
          options: [{ title: "Digital Format", values: ["Full Download"] }],
          variants: [
            {
              title: "Digital Download",
              options: { "Digital Format": "Full Download" },
              prices: [{ amount: priceAmount, currency_code: createCurrency.toLowerCase() }],
            },
          ],
        },
      })

      toast.success("Success", { description: "Digital product created and published!" })
      setCreateOpen(false)
      setCreateName("")
      setCreateDescription("")
      setCreatePrice("")
      setMainFile(null)
      setPreviewFile(null)
      queryClient.invalidateQueries({ queryKey: ["vendor-digital-products"] })
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to create digital product" })
    } finally {
      setIsUploading(false)
    }
  }

  // Attach Media to existing product
  const handleAttachMedia = async () => {
    if (!manageMediaProduct || !newFileToAttach) return
    try {
      setIsAttaching(true)
      const uploaded = await uploadVendorFiles([newFileToAttach])
      if (!uploaded.length) throw new Error("Upload failed")

      const newMedia = {
        type: newMediaType,
        file_id: uploaded[0].id,
        mime_type: newFileToAttach.type || "application/octet-stream",
      }

      await attachVendorDigitalProductMedia(manageMediaProduct.id, [newMedia])
      toast.success("Success", { description: "Media attached successfully" })
      setNewFileToAttach(null)
      queryClient.invalidateQueries({ queryKey: ["vendor-digital-products"] })
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to attach media" })
    } finally {
      setIsAttaching(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <DocumentText className="w-6 h-6 text-ui-fg-base" />
            Digital Products
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Sell and distribute digital software, ebooks, video courses, music, and preview assets.
          </Text>
        </div>

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <Drawer.Trigger asChild>
            <Button size="small" variant="primary" className="flex items-center gap-1.5 self-start">
              <Plus className="w-4 h-4" />
              New Digital Product
            </Button>
          </Drawer.Trigger>
          <Drawer.Content className="max-w-xl">
            <Drawer.Header>
              <Drawer.Title>Create Digital Product</Drawer.Title>
              <Drawer.Description>
                Upload your downloadable file, set pricing, and configure preview access.
              </Drawer.Description>
            </Drawer.Header>

            <form onSubmit={handleCreateProduct} className="flex flex-col gap-y-5 p-6 overflow-y-auto max-h-[calc(100vh-180px)]">
              <div className="flex flex-col gap-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold">
                  Product Title <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Master React 19 E-Book & Code Kit"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-y-1.5">
                <Label htmlFor="desc" className="text-xs font-semibold">
                  Description
                </Label>
                <Input
                  id="desc"
                  placeholder="Comprehensive guide and full repository access..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-1.5">
                  <Label htmlFor="price" className="text-xs font-semibold">
                    Price Amount
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="29.99"
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-y-1.5">
                  <Label htmlFor="currency" className="text-xs font-semibold">
                    Currency
                  </Label>
                  <Input
                    id="currency"
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value.toUpperCase())}
                    placeholder="EUR"
                  />
                </div>
              </div>

              {/* Main Downloadable File */}
              <div className="flex flex-col gap-y-2 border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle/40">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Main Downloadable File <span className="text-rose-500">*</span></span>
                  <Badge color="blue" size="xsmall">Deliverable</Badge>
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  ZIP, PDF, Audio, Video, DMG, EXE, or digital file sent to the buyer after purchase.
                </Text>
                <input
                  type="file"
                  onChange={(e) => setMainFile(e.target.files?.[0] || null)}
                  className="mt-2 text-sm text-ui-fg-subtle file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-ui-bg-base file:text-ui-fg-base file:border-ui-border-base hover:file:bg-ui-bg-subtle cursor-pointer"
                  required
                />
                {mainFile && (
                  <Text size="xsmall" className="text-emerald-600 font-medium mt-1">
                    ✓ Selected: {mainFile.name} ({(mainFile.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                )}
              </div>

              {/* Optional Preview File */}
              <div className="flex flex-col gap-y-2 border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle/40">
                <Label className="text-xs font-semibold flex items-center justify-between">
                  <span>Preview File (Optional)</span>
                  <Badge color="grey" size="xsmall">Free Preview</Badge>
                </Label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Free watermarked sample, audio teaser, or excerpt buyers can preview before purchasing.
                </Text>
                <input
                  type="file"
                  onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
                  className="mt-2 text-sm text-ui-fg-subtle file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-ui-bg-base file:text-ui-fg-base file:border-ui-border-base hover:file:bg-ui-bg-subtle cursor-pointer"
                />
                {previewFile && (
                  <Text size="xsmall" className="text-blue-600 font-medium mt-1">
                    ✓ Selected: {previewFile.name} ({(previewFile.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="small"
                  isLoading={isUploading}
                >
                  {isUploading ? "Uploading & Publishing..." : "Publish Digital Product"}
                </Button>
              </div>
            </form>
          </Drawer.Content>
        </Drawer>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Container className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
            <DocumentText className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
              Total Digital Products
            </Text>
            <Heading level="h2" className="text-xl font-bold mt-0.5">
              {totalCount}
            </Heading>
          </div>
        </Container>

        <Container className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
            <ArrowDownTray className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
              Deliverable Files
            </Text>
            <Heading level="h2" className="text-xl font-bold mt-0.5">
              {digitalProducts.reduce(
                (acc, p) => acc + (p.medias?.filter((m) => m.type === "main").length || 0),
                0
              )}
            </Heading>
          </div>
        </Container>

        <Container className="p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
            <Eye className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
              Previews & Samples
            </Text>
            <Heading level="h2" className="text-xl font-bold mt-0.5">
              {digitalProducts.reduce(
                (acc, p) => acc + (p.medias?.filter((m) => m.type === "preview").length || 0),
                0
              )}
            </Heading>
          </div>
        </Container>
      </div>

      {/* Main Table */}
      <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
        <div className="p-4 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-semibold">
              Catalogue
            </Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Manage files, previews, and download permissions.
            </Text>
          </div>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Main Downloads</Table.HeaderCell>
              <Table.HeaderCell>Previews</Table.HeaderCell>
              <Table.HeaderCell>Price</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <td colSpan={7} className="text-center py-10 text-ui-fg-subtle">
                  Loading digital products...
                </td>
              </Table.Row>
            ) : digitalProducts.length === 0 ? (
              <Table.Row>
                <td colSpan={7} className="text-center py-12">
                  <DocumentText className="w-10 h-10 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                  <Text className="font-medium text-ui-fg-base">No digital products created yet</Text>
                  <Text size="small" className="text-ui-fg-subtle mt-1 max-w-sm mx-auto">
                    Publish your first digital file, guide, or software package to start selling digital products.
                  </Text>
                  <Button
                    size="small"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create Digital Product
                  </Button>
                </td>
              </Table.Row>
            ) : (
              digitalProducts.map((prod) => {
                const mainCount = prod.medias?.filter((m) => m.type === "main").length || 0
                const previewCount = prod.medias?.filter((m) => m.type === "preview").length || 0
                const variant = Array.isArray(prod.product_variant)
                  ? prod.product_variant[0]
                  : prod.product_variant
                const price = variant?.prices?.[0]

                return (
                  <Table.Row key={prod.id} className="hover:bg-ui-bg-subtle/50 transition-colors">
                    <Table.Cell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center text-ui-fg-muted">
                          <DocumentText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-ui-fg-base">{prod.name}</div>
                          <div className="text-xs text-ui-fg-subtle">ID: {prod.id.slice(0, 14)}...</div>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="green" size="xsmall">
                        Published
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="blue" size="xsmall">
                        {mainCount} {mainCount === 1 ? "file" : "files"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="grey" size="xsmall">
                        {previewCount} {previewCount === 1 ? "preview" : "previews"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="font-mono text-xs">
                      {price ? `${price.amount} ${price.currency_code.toUpperCase()}` : "Free"}
                    </Table.Cell>
                    <Table.Cell className="text-xs text-ui-fg-subtle">
                      {new Date(prod.created_at).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton size="small" variant="transparent">
                            <EllipsisHorizontal />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content className="min-w-[160px]">
                          <DropdownMenu.Item
                            className="gap-x-2"
                            onClick={() => setManageMediaProduct(prod)}
                          >
                            <ArrowDownTray className="text-ui-fg-subtle w-4 h-4" />
                            <span>Manage Files</span>
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="gap-x-2 text-rose-500 hover:text-rose-600"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${prod.name}"?`)) {
                                deleteMutation.mutate(prod.id)
                              }
                            }}
                          >
                            <Trash className="w-4 h-4" />
                            <span>Delete</span>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </Table.Cell>
                  </Table.Row>
                )
              })
            )}
          </Table.Body>
        </Table>
      </Container>

      {/* Manage Files Drawer */}
      <Drawer
        open={!!manageMediaProduct}
        onOpenChange={(open) => {
          if (!open) setManageMediaProduct(null)
        }}
      >
        <Drawer.Content className="max-w-2xl">
          <Drawer.Header>
            <Drawer.Title>Manage Files: {manageMediaProduct?.name}</Drawer.Title>
            <Drawer.Description>
              View, download, or attach deliverables and preview samples.
            </Drawer.Description>
          </Drawer.Header>

          <div className="flex flex-col gap-y-6 p-6 overflow-y-auto max-h-[calc(100vh-180px)]">
            {/* Current Files List */}
            <div className="flex flex-col gap-y-3">
              <Heading level="h3" className="text-sm font-semibold">
                Attached Files & Deliverables
              </Heading>

              {!manageMediaProduct?.medias || manageMediaProduct.medias.length === 0 ? (
                <div className="p-4 rounded-lg bg-ui-bg-subtle text-center text-sm text-ui-fg-subtle">
                  No media files attached yet.
                </div>
              ) : (
                <div className="divide-y divide-ui-border-base border border-ui-border-base rounded-lg overflow-hidden">
                  {manageMediaProduct.medias.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 flex items-center justify-between gap-4 bg-ui-bg-base hover:bg-ui-bg-subtle/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
                          {m.type === "preview" ? (
                            <Eye className="w-4 h-4 text-purple-500" />
                          ) : (
                            <ArrowDownTray className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ui-fg-base">
                              {m.fileId}
                            </span>
                            <Badge
                              color={m.type === "preview" ? "grey" : "blue"}
                              size="xsmall"
                            >
                              {m.type === "preview" ? "Preview" : "Deliverable"}
                            </Badge>
                          </div>
                          <div className="text-xs text-ui-fg-subtle mt-0.5">
                            MIME: {m.mimeType}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {m.url && (
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => window.open(m.url, "_blank")}
                            className="text-xs"
                          >
                            Download / View ↗
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          variant="transparent"
                          className="text-rose-500 hover:text-rose-600"
                          onClick={() => {
                            if (manageMediaProduct) {
                              deleteMediaMutation.mutate({
                                productId: manageMediaProduct.id,
                                mediaId: m.id,
                              })
                            }
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attach New File */}
            <div className="flex flex-col gap-y-3 pt-4 border-t border-ui-border-base">
              <Heading level="h3" className="text-sm font-semibold">
                Attach New Media File
              </Heading>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs font-semibold">File Type</Label>
                  <Select value={newMediaType} onValueChange={setNewMediaType}>
                    <Select.Trigger className="w-full mt-1.5">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={VendorMediaType.MAIN}>
                        Deliverable (Main Download)
                      </Select.Item>
                      <Select.Item value={VendorMediaType.PREVIEW}>
                        Sample / Preview (Public Preview)
                      </Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Choose File</Label>
                <input
                  type="file"
                  onChange={(e) => setNewFileToAttach(e.target.files?.[0] || null)}
                  className="mt-1.5 block w-full text-sm text-ui-fg-subtle file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-ui-bg-subtle file:text-ui-fg-base border border-ui-border-base rounded-md p-1 cursor-pointer"
                />
              </div>

              <Button
                size="small"
                variant="primary"
                onClick={handleAttachMedia}
                disabled={!newFileToAttach || isAttaching}
                isLoading={isAttaching}
                className="self-end mt-2"
              >
                Upload & Attach Media
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}
