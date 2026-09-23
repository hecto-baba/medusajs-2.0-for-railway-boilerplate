"use client"

import {
  updateVendorProduct,
  uploadVendorImages,
  type VendorProduct,
} from "@lib/data/vendor-client"
import { Button, IconButton, Text, toast } from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Section } from "./section"

/**
 * Product images: upload, remove, and pick the thumbnail.
 *
 * Images are written by sending the whole list back on the product update -
 * the images field is replace-semantics, not append - so removing one means
 * PUTting the remaining set rather than calling a delete endpoint.
 */
export const MediaSection = ({ product }: { product: VendorProduct }) => {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const images = product.images ?? []

  const { mutateAsync: save } = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      updateVendorProduct(product.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-product", product.id] })
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
    },
  })

  const onUpload = async (files: FileList) => {
    setBusy(true)

    try {
      const uploaded = await uploadVendorImages(Array.from(files))

      await save({
        images: [
          ...images.map((image) => ({ url: image.url })),
          ...uploaded.map((file) => ({ url: file.url })),
        ],
        // A product with no thumbnail shows a placeholder everywhere, so the
        // first image uploaded becomes it unless one is already set.
        ...(product.thumbnail ? {} : { thumbnail: uploaded[0]?.url }),
      })

      toast.success(
        uploaded.length === 1 ? "Image added." : `${uploaded.length} images added.`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload the images."
      )
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (url: string) => {
    setBusy(true)

    try {
      const remaining = images.filter((image) => image.url !== url)

      await save({
        images: remaining.map((image) => ({ url: image.url })),
        // Dropping the image that was the thumbnail would leave the product
        // pointing at a URL it no longer owns, so it falls back to whatever
        // image is left, or to nothing.
        ...(product.thumbnail === url
          ? { thumbnail: remaining[0]?.url ?? null }
          : {}),
      })

      toast.success("Image removed.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove the image."
      )
    } finally {
      setBusy(false)
    }
  }

  const onMakeThumbnail = async (url: string) => {
    setBusy(true)

    try {
      await save({ thumbnail: url })
      toast.success("Thumbnail updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not set the thumbnail."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Media"
      actions={
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                onUpload(event.target.files)
              }
              event.target.value = ""
            }}
          />
          <Button
            size="small"
            variant="secondary"
            isLoading={busy}
            onClick={() => inputRef.current?.click()}
          >
            Add images
          </Button>
        </>
      }
    >
      <div className="px-6 py-4">
        {images.length ? (
          <div className="flex flex-wrap gap-4">
            {images.map((image) => {
              const isThumbnail = product.thumbnail === image.url

              return (
                <div
                  key={image.id ?? image.url}
                  className="group border-ui-border-base relative h-28 w-28 overflow-hidden rounded-lg border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {isThumbnail ? (
                    <span className="bg-ui-bg-base text-ui-fg-subtle txt-compact-xsmall absolute left-1 top-1 rounded px-1.5 py-0.5">
                      Thumbnail
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMakeThumbnail(image.url)}
                      disabled={busy}
                      className="bg-ui-bg-base text-ui-fg-subtle txt-compact-xsmall absolute left-1 top-1 hidden rounded px-1.5 py-0.5 group-hover:block"
                    >
                      Make thumbnail
                    </button>
                  )}
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={busy}
                    onClick={() => onRemove(image.url)}
                    className="bg-ui-bg-base absolute right-1 top-1 hidden group-hover:flex"
                  >
                    <Trash />
                  </IconButton>
                </div>
              )
            })}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            No images yet. Shoppers see a placeholder until you add one.
          </Text>
        )}
      </div>
    </Section>
  )
}
