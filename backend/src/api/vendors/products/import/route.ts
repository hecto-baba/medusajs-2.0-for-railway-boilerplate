/**
 * Legacy alias for /vendors/products/imports.
 *
 * Medusa kept both spellings on the admin API when the chunked importer landed,
 * and the JS SDK still calls the singular one. Re-exporting keeps a single
 * implementation - including its ownership checks - behind both paths.
 */
export { POST } from "../imports/route"
