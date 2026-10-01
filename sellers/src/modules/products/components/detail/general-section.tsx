"use client"

import type { VendorProduct } from "@lib/data/vendor-client"
import { Button, StatusBadge } from "@medusajs/ui"
import Link from "next/link"
import { Row, Section } from "./section"
export { TrustClawAttributesSection } from "./trustclaw-attributes-section"

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
