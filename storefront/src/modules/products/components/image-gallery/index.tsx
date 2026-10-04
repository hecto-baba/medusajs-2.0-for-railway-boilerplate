"use client"

import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import Image from "next/image"
import { useState } from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

/**
 * One large image with a thumbnail strip: down the left on wide screens,
 * underneath on narrow ones. Selecting a thumbnail swaps the large image.
 */
const ImageGallery = ({ images }: ImageGalleryProps) => {
  const gallery = images.filter((image) => !!image.url)
  const [activeIndex, setActiveIndex] = useState(0)
  const active = gallery[activeIndex]

  return (
    <div
      className="flex min-w-0 flex-col-reverse gap-3 small:flex-row"
      data-testid="image-gallery"
    >
      {gallery.length > 1 && (
        <ul
          className="no-scrollbar flex gap-2.5 overflow-x-auto small:max-h-[420px] small:w-[76px] small:shrink-0 small:flex-col small:overflow-y-auto small:overflow-x-visible"
          aria-label="Product images"
        >
          {gallery.map((image, index) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeIndex}
                data-testid="gallery-thumbnail"
                className={clx(
                  "relative block h-[72px] w-[72px] overflow-hidden rounded-[12px] border-[1.5px] bg-card transition-colors",
                  index === activeIndex
                    ? "border-brand"
                    : "border-line hover:border-muted"
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-contain p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={clx(
          "relative min-w-0 flex-1 overflow-hidden rounded-[22px] bg-card shadow-lift",
          // Capped so the picture never pushes the buy box below the fold. A
          // product with no image gets a short strip, not an empty square.
          active
            ? "aspect-[1/0.8] small:max-h-[420px]"
            : "aspect-[1/0.35] small:max-h-[180px]"
        )}
      >
        {active ? (
          <Image
            key={active.id}
            src={active.url}
            alt={`Product image ${activeIndex + 1}`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 600px"
            className="object-contain p-4"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <PlaceholderImage size={48} />
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageGallery
