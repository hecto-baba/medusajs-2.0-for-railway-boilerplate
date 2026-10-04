import Image from "next/image"

const ALLOWED_HOSTS = [
  /^images\.unsplash\.com$/,
  /\.supabase\.co$/,
  /^encrypted-tbn0\.gstatic\.com$/,
  /^localhost$/,
]

const extraHosts = (): string[] => {
  const out: string[] = []
  for (const v of [
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]) {
    if (!v) continue
    try {
      out.push(new URL(v.includes("://") ? v : `https://${v}`).hostname)
    } catch {}
  }
  return out
}

const canOptimize = (src: string) => {
  if (src.startsWith("/")) return true
  try {
    const host = new URL(src).hostname
    return ALLOWED_HOSTS.some((r) => r.test(host)) || extraHosts().includes(host)
  } catch {
    return false
  }
}

/**
 * Fixed-size content image. Optimised through next/image when the host is
 * allow-listed in next.config.js; admin-entered images from other hosts are
 * served as-is (unoptimized) so they still render.
 */
export default function RemoteImage({
  src,
  alt = "",
  width,
  height,
  className,
  priority = false,
}: {
  src: string
  alt?: string
  width: number
  height: number
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      unoptimized={!canOptimize(src)}
    />
  )
}
