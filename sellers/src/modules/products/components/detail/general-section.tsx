"use client"

import type { VendorProduct } from "@lib/data/vendor-client"
import { Button, StatusBadge, toast } from "@medusajs/ui"
import Link from "next/link"
import { Row, Section } from "./section"

const STOREFRONT_URL = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:8000"
).replace(/\/+$/, "")

/**
 * The public storefront address of a product. Only meaningful once the
 * product is published: drafts, proposals and rejections 404 on the storefront.
 * The storefront's middleware adds the country code, so it is not needed here.
 */
const storefrontUrl = (product: VendorProduct): string | null =>
  product.status === "published" && product.handle
    ? `${STOREFRONT_URL}/products/${product.handle}`
    : null

const StorefrontUrl = ({ url }: { url: string }) => (
  <div className="flex items-center gap-x-2">
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover truncate"
    >
      {url}
    </a>
    <Button
      size="small"
      variant="secondary"
      onClick={() =>
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success("Product URL copied"))
          .catch(() => toast.error("Could not copy the URL"))
      }
    >
      Copy
    </Button>
  </div>
)

const STATUS_COLOR = {
  published: "green",
  draft: "grey",
  proposed: "orange",
  rejected: "red",
} as const

export const GeneralSection = ({ product }: { product: VendorProduct }) => (
  <Section
    title={product.title}
    actions={
      <>
        <StatusBadge
          color={
            STATUS_COLOR[product.status as keyof typeof STATUS_COLOR] ?? "grey"
          }
        >
          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
        </StatusBadge>
        <Button size="small" variant="secondary" asChild>
          <Link href={`/products/${product.id}/edit`}>Edit</Link>
        </Button>
      </>
    }
  >
    <Row label="Description">{product.description}</Row>
    <Row label="Subtitle">{product.subtitle}</Row>
    <Row label="Handle">{product.handle ? `/${product.handle}` : null}</Row>
    <Row label="Storefront URL">
      {storefrontUrl(product) ? (
        <StorefrontUrl url={storefrontUrl(product)!} />
      ) : null}
    </Row>
    <Row label="Material">{product.material}</Row>
    <Row label="Discountable">
      {product.discountable === undefined
        ? null
        : product.discountable
          ? "True"
          : "False"}
    </Row>
  </Section>
)

export const AttributesSection = ({ product }: { product: VendorProduct }) => (
  <Section
    title="Attributes"
    actions={
      <Button size="small" variant="secondary" asChild>
        <Link href={"/products/" + product.id + "/edit"}>Edit</Link>
      </Button>
    }
  >
    <Row label="Height">{product.height}</Row>
    <Row label="Width">{product.width}</Row>
    <Row label="Length">{product.length}</Row>
    <Row label="Weight">{product.weight}</Row>
    <Row label="MID code">{product.mid_code}</Row>
    <Row label="HS code">{product.hs_code}</Row>
    <Row label="Country of origin">{product.origin_country}</Row>
  </Section>
)
