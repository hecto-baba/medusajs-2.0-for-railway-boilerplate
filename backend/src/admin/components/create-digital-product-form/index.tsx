import React, { useState } from "react"
import { Input, Button, Select, toast } from "@medusajs/ui"
import { MediaType } from "../../types"

type CreateMedia = {
  type: MediaType
  file?: File
}

type Props = {
  onSuccess?: () => void
}

const CreateDigitalProductForm = ({ onSuccess }: Props) => {
  const [name, setName] = useState("")
  const [medias, setMedias] = useState<CreateMedia[]>([])
  const [productTitle, setProductTitle] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("eur")
  const [loading, setLoading] = useState(false)

  const onAddMedia = () => {
    setMedias((prev) => [
      ...prev,
      {
        type: MediaType.PREVIEW,
      },
    ])
  }

  const changeFiles = (index: number, data: Partial<CreateMedia>) => {
    setMedias((prev) => [
      ...prev.slice(0, index),
      {
        ...prev[index],
        ...data,
      },
      ...prev.slice(index + 1),
    ])
  }

  const uploadMediaFiles = async (type: MediaType) => {
    const formData = new FormData()
    const mediaWithFiles = medias.filter(
      (media) => media.file !== undefined && media.type === type
    )

    if (!mediaWithFiles.length) {
      return
    }

    mediaWithFiles.forEach((media) => {
      if (!media.file) {
        return
      }
      formData.append("files", media.file)
    })

    const res = await fetch(`/admin/digital-products/upload/${type}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    })

    const data = await res.json()
    if (!res.ok || !data.files) {
      throw new Error(data.message || `Failed to upload ${type} files`)
    }

    return {
      mediaWithFiles,
      files: data.files,
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Error", { description: "Digital product name is required." })
      return
    }

    if (!productTitle.trim()) {
      toast.error("Error", { description: "Product title is required." })
      return
    }

    setLoading(true)
    try {
      const {
        mediaWithFiles: previewMedias,
        files: previewFiles,
      } = (await uploadMediaFiles(MediaType.PREVIEW)) || {}

      const {
        mediaWithFiles: mainMedias,
        files: mainFiles,
      } = (await uploadMediaFiles(MediaType.MAIN)) || {}

      const mediaData: {
        type: MediaType
        file_id: string
        mime_type: string
      }[] = []

      previewMedias?.forEach((media, index) => {
        mediaData.push({
          type: media.type,
          file_id: previewFiles[index].id,
          mime_type: media.file!.type,
        })
      })

      mainMedias?.forEach((media, index) => {
        mediaData.push({
          type: media.type,
          file_id: mainFiles[index].id,
          mime_type: media.file!.type,
        })
      })

      const parsedPrice = parseFloat(price)
      const variantPrices =
        !isNaN(parsedPrice) && parsedPrice >= 0
          ? [
              {
                currency_code: currency.toLowerCase(),
                amount: parsedPrice,
              },
              ...(currency.toLowerCase() !== "usd"
                ? [
                    {
                      currency_code: "usd",
                      amount: parsedPrice,
                    },
                  ]
                : [
                    {
                      currency_code: "eur",
                      amount: parsedPrice,
                    },
                  ]),
            ]
          : []

      const res = await fetch(`/admin/digital-products`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          medias: mediaData,
          product: {
            title: productTitle,
            options: [
              {
                title: "Default",
                values: ["default"],
              },
            ],
            variants: [
              {
                title: productTitle,
                options: {
                  Default: "default",
                },
                manage_inventory: false,
                prices: variantPrices,
              },
            ],
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || data.message) {
        throw new Error(data.message || "Failed to create digital product")
      }

      toast.success("Success", {
        description: "Digital product created successfully!",
      })
      setName("")
      setMedias([])
      setProductTitle("")
      setPrice("")
      setCurrency("eur")
      onSuccess?.()
    } catch (e: any) {
      console.error(e)
      toast.error("Error", {
        description: `An error occurred while creating the digital product: ${e?.message || e}`,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-y-4">
      <Input
        name="name"
        placeholder="Name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <fieldset className="my-4">
        <legend className="mb-2 font-medium">Media</legend>
        <Button type="button" onClick={onAddMedia} variant="secondary">
          Add Media
        </Button>
        {medias.map((media, index) => (
          <fieldset key={index} className="my-2 p-2 border-solid border rounded">
            <legend className="text-sm font-medium">Media {index + 1}</legend>
            <Select
              value={media.type}
              onValueChange={(value) =>
                changeFiles(index, {
                  type: value as MediaType,
                })
              }
            >
              <Select.Trigger>
                <Select.Value placeholder="Media Type" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={MediaType.PREVIEW}>Preview</Select.Item>
                <Select.Item value={MediaType.MAIN}>Main</Select.Item>
              </Select.Content>
            </Select>
            <Input
              name={`file-${index}`}
              type="file"
              onChange={(e) =>
                changeFiles(index, {
                  file: e.target.files?.[0],
                })
              }
              className="mt-2"
            />
          </fieldset>
        ))}
      </fieldset>

      <fieldset className="my-4">
        <legend className="mb-2 font-medium">Product</legend>
        <Input
          name="product_title"
          placeholder="Product Title"
          type="text"
          value={productTitle}
          onChange={(e) => setProductTitle(e.target.value)}
        />
      </fieldset>

      <fieldset className="my-4">
        <legend className="mb-1 font-medium">Pricing</legend>
        <p className="text-xs text-ui-fg-subtle mb-3">
          Set the sales price for the product variant so shoppers can purchase it in your storefront.
        </p>
        <div className="grid grid-cols-2 gap-x-3">
          <div>
            <label className="text-xs font-medium text-ui-fg-muted mb-1 block">
              Price Amount
            </label>
            <Input
              name="price"
              placeholder="e.g. 15.00"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ui-fg-muted mb-1 block">
              Currency
            </label>
            <Select value={currency} onValueChange={(val) => setCurrency(val)}>
              <Select.Trigger>
                <Select.Value placeholder="Currency" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="eur">EUR (€)</Select.Item>
                <Select.Item value="usd">USD ($)</Select.Item>
                <Select.Item value="gbp">GBP (£)</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
      </fieldset>

      <Button type="submit" isLoading={loading}>
        Create
      </Button>
    </form>
  )
}

export default CreateDigitalProductForm
