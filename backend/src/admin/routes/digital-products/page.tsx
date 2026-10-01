import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  PhotoSolid,
  EllipsisHorizontal,
  ArrowUpRightOnBox,
  DocumentText,
  Trash,
  Plus,
  CurrencyDollar,
} from "@medusajs/icons"
import {
  Button,
  Container,
  Drawer,
  Heading,
  Table,
  Badge,
  DropdownMenu,
  IconButton,
  usePrompt,
  toast,
  Input,
  Select,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { DigitalProduct, MediaType, ProductVariantWithProduct } from "../../types"
import CreateDigitalProductForm from "../../components/create-digital-product-form"

const DigitalProductsPage = () => {
  const [digitalProducts, setDigitalProducts] = useState<DigitalProduct[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const pageLimit = 20
  const [count, setCount] = useState(0)
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const [manageDrawerOpen, setManageDrawerOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<DigitalProduct | null>(null)

  // Manage files state
  const [newMediaType, setNewMediaType] = useState<MediaType>(MediaType.PREVIEW)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  // Price editing state
  const [editPriceDrawerOpen, setEditPriceDrawerOpen] = useState(false)
  const [editingVariantInfo, setEditingVariantInfo] = useState<{
    productId: string
    variantId: string
    productName: string
    variantTitle: string
  } | null>(null)
  const [editPriceAmount, setEditPriceAmount] = useState("")
  const [editPriceCurrency, setEditPriceCurrency] = useState("eur")
  const [savingPrice, setSavingPrice] = useState(false)

  const prompt = usePrompt()

  const pagesCount = useMemo(() => {
    return Math.ceil(count / pageLimit)
  }, [count, pageLimit])

  const canNextPage = useMemo(
    () => currentPage < pagesCount - 1,
    [currentPage, pagesCount]
  )

  const canPreviousPage = useMemo(
    () => currentPage > 0,
    [currentPage]
  )

  const nextPage = () => {
    if (canNextPage) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  const previousPage = () => {
    if (canPreviousPage) {
      setCurrentPage((prev) => prev - 1)
    }
  }

  const fetchDigitalProducts = async () => {
    try {
      const response = await fetch(
        `/admin/digital-products?limit=${pageLimit}&offset=${currentPage * pageLimit}`,
        {
          credentials: "include",
        }
      )
      const data = await response.json()
      setDigitalProducts(data.digital_products || [])
      setCount(data.count || 0)
    } catch (e) {
      console.error("Error fetching digital products:", e)
    }
  }

  useEffect(() => {
    fetchDigitalProducts()
  }, [currentPage])

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await prompt({
      title: "Delete Digital Product",
      description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!confirmed) {
      return
    }

    try {
      const res = await fetch(`/admin/digital-products/${id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error("Failed to delete digital product")
      }

      toast.success("Success", {
        description: `"${name}" was deleted successfully.`,
      })
      fetchDigitalProducts()
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "Failed to delete digital product",
      })
    }
  }

  const handleOpenManageFiles = (product: DigitalProduct) => {
    setSelectedProduct(product)
    setNewFile(null)
    setNewMediaType(MediaType.PREVIEW)
    setManageDrawerOpen(true)
  }

  const handleAttachFile = async () => {
    if (!selectedProduct || !newFile) {
      toast.error("Error", { description: "Please select a file to upload." })
      return
    }

    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append("files", newFile)

      const uploadRes = await fetch(`/admin/digital-products/upload/${newMediaType}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.files?.[0]) {
        throw new Error(uploadData.message || "Failed to upload file")
      }

      const uploadedFile = uploadData.files[0]

      const attachRes = await fetch(`/admin/digital-products/${selectedProduct.id}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          medias: [
            {
              type: newMediaType,
              file_id: uploadedFile.id,
              mime_type: newFile.type || "application/octet-stream",
            },
          ],
        }),
      })

      if (!attachRes.ok) {
        const attachData = await attachRes.json()
        throw new Error(attachData.message || "Failed to attach media")
      }

      toast.success("Success", { description: "Media attached successfully!" })
      setNewFile(null)

      // Refresh product data
      const refreshRes = await fetch(`/admin/digital-products/${selectedProduct.id}`, {
        credentials: "include",
      })
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        setSelectedProduct(refreshData.digital_product)
      }
      fetchDigitalProducts()
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to attach media" })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleOpenEditPrice = (dp: DigitalProduct) => {
    const variant = (
      Array.isArray(dp.product_variant)
        ? dp.product_variant[0]
        : dp.product_variant
    ) as ProductVariantWithProduct | undefined

    const productId = variant?.product_id || variant?.product?.id
    const variantId = variant?.id

    if (!productId || !variantId) {
      toast.error("Error", { description: "Variant or Product information is missing." })
      return
    }

    const currentPriceObj = variant?.prices?.[0]
    setEditingVariantInfo({
      productId,
      variantId,
      productName: dp.name,
      variantTitle: variant?.title || "Default Variant",
    })
    setEditPriceAmount(
      currentPriceObj?.amount !== undefined ? String(currentPriceObj.amount) : ""
    )
    setEditPriceCurrency(currentPriceObj?.currency_code || "eur")
    setEditPriceDrawerOpen(true)
  }

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVariantInfo) return

    const parsedPrice = parseFloat(editPriceAmount)
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Error", { description: "Please enter a valid non-negative price amount." })
      return
    }

    setSavingPrice(true)
    try {
      const res = await fetch(
        `/admin/products/${editingVariantInfo.productId}/variants/${editingVariantInfo.variantId}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prices: [
              {
                currency_code: editPriceCurrency.toLowerCase(),
                amount: parsedPrice,
              },
              ...(editPriceCurrency.toLowerCase() !== "usd"
                ? [{ currency_code: "usd", amount: parsedPrice }]
                : [{ currency_code: "eur", amount: parsedPrice }]),
            ],
          }),
        }
      )

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || "Failed to update price")
      }

      toast.success("Success", { description: "Price updated successfully!" })
      setEditPriceDrawerOpen(false)
      fetchDigitalProducts()
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to update price" })
    } finally {
      setSavingPrice(false)
    }
  }

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
          <Heading level="h2">Digital Products</Heading>
          <p className="text-ui-fg-subtle text-sm mt-1">
            Manage your digital assets, downloads, preview files, and product associations.
          </p>
        </div>
        <Drawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
          <Drawer.Trigger asChild>
            <Button variant="secondary">Create</Button>
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>Create Digital Product</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="p-4">
              <CreateDigitalProductForm
                onSuccess={() => {
                  setCreateDrawerOpen(false)
                  fetchDigitalProducts()
                }}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className="w-16">Thumbnail</Table.HeaderCell>
            <Table.HeaderCell>Digital Product</Table.HeaderCell>
            <Table.HeaderCell>Catalog Product & Status</Table.HeaderCell>
            <Table.HeaderCell>Variant</Table.HeaderCell>
            <Table.HeaderCell>Price</Table.HeaderCell>
            <Table.HeaderCell>Media Breakdown</Table.HeaderCell>
            <Table.HeaderCell>Created At</Table.HeaderCell>
            <Table.HeaderCell className="w-12 text-right">Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {digitalProducts.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={8} className="text-center py-8 text-ui-fg-subtle">
                No digital products found. Click "Create" to add your first digital asset.
              </Table.Cell>
            </Table.Row>
          ) : (
            digitalProducts.map((digitalProduct) => {
              const variant = (
                Array.isArray(digitalProduct.product_variant)
                  ? digitalProduct.product_variant[0]
                  : digitalProduct.product_variant
              ) as ProductVariantWithProduct | undefined

              const product = variant?.product
              const productId = variant?.product_id || product?.id
              const prices = variant?.prices || []
              const medias = digitalProduct.medias || []
              const previewCount = medias.filter((m) => m.type === "preview").length
              const mainCount = medias.filter((m) => m.type === "main").length

              const formattedDate = digitalProduct.created_at
                ? new Date(digitalProduct.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "-"

              return (
                <Table.Row key={digitalProduct.id}>
                  {/* 1. Product Thumbnail */}
                  <Table.Cell>
                    {product?.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title || digitalProduct.name}
                        className="w-10 h-10 object-cover rounded border border-ui-border-base"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-ui-bg-subtle rounded flex items-center justify-center border border-ui-border-base">
                        <PhotoSolid className="text-ui-fg-muted" />
                      </div>
                    )}
                  </Table.Cell>

                  {/* 2. Digital Product Name */}
                  <Table.Cell>
                    <span className="font-medium text-ui-fg-base">
                      {digitalProduct.name}
                    </span>
                  </Table.Cell>

                  {/* 3. Associated Product Title & Status badge */}
                  <Table.Cell>
                    <div className="flex flex-col gap-y-1">
                      {product?.title ? (
                        <span className="text-ui-fg-base font-normal">
                          {product.title}
                        </span>
                      ) : (
                        <span className="text-ui-fg-muted">-</span>
                      )}
                      {product?.status && (
                        <div>
                          <Badge
                            color={product.status === "published" ? "green" : "grey"}
                            size="small"
                          >
                            {product.status === "published" ? "Published" : "Draft"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </Table.Cell>

                  {/* 4. Associated Variant Title */}
                  <Table.Cell>
                    <span className="text-ui-fg-subtle text-sm">
                      {variant?.title || "-"}
                    </span>
                  </Table.Cell>

                  {/* 5. Variant Price */}
                  <Table.Cell>
                    {prices.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEditPrice(digitalProduct)}
                        className="text-left group flex items-center gap-x-1 hover:text-ui-fg-interactive transition-colors"
                        title="Click to edit price"
                      >
                        <span className="text-ui-fg-base text-sm font-medium group-hover:underline">
                          {prices
                            .map(
                              (p) =>
                                `${p.currency_code.toUpperCase()} ${p.amount}`
                            )
                            .join(" / ")}
                        </span>
                        <CurrencyDollar className="text-ui-fg-muted group-hover:text-ui-fg-interactive w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEditPrice(digitalProduct)}
                        className="hover:opacity-80 cursor-pointer"
                        title="Click to add price"
                      >
                        <Badge color="red" size="small">
                          No Price Set
                        </Badge>
                      </button>
                    )}
                  </Table.Cell>

                  {/* 6. Media breakdown tag */}
                  <Table.Cell>
                    <div className="flex items-center gap-x-1.5 flex-wrap">
                      {mainCount > 0 && (
                        <Badge color="purple" size="small">
                          {mainCount} Main
                        </Badge>
                      )}
                      {previewCount > 0 && (
                        <Badge color="blue" size="small">
                          {previewCount} Preview
                        </Badge>
                      )}
                      {mainCount === 0 && previewCount === 0 && (
                        <span className="text-ui-fg-muted text-xs">No media</span>
                      )}
                    </div>
                  </Table.Cell>

                  {/* 7. Created At date */}
                  <Table.Cell>
                    <span className="text-ui-fg-subtle text-sm">
                      {formattedDate}
                    </span>
                  </Table.Cell>

                  {/* 8. Actions Column with Dropdown */}
                  <Table.Cell className="text-right">
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          onClick={() => handleOpenEditPrice(digitalProduct)}
                          className="flex items-center gap-x-2 cursor-pointer"
                        >
                          <CurrencyDollar className="text-ui-fg-subtle" />
                          <span>Edit Price</span>
                        </DropdownMenu.Item>
                        {productId && (
                          <DropdownMenu.Item asChild>
                            <Link
                              to={`/products/${productId}`}
                              className="flex items-center gap-x-2 text-ui-fg-base cursor-pointer"
                            >
                              <ArrowUpRightOnBox className="text-ui-fg-subtle" />
                              <span>View Product</span>
                            </Link>
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Item
                          onClick={() => handleOpenManageFiles(digitalProduct)}
                          className="flex items-center gap-x-2 cursor-pointer"
                        >
                          <DocumentText className="text-ui-fg-subtle" />
                          <span>Manage Files</span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          onClick={() =>
                            handleDelete(digitalProduct.id, digitalProduct.name)
                          }
                          className="flex items-center gap-x-2 text-ui-fg-error cursor-pointer"
                        >
                          <Trash className="text-ui-fg-error" />
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

      <Table.Pagination
        count={count}
        pageSize={pageLimit}
        pageIndex={currentPage}
        pageCount={pagesCount}
        canPreviousPage={canPreviousPage}
        canNextPage={canNextPage}
        previousPage={previousPage}
        nextPage={nextPage}
      />

      {/* Manage Files Drawer */}
      <Drawer open={manageDrawerOpen} onOpenChange={setManageDrawerOpen}>
        <Drawer.Content className="max-w-xl">
          <Drawer.Header>
            <Drawer.Title>
              Manage Files: {selectedProduct?.name}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 space-y-6">
            <div>
              <Heading level="h3" className="text-sm font-semibold mb-2">
                Attached Media Files ({selectedProduct?.medias?.length || 0})
              </Heading>
              {selectedProduct?.medias && selectedProduct.medias.length > 0 ? (
                <div className="border rounded divide-y">
                  {selectedProduct.medias.map((media) => (
                    <div
                      key={media.id}
                      className="p-3 flex items-center justify-between gap-x-3"
                    >
                      <div className="flex items-center gap-x-2.5 min-w-0">
                        <Badge
                          color={media.type === "main" ? "purple" : "blue"}
                          size="small"
                        >
                          {media.type === "main" ? "Main" : "Preview"}
                        </Badge>
                        <div className="truncate">
                          <p className="text-sm font-medium text-ui-fg-base truncate">
                            {media.fileId}
                          </p>
                          <p className="text-xs text-ui-fg-subtle">
                            {media.mimeType}
                          </p>
                        </div>
                      </div>
                      {media.url && (
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-ui-fg-interactive hover:underline shrink-0"
                        >
                          View File
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ui-fg-subtle italic">
                  No files attached to this digital product yet.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <Heading level="h3" className="text-sm font-semibold mb-3">
                Attach Additional Media
              </Heading>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-ui-fg-subtle block mb-1">
                    Media Type
                  </label>
                  <Select
                    value={newMediaType}
                    onValueChange={(val) => setNewMediaType(val as MediaType)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={MediaType.PREVIEW}>Preview (Public)</Select.Item>
                      <Select.Item value={MediaType.MAIN}>Main (Protected)</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-ui-fg-subtle block mb-1">
                    Select File
                  </label>
                  <Input
                    type="file"
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button
                  onClick={handleAttachFile}
                  disabled={!newFile || uploadingFile}
                  isLoading={uploadingFile}
                  className="w-full"
                >
                  <Plus /> Upload & Attach
                </Button>
              </div>
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      {/* Edit Price Drawer */}
      <Drawer open={editPriceDrawerOpen} onOpenChange={setEditPriceDrawerOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>
              Edit Price: {editingVariantInfo?.productName}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4">
            <form onSubmit={handleSavePrice} className="space-y-4">
              <div>
                <p className="text-xs text-ui-fg-subtle mb-1">
                  Variant: <span className="font-medium text-ui-fg-base">{editingVariantInfo?.variantTitle}</span>
                </p>
                <p className="text-xs text-ui-fg-subtle mb-4">
                  Set prices for this digital product. Products without prices cannot be purchased in the storefront.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-ui-fg-muted mb-1 block">
                  Price Amount
                </label>
                <Input
                  name="edit_price"
                  placeholder="e.g. 15.00"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPriceAmount}
                  onChange={(e) => setEditPriceAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ui-fg-muted mb-1 block">
                  Currency
                </label>
                <Select
                  value={editPriceCurrency}
                  onValueChange={(val) => setEditPriceCurrency(val)}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select Currency" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="eur">EUR (€)</Select.Item>
                    <Select.Item value="usd">USD ($)</Select.Item>
                    <Select.Item value="gbp">GBP (£)</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              <div className="flex justify-end gap-x-2 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditPriceDrawerOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={savingPrice}>
                  Save Price
                </Button>
              </div>
            </form>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Digital Products",
  icon: PhotoSolid,
})

export default DigitalProductsPage