import { readCsvReferences, snakecaseKey } from "../../src/api/vendors/products/imports/csv-references"

/**
 * The seller product import is checked BEFORE it starts, by reading the CSV the
 * way Medusa's importer will. These tests pin that reading down, in particular
 * the case the old line-splitting check missed: a quoted comma that shifted the
 * columns so a foreign Product Id went unchecked.
 */
describe("readCsvReferences", () => {
  it("applies Medusa's header rule", () => {
    expect(snakecaseKey("Product Id")).toBe("product_id")
    expect(snakecaseKey("Variant Option 1 Id")).toBe("variant_option_1_id")
    expect(snakecaseKey("Shipping Profile Id")).toBe("shipping_profile_id")
  })

  it("reads product and variant ids and handles", () => {
    const csv = [
      "Product Id,Product Handle,Variant Id,Product Title",
      "prod_1,shirt,variant_1,Shirt",
      ",new-shirt,,New shirt",
    ].join("\n")

    const refs = readCsvReferences(csv)
    expect(refs.productIds).toEqual(["prod_1"])
    expect(refs.variantIds).toEqual(["variant_1"])
    expect(refs.handles.sort()).toEqual(["new-shirt", "shirt"])
    expect(refs.unsupportedColumns).toEqual([])
  })

  it("is not fooled by a quoted comma shifting the columns", () => {
    // The old check split lines on "," and read the wrong cell as the Product Id.
    const csv = [
      "Product Title,Product Id,Product Handle",
      '"Shirt, large",prod_FOREIGN,shirt',
    ].join("\n")

    expect(readCsvReferences(csv).productIds).toEqual(["prod_FOREIGN"])
  })

  it("refuses a row with the wrong number of cells, as the importer does", () => {
    const csv = ["Product Id,Product Handle", "prod_1,shirt,extra"].join("\n")
    expect(() => readCsvReferences(csv)).toThrow(/could not be read/)
  })

  it("reads a BOM-prefixed header the way the importer does: not as a Product Id", () => {
    // Medusa does not strip a BOM, so it does not recognise that column either and
    // performs no update from it. Reading it the same way is what keeps the check honest.
    const bom = String.fromCharCode(0xfeff)
    const csv = [`${bom}Product Id,Product Handle`, "prod_FOREIGN,shirt"].join("\n")
    const refs = readCsvReferences(csv)
    expect(refs.productIds).toEqual([])
    expect(refs.handles).toEqual(["shirt"])
  })

  it("reads references to types, collections, categories, tags, channels, profiles and options", () => {
    const csv = [
      "Product Handle,Product Type Id,Product Collection Id,Product Category 1,Product Tag 1,Product Sales Channel 1,Shipping Profile Id,Variant Option 1 Id",
      "shirt,ptyp_1,pcol_1,pcat_1,summer,sc_1,sp_1,opt_1",
    ].join("\n")

    const refs = readCsvReferences(csv)
    expect(refs.typeIds).toEqual(["ptyp_1"])
    expect(refs.collectionIds).toEqual(["pcol_1"])
    expect(refs.categoryIds).toEqual(["pcat_1"])
    expect(refs.tagValues).toEqual(["summer"])
    expect(refs.salesChannelIds).toEqual(["sc_1"])
    expect(refs.shippingProfileIds).toEqual(["sp_1"])
    expect(refs.optionIds).toEqual(["opt_1"])
  })

  it("flags an id column it cannot check, only when it carries a value", () => {
    const withValue = ["Product Handle,Product Mystery Id", "shirt,abc"].join("\n")
    expect(readCsvReferences(withValue).unsupportedColumns).toEqual(["Product Mystery Id"])

    const empty = ["Product Handle,Product Mystery Id", "shirt,"].join("\n")
    expect(readCsvReferences(empty).unsupportedColumns).toEqual([])
  })

  it("ignores empty cells and blank lines", () => {
    const csv = ["Product Id,Product Handle", ",shirt", "", ",hat"].join("\n")
    const refs = readCsvReferences(csv)
    expect(refs.productIds).toEqual([])
    expect(refs.handles.sort()).toEqual(["hat", "shirt"])
  })
})
