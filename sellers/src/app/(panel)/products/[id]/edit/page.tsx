import { ProductEditor } from "@modules/products"
import { Metadata } from "next"

export const metadata: Metadata = { title: "Edit product" }

/**
 * The general-fields form, reached from the Edit button on the detail page.
 *
 * Kept as its own route rather than an inline drawer so the detail page stays
 * a read view: media, options and variants each save on their own, and mixing
 * those with a form that saves on submit makes it unclear what is pending.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6">
      <ProductEditor id={id} />
    </div>
  )
}
