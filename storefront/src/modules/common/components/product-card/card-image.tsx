"use client"

import Image from "next/image"
import { useState } from "react"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

/**
 * Product image that falls back to the placeholder icon when the file cannot
 * be loaded, instead of showing the browser's broken-image symbol.
 */
const CardImage = ({ src }: { src?: string | null }) => {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-muted">
        <PlaceholderImage size={28} />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="(max-width: 600px) 45vw, (max-width: 1024px) 25vw, 200px"
      className="object-contain p-2"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}

export default CardImage
