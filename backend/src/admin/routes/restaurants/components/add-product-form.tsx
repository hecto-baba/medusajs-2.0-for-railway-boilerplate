import { useState } from "react"
import { Button, Drawer, Input, Label, Textarea, toast, Select } from "@medusajs/ui"
import { Trash, InformationCircle, Tag, CurrencyDollar, Photo } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

type AddProductFormProps = {
  restaurantId: string
  onSuccess: () => void
  onCancel: () => void
}

export const AddProductForm = ({ restaurantId, onSuccess, onCancel }: AddProductFormProps) => {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [price, setPrice] = useState("12.00")
  const [currency, setCurrency] = useState<"eur" | "usd">("eur")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setImagePreview(result)
        setThumbnail(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const clearImage = () => {
    setSelectedFile(null)
    setImagePreview("")
    setThumbnail("")
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: any) =>
      sdk.client.fetch(`/admin/restaurants/${restaurantId}/products`, {
        method: "POST",
        body: { products: [payload] },
      }),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Validation Error", { description: "Dish or product title is required" })
      return
    }
    const parsedPrice = parseFloat(price || "0")
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Validation Error", { description: "Please enter a valid price" })
      return
    }

    try {
      let finalThumbnail = thumbnail.trim() || undefined

      // Upload file if chosen
      if (selectedFile) {
        try {
          const formData = new FormData()
          formData.append("files", selectedFile)
          const uploadRes = await fetch("/admin/uploads", {
            method: "POST",
            body: formData,
            credentials: "include",
          })
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json()
            if (uploadData.files?.[0]?.url) {
              finalThumbnail = uploadData.files[0].url
            }
          }
        } catch {
          // Fallback to data URL preview
        }
      }

      // Always set both EUR and USD prices using the same amount
      const prices = [
        { currency_code: "eur", amount: parsedPrice },
        { currency_code: "usd", amount: parsedPrice },
      ]

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail: finalThumbnail,
        images: finalThumbnail ? [{ url: finalThumbnail }] : undefined,
        status: "published",
        metadata: {
          restaurant_id: restaurantId,
          base_currency: currency,
        },
        options: [
          {
            title: "Default Option",
            values: ["Default"],
          },
        ],
        variants: [
          {
            title: "Default",
            manage_inventory: false,
            options: { "Default Option": "Default" },
            prices,
          },
        ],
      }

      await mutateAsync(payload)
      toast.success("Product Added", { description: `"${title.trim()}" was added to the menu successfully.` })
      queryClient.invalidateQueries({ queryKey: ["restaurants", restaurantId] })
      onSuccess()
    } catch (error: any) {
      toast.error("Error", { description: error.message || "Failed to add dish to menu" })
    }
  }

  const currencySymbol = currency === "eur" ? "€" : "$"

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
      <Drawer.Body className="flex max-w-full flex-1 flex-col gap-y-5 overflow-y-auto p-6">

        {/* Info callout */}
        <div className="flex items-start gap-x-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2.5">
          <InformationCircle className="h-4 w-4 mt-0.5 text-ui-fg-muted flex-shrink-0" />
          <p className="text-xs text-ui-fg-subtle leading-relaxed">
            Enter the essentials here to quickly add this dish to the restaurant menu.
            Advanced options — portion sizes, variants, inventory, and pricing matrices — can be
            managed centrally in the{" "}
            <strong className="text-ui-fg-base font-medium">Products</strong> section.
          </p>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-y-1.5">
          <div className="flex items-center gap-x-1.5">
            <Tag className="h-3.5 w-3.5 text-ui-fg-muted" />
            <Label size="small" weight="plus">
              Dish / Product Title <span className="text-ui-fg-error">*</span>
            </Label>
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Hyderabadi Chicken Biryani, Chocolate Lava Cake, Mango Lassi"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-y-1.5">
          <Label size="small" weight="plus">
            Description
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dish — ingredients, preparation style, allergens, serving size..."
            rows={3}
          />
        </div>

        {/* Price */}
        <div className="flex flex-col gap-y-1.5">
          <div className="flex items-center gap-x-1.5">
            <CurrencyDollar className="h-3.5 w-3.5 text-ui-fg-muted" />
            <Label size="small" weight="plus">
              Base Price <span className="text-ui-fg-error">*</span>
            </Label>
          </div>
          <div className="flex items-center gap-x-2">
            {/* Currency selector */}
            <Select value={currency} onValueChange={(v) => setCurrency(v as "eur" | "usd")}>
              <Select.Trigger className="w-24 flex-shrink-0">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="eur">EUR €</Select.Item>
                <Select.Item value="usd">USD $</Select.Item>
              </Select.Content>
            </Select>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ui-fg-muted">
                {currencySymbol}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="12.00"
                className="pl-7"
              />
            </div>
          </div>
          <p className="text-[11px] text-ui-fg-muted">
            This base price will be set for both EUR and USD. Adjust per-currency pricing in the Products section after creation.
          </p>
        </div>

        {/* Dish Image */}
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-1.5">
              <Photo className="h-3.5 w-3.5 text-ui-fg-muted" />
              <Label size="small" weight="plus">
                Dish Image / Photo
              </Label>
            </div>
            {/* Toggle */}
            <div className="flex items-center gap-1 bg-ui-bg-subtle p-0.5 rounded-md border border-ui-border-base">
              <button
                type="button"
                onClick={() => {
                  setImageMode("upload")
                  setThumbnail("")
                  setImagePreview("")
                }}
                className={`px-2 py-0.5 text-xs font-medium rounded transition ${
                  imageMode === "upload"
                    ? "bg-ui-bg-base text-ui-fg-base shadow-xs font-semibold"
                    : "text-ui-fg-subtle hover:text-ui-fg-base"
                }`}
              >
                Upload from Laptop
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageMode("url")
                  setSelectedFile(null)
                  setImagePreview("")
                }}
                className={`px-2 py-0.5 text-xs font-medium rounded transition ${
                  imageMode === "url"
                    ? "bg-ui-bg-base text-ui-fg-base shadow-xs font-semibold"
                    : "text-ui-fg-subtle hover:text-ui-fg-base"
                }`}
              >
                Web URL
              </button>
            </div>
          </div>

          {imageMode === "upload" ? (
            <div className="flex flex-col gap-y-2">
              <label className="flex flex-col items-center justify-center border border-dashed border-ui-border-base hover:border-ui-border-interactive rounded-lg p-5 cursor-pointer bg-ui-bg-subtle/50 transition gap-y-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Photo className="h-6 w-6 text-ui-fg-muted" />
                <span className="text-xs font-medium text-ui-fg-base">
                  {selectedFile ? selectedFile.name : "Click to choose photo from your laptop"}
                </span>
                <span className="text-[11px] text-ui-fg-subtle">
                  PNG, JPG, WebP — up to 10 MB
                </span>
              </label>

              {imagePreview && (
                <div className="flex items-center gap-3 p-2 bg-ui-bg-subtle rounded-md border border-ui-border-base">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-md border border-ui-border-base flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ui-fg-base truncate">
                      {selectedFile?.name || "Selected Photo"}
                    </p>
                    <p className="text-[10px] text-ui-fg-subtle">Ready to upload on save</p>
                  </div>
                  <Button
                    type="button"
                    variant="transparent"
                    size="small"
                    onClick={clearImage}
                    className="text-ui-fg-muted hover:text-ui-fg-error"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-y-2">
              <Input
                value={thumbnail}
                onChange={(e) => {
                  setThumbnail(e.target.value)
                  setImagePreview(e.target.value)
                }}
                placeholder="https://example.com/dish-photo.jpg"
              />
              {thumbnail && (
                <div className="flex items-center gap-3 p-2 bg-ui-bg-subtle rounded-md border border-ui-border-base">
                  <img
                    src={thumbnail}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-md border border-ui-border-base flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ui-fg-base truncate">{thumbnail}</p>
                    <p className="text-[10px] text-ui-fg-subtle">Image URL preview</p>
                  </div>
                  <Button
                    type="button"
                    variant="transparent"
                    size="small"
                    onClick={() => {
                      setThumbnail("")
                      setImagePreview("")
                    }}
                    className="text-ui-fg-muted hover:text-ui-fg-error"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer.Body>

      <Drawer.Footer className="p-4 border-t border-ui-border-base">
        <div className="flex justify-end gap-x-2">
          <Button size="small" variant="secondary" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button size="small" type="submit" isLoading={isPending}>
            Add to Menu
          </Button>
        </div>
      </Drawer.Footer>
    </form>
  )
}
