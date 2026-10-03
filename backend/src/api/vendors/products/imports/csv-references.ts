import { parse } from "csv-parse/sync"
import { lowerCaseFirst, MedusaError } from "@medusajs/framework/utils"

/**
 * Reads every REFERENCE (an id or a value that points at another record) out of
 * a product import CSV, exactly the way Medusa's importer will read it.
 *
 * Medusa's importer turns column headers into fields by a fixed rule and then
 * acts on whatever ids it finds, in a background step with no request. So the
 * only place a seller's request can still be checked is BEFORE the import
 * starts, and the check is only as good as its reading of the file. This reader
 * therefore uses the same parser and the same header rule as Medusa, rather than
 * splitting lines on commas (which a quoted comma defeats).
 *
 * See node_modules/@medusajs/core-flows/dist/product/helpers/normalize-for-import.js
 * and steps/normalize-products-to-chunks.js, which this mirrors.
 */

export type CsvReferences = {
  /** "Product Handle" of every row: the products this import will create. */
  handles: string[]
  /** "Product Id": rows that UPDATE an existing product. */
  productIds: string[]
  /** "Variant Id": rows that update an existing variant. */
  variantIds: string[]
  /** "Product Type Id". */
  typeIds: string[]
  /** "Product Collection Id". */
  collectionIds: string[]
  /** "Product Category N": category ids. */
  categoryIds: string[]
  /** "Product Tag N": tag VALUES (the importer matches tags by value). */
  tagValues: string[]
  /** "Product Sales Channel N": sales channel ids. */
  salesChannelIds: string[]
  /** "Shipping Profile Id". */
  shippingProfileIds: string[]
  /** "Variant Option N Id": existing product option ids. */
  optionIds: string[]
  /** Id-like columns this reader does not know how to check. The import is refused. */
  unsupportedColumns: string[]
}

/** Same header rule as Medusa: lower-case the first letter of each word, join with "_". */
export const snakecaseKey = (key: string): string =>
  key.split(" ").map(lowerCaseFirst).join("_")

const VARIANT_OPTION_ID = /^variant_option_\d+_id$/

export const readCsvReferences = (csv: string): CsvReferences => {
  let rows: Record<string, string>[]

  try {
    // The same options Medusa uses. No BOM stripping: a header with a BOM is not
    // recognised by the importer either, and then lands in unsupportedColumns.
    rows = parse(csv, { columns: true, skip_empty_lines: true })
  } catch (error: any) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `The CSV could not be read: ${error?.message ?? "invalid format"}`
    )
  }

  const found = {
    handles: new Set<string>(),
    productIds: new Set<string>(),
    variantIds: new Set<string>(),
    typeIds: new Set<string>(),
    collectionIds: new Set<string>(),
    categoryIds: new Set<string>(),
    tagValues: new Set<string>(),
    salesChannelIds: new Set<string>(),
    shippingProfileIds: new Set<string>(),
    optionIds: new Set<string>(),
    unsupportedColumns: new Set<string>(),
  }

  for (const row of rows) {
    for (const [header, raw] of Object.entries(row)) {
      // Medusa omits empty fields and treats a lone "\r" as empty.
      if (raw === undefined || raw === null || raw === "" || raw === "\r") {
        continue
      }

      const key = snakecaseKey(header)

      if (key === "product_handle") {
        found.handles.add(raw)
      } else if (key === "product_id") {
        found.productIds.add(raw)
      } else if (key === "variant_id") {
        found.variantIds.add(raw)
      } else if (key === "product_type_id") {
        found.typeIds.add(raw)
      } else if (key === "product_collection_id") {
        found.collectionIds.add(raw)
      } else if (key.startsWith("product_category_")) {
        found.categoryIds.add(raw)
      } else if (key.startsWith("product_tag_")) {
        found.tagValues.add(raw)
      } else if (key.startsWith("product_sales_channel_")) {
        found.salesChannelIds.add(raw)
      } else if (key.startsWith("shipping_profile_id")) {
        found.shippingProfileIds.add(raw)
      } else if (VARIANT_OPTION_ID.test(key)) {
        found.optionIds.add(raw)
      } else if (key === "variant_product_id") {
        // Omitted by the importer (variantFieldsToOmit): carries no reference.
      } else if (/_ids?$/.test(key) && (key.startsWith("product_") || key.startsWith("variant_"))) {
        // An id column Medusa would act on that we cannot check: refuse the file.
        found.unsupportedColumns.add(header)
      }
    }
  }

  return {
    handles: [...found.handles],
    productIds: [...found.productIds],
    variantIds: [...found.variantIds],
    typeIds: [...found.typeIds],
    collectionIds: [...found.collectionIds],
    categoryIds: [...found.categoryIds],
    tagValues: [...found.tagValues],
    salesChannelIds: [...found.salesChannelIds],
    shippingProfileIds: [...found.shippingProfileIds],
    optionIds: [...found.optionIds],
    unsupportedColumns: [...found.unsupportedColumns],
  }
}
