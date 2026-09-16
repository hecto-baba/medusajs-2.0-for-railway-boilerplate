import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery
} from "@medusajs/framework/http";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { PostRentalConfigBodySchema } from "./admin/products/[id]/rental-config/route";
import { PostRentalStatusBodySchema } from "./admin/rentals/[id]/route";
import { GetRentalAvailabilitySchema } from "./store/products/[id]/rental-availability/route";
import { PostCartItemsRentalsBody } from "./store/carts/[id]/line-items/rentals/route";
import { PostCartItemsTicketsBody } from "./store/carts/[id]/line-items/tickets/route";
import { PostVenueBodySchema } from "./admin/venues/route";
import { PostTicketProductBodySchema } from "./admin/ticket-products/route";
import { GetTicketProductSeatsSchema } from "./store/ticket-products/[id]/seats/route";
import { PostVendorCreateSchema } from "./vendors/route";
import { GetVendorProductsSchema } from "./vendors/products/route";
import { GetVendorOrdersSchema } from "./vendors/orders/route";
import { GetVendorPromotionsSchema } from "./vendors/promotions/route";
import { GetVendorCampaignsSchema } from "./vendors/campaigns/route";
import { PostVendorRentalConfigSchema } from "./vendors/products/[id]/rental-config/route";
import { PostVendorInventoryLevelSchema } from "./vendors/products/[id]/variants/[variant_id]/inventory-levels/route";
import { GetVendorReturnReasonsSchema } from "./vendors/return-reasons/route";
import { GetVendorSearchSchema } from "./vendors/search/route";
import { GetVendorRefundReasonsSchema } from "./vendors/refund-reasons/route";
import {
  GetVendorInventoryItemsSchema,
  PostVendorCreateInventoryItemSchema,
} from "./vendors/inventory-items/route";
import { PostVendorUpdateInventoryItemSchema } from "./vendors/inventory-items/[id]/route";
import { PostVendorCreateInventoryLevelSchema } from "./vendors/inventory-items/[id]/location-levels/route";
import { PostVendorUpdateInventoryLevelSchema } from "./vendors/inventory-items/[id]/location-levels/[location_id]/route";
import { PostVendorBatchInventoryItemLocationLevelsSchema } from "./vendors/inventory-items/[id]/location-levels/batch/route";
import { PostVendorBatchInventoryItemsLocationLevelsSchema } from "./vendors/inventory-items/location-levels/batch/route";
import {
  GetVendorReservationsSchema,
  PostVendorCreateReservationSchema,
} from "./vendors/reservations/route";
import { PostVendorUpdateReservationSchema } from "./vendors/reservations/[id]/route";
import {
  GetVendorCustomersSchema,
  PostVendorCreateCustomerSchema,
} from "./vendors/customers/route";
import { PostVendorUpdateCustomerSchema } from "./vendors/customers/[id]/route";
import { PostVendorCreateCustomerAddressSchema } from "./vendors/customers/[id]/addresses/route";
import { PostVendorUpdateCustomerAddressSchema } from "./vendors/customers/[id]/addresses/[address_id]/route";
import {
  GetVendorCustomerGroupsSchema,
  PostVendorCreateCustomerGroupSchema,
} from "./vendors/customer-groups/route";
import { PostVendorUpdateCustomerGroupSchema } from "./vendors/customer-groups/[id]/route";
import { PostVendorCustomerGroupCustomersSchema } from "./vendors/customer-groups/[id]/customers/route";
import {
  GetVendorPriceListsSchema,
  PostVendorCreatePriceListSchema,
} from "./vendors/price-lists/route";
import { PostVendorUpdatePriceListSchema } from "./vendors/price-lists/[id]/route";
import { PostVendorBatchPriceListPricesSchema } from "./vendors/price-lists/[id]/prices/batch/route";
import { PostVendorRemoveProductsPriceListSchema } from "./vendors/price-lists/[id]/products/route";
import { PostVendorVenueBodySchema } from "./vendors/venues/route";
import { UpdateVendorVenueBodySchema } from "./vendors/venues/[id]/route";
import { PostVendorShowBodySchema } from "./vendors/shows/route";
import { GetVendorShowSeatsSchema } from "./vendors/shows/[id]/seats/route";
import {
  GetVendorCollectionsSchema,
  CreateVendorCollectionSchema,
} from "./vendors/collections/route";
import { UpdateVendorCollectionSchema } from "./vendors/collections/[id]/route";
import { ManageCollectionProductsSchema } from "./vendors/collections/[id]/products/route";
import {
  GetVendorCategoriesSchema,
  CreateVendorCategorySchema,
} from "./vendors/categories/route";
import { UpdateVendorCategorySchema } from "./vendors/categories/[id]/route";
import { ManageCategoryProductsSchema } from "./vendors/categories/[id]/products/route";
import {
  GetVendorProductOptionsSchema,
  CreateVendorProductOptionSchema,
} from "./vendors/product-options/route";
import { UpdateVendorProductOptionSchema } from "./vendors/product-options/[id]/route";
import {
  GetVendorDraftOrdersSchema,
  CreateVendorDraftOrderSchema,
} from "./vendors/draft-orders/route";
import {
  GetVendorTeamSchema,
  InviteVendorMemberSchema,
} from "./vendors/team/route";
import { UpdateVendorMemberSchema } from "./vendors/team/[id]/route";
import {
  GetVendorStockLocationsSchema,
  CreateVendorStockLocationSchema,
} from "./vendors/stock-locations/route";
import { UpdateVendorStockLocationSchema } from "./vendors/stock-locations/[id]/route";
import { CreateVendorShippingProfileSchema } from "./vendors/shipping-profiles/route";
import {
  GetVendorSalesChannelsSchema,
  CreateVendorSalesChannelSchema,
} from "./vendors/sales-channels/route";
import { UpdateVendorSalesChannelSchema } from "./vendors/sales-channels/[id]/route";
import { ManageSalesChannelProductsSchema } from "./vendors/sales-channels/[id]/products/route";
import {
  GetVendorProductTypesSchema,
  CreateVendorProductTypeSchema,
} from "./vendors/product-types/route";
import { UpdateVendorProductTypeSchema } from "./vendors/product-types/[id]/route";
import {
  GetVendorProductTagsSchema,
  CreateVendorProductTagSchema,
} from "./vendors/product-tags/route";
import { UpdateVendorProductTagSchema } from "./vendors/product-tags/[id]/route";
import {
  GetVendorApiKeysSchema,
  CreateVendorApiKeySchema,
} from "./vendors/api-keys/route";
import { UpdateVendorApiKeySchema } from "./vendors/api-keys/[id]/route";
import {
  AdminCreateReturnReason,
  AdminUpdateReturnReason
} from "@medusajs/medusa/api/admin/return-reasons/validators";
import {
  AdminCreatePaymentRefundReason,
  AdminUpdatePaymentRefundReason
} from "@medusajs/medusa/api/admin/refund-reasons/validators";
import {
  AdminBatchUpdateProductVariant,
  AdminCreateProductVariant,
  AdminLinkProductOptions,
  AdminUpdateProductVariant,
  AdminBatchCreateVariantInventoryItem,
  AdminBatchDeleteVariantInventoryItem,
  AdminBatchUpdateVariantInventoryItem,
  AdminBatchImageVariant,
  AdminBatchVariantImages,
  AdminBatchUpdateProduct,
  AdminCreateVariantInventoryItem,
  AdminImportProducts,
  AdminUpdateVariantInventoryItem,
  CreateProduct,
  CreateProductVariant
} from "@medusajs/medusa/api/admin/products/validators";
import { createBatchBody } from "@medusajs/medusa/api/utils/validators";
import { AdminCreateProduct, AdminUpdateProduct } from "@medusajs/medusa/api/admin/products/validators";
import {
  AdminCreatePromotion,
  AdminUpdatePromotion,
  AdminCreatePromotionRule,
  AdminUpdatePromotionRule
} from "@medusajs/medusa/api/admin/promotions/validators";
import {
  AdminCreateCampaign,
  AdminUpdateCampaign
} from "@medusajs/medusa/api/admin/campaigns/validators";
import multer from "multer";
import {
  GetTransactionTypesSchema,
  PostTransactionTypeSchema
} from "./admin/transaction-types/route";
import { PostTransactionTypeUpdateSchema } from "./admin/transaction-types/[id]/route";
import { PostTransactionTypeStatusSchema } from "./admin/transaction-types/[id]/status/route";
import { GetTransactionTypeActivitiesSchema } from "./admin/transaction-types/[id]/activities/route";
import { PostTransactionTypesReorderSchema } from "./admin/transaction-types/reorder/route";
import { TRANSACTION_TYPE_FIELDS } from "./admin/transaction-types/helpers";
import { csvUpload } from "./admin/transaction-types/import/upload-errors";
import { arrayUpload } from "./vendors/upload-errors";

// Memory storage: the CSV is parsed straight from the buffer and never needs
// to touch disk.
//
// The size limit matters more here than it looks. An unbounded upload is held
// as a Buffer, copied again by toString("utf-8"), parsed into row objects, and
// then persisted into the workflow engine's state for the full hour the import
// sits waiting for confirmation - so one oversized file occupies memory long
// after the request that sent it has returned. 5MB is roughly 50k rows, far
// beyond what this table is ever expected to hold.
const CSV_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const uploadCsv = csvUpload({
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    // Browsers disagree on the mimetype for .csv (text/csv,
    // application/vnd.ms-excel, sometimes application/octet-stream), so the
    // extension is what is actually enforced; the mimetype is only accepted
    // as a fallback signal. This rejects an image or archive outright rather
    // than letting it parse into a confusing list of per-row errors.
    const hasCsvExtension = /\.csv$/i.test(file.originalname);

    if (!hasCsvExtension) {
      callback(new Error("Only .csv files can be imported"));
      return;
    }

    callback(null, true);
  }
}, "file");

// Product media uploads for the vendor panel.
//
// Memory storage to match the admin route: uploadFilesWorkflow takes file
// contents as base64, so the bytes are needed in hand anyway and writing them
// to disk first would only add a temp file to clean up.
//
// The size cap is what keeps a vendor from exhausting server memory: each
// buffered file is copied again by toString("base64"), which inflates it by
// about a third, and several concurrent uploads are held at once.
const PRODUCT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const PRODUCT_MEDIA_MAX_FILES = 10;

const uploadProductMedia = arrayUpload({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PRODUCT_MEDIA_MAX_BYTES,
    files: PRODUCT_MEDIA_MAX_FILES
  },
  fileFilter: (_req, file, callback) => {
    // Images for product media, plus CSV for the product importer, which
    // uploads its file through this same route before calling
    // /vendors/products/imports. Anything else is refused: a public-read
    // bucket would otherwise let a vendor use the store as file hosting.
    const isImage = /^image\/(jpeg|png|gif|webp|avif|svg\+xml)$/.test(
      file.mimetype
    );
    // Browsers disagree on the mimetype for .csv (text/csv,
    // application/vnd.ms-excel, sometimes application/octet-stream), so for
    // those the extension is what is actually enforced.
    const isCsv = /\.csv$/i.test(file.originalname);

    if (!isImage && !isCsv) {
      callback(new Error("Only image files and .csv files can be uploaded"));
      return;
    }

    callback(null, true);
  }
}, "files");

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/transaction-types",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetTransactionTypesSchema, {
          isList: true,
          defaults: TRANSACTION_TYPE_FIELDS
        })
      ]
    },
    {
      matcher: "/admin/transaction-types",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostTransactionTypeSchema)
      ]
    },
    {
      matcher: "/admin/transaction-types/:id",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(createFindParams(), {
          defaults: TRANSACTION_TYPE_FIELDS
        })
      ]
    },
    {
      matcher: "/admin/transaction-types/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostTransactionTypeUpdateSchema)
      ]
    },
    {
      matcher: "/admin/transaction-types/:id/status",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostTransactionTypeStatusSchema)
      ]
    },
    // Restore takes no body - it returns the type exactly as it was - so
    // there is nothing to validate beyond the admin auth the namespace
    // already applies.
    {
      matcher: "/admin/transaction-types/:id/restore",
      methods: ["POST"],
      middlewares: []
    },
    {
      matcher: "/admin/transaction-types/:id/activities",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetTransactionTypeActivitiesSchema, {
          isList: true
        })
      ]
    },
    {
      matcher: "/admin/transaction-types/reorder",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostTransactionTypesReorderSchema)
      ]
    },
    {
      matcher: "/admin/transaction-types/import",
      methods: ["POST"],
      // csvUpload already wraps multer and translates its failures, so this
      // is a single ordinary middleware rather than an upload plus a
      // separate error handler.
      middlewares: [uploadCsv]
    },
    {
      matcher: "/admin/transaction-types/export",
      methods: ["POST"],
      middlewares: [
        validateAndTransformQuery(GetTransactionTypesSchema, {
          isList: true,
          defaults: TRANSACTION_TYPE_FIELDS
        })
      ]
    },
    {
      matcher: "/admin/products/:id/rental-config",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostRentalConfigBodySchema)
      ]
    },
    {
      matcher: "/admin/rentals/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostRentalStatusBodySchema)
      ]
    },
    {
      matcher: "/store/products/:id/rental-availability",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetRentalAvailabilitySchema, {})
      ]
    },
    {
      matcher: "/store/carts/:id/line-items/rentals",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostCartItemsRentalsBody)
      ]
    },
    {
      matcher: "/store/carts/:id/line-items/tickets",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostCartItemsTicketsBody)
      ]
    },
    {
      matcher: "/admin/venues",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVenueBodySchema)
      ]
    },
    {
      matcher: "/admin/venues",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(createFindParams(), {
          isList: true,
          defaults: ["id", "name", "address", "rows.*"]
        })
      ]
    },
    {
      matcher: "/admin/ticket-products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostTicketProductBodySchema)
      ]
    },
    {
      matcher: "/admin/ticket-products",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(createFindParams(), {
          isList: true,
          defaults: [
            "id",
            "product_id",
            "dates",
            "venue.*",
            "venue.rows.*",
            "variants.*",
            "product.*"
          ]
        })
      ]
    },
    {
      matcher: "/store/ticket-products/:id/seats",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetTicketProductSeatsSchema, {})
      ]
    },
    // allowUnregistered admits the JWT handed out by
    // /auth/vendor/emailpass/register, which has an auth identity but no vendor
    // admin behind it yet. The route itself rejects tokens that already carry an
    // actor_id, so this cannot be used to register a second time.
    {
      matcher: "/vendors",
      methods: ["POST"],
      middlewares: [
        authenticate("vendor", ["session", "bearer"], {
          allowUnregistered: true
        }),
        validateAndTransformBody(PostVendorCreateSchema)
      ]
    },
    {
      matcher: "/vendors/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/:p1/:id",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreateProduct)
      ]
    },
    // The list routes below are paginated, and their handlers read limit and
    // offset off validatedQuery. Without these entries that object is never
    // populated, so both would page by `undefined` and silently return the
    // schema defaults on every request.
    {
      matcher: "/vendors/products",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorProductsSchema, {})
      ]
    },
    {
      matcher: "/vendors/orders",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorOrdersSchema, {})
      ]
    },
    {
      matcher: "/vendors/search",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorSearchSchema, {})
      ]
    },
    {
      matcher: "/vendors/products/:id",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/products/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdateProduct)
      ]
    },
    // Nested product routes. The "/vendors/*" entry above matches a single
    // path segment only, so these deeper paths would otherwise reach their
    // handlers unauthenticated - and every one reads req.auth_context.actor_id,
    // which only authenticate() populates.
    {
      matcher: "/vendors/products/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/uploads",
      methods: ["POST"],
      middlewares: [
        authenticate("vendor", ["session", "bearer"]),
        uploadProductMedia
      ]
    },
    {
      matcher: "/vendors/products/:id/options/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminLinkProductOptions)
      ]
    },
    {
      matcher: "/vendors/products/:id/variants",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreateProductVariant)
      ]
    },
    {
      matcher: "/vendors/products/:id/variants/batch",
      methods: ["POST"],
      middlewares: [
        // createBatchBody wraps the two variant validators into the
        // { create, update, delete } envelope the route expects. Passing the
        // single-variant validator directly rejects the envelope outright.
        validateAndTransformBody(
          createBatchBody(CreateProductVariant, AdminBatchUpdateProductVariant)
        )
      ]
    },
    {
      matcher: "/vendors/products/:id/variants/:variant_id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdateProductVariant)
      ]
    },
    {
      matcher: "/vendors/products/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(
          createBatchBody(CreateProduct, AdminBatchUpdateProduct)
        )
      ]
    },
    {
      matcher: "/vendors/products/:id/variants/:variant_id/inventory-items",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreateVariantInventoryItem)
      ]
    },
    {
      matcher:
        "/vendors/products/:id/variants/:variant_id/inventory-items/:inventory_item_id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdateVariantInventoryItem)
      ]
    },
    {
      matcher: "/vendors/products/:id/variants/inventory-items/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(
          createBatchBody(
            AdminBatchCreateVariantInventoryItem,
            AdminBatchUpdateVariantInventoryItem,
            AdminBatchDeleteVariantInventoryItem
          )
        )
      ]
    },
    {
      matcher: "/vendors/products/:id/variants/:variant_id/images/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminBatchVariantImages)
      ]
    },
    {
      matcher: "/vendors/products/:id/images/:image_id/variants/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminBatchImageVariant)
      ]
    },
    // Import and its legacy /import spelling share one implementation, so both
    // paths get the same validator.
    {
      matcher: "/vendors/products/import",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminImportProducts)
      ]
    },
    {
      matcher: "/vendors/products/imports",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminImportProducts)
      ]
    },
    {
      matcher: "/vendors/products/:id/rental-config",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorRentalConfigSchema)
      ]
    },
    {
      matcher:
        "/vendors/products/:id/variants/:variant_id/inventory-levels",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorInventoryLevelSchema)
      ]
    },
    {
      matcher: "/vendors/promotions",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreatePromotion)
      ]
    },
    {
      matcher: "/vendors/promotions",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorPromotionsSchema, {})
      ]
    },
    {
      matcher: "/vendors/promotions/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdatePromotion)
      ]
    },
    // Nested promotion routes. The "/vendors/*" entry above matches a single
    // path segment only, same caveat as products/:id/* below it.
    {
      matcher: "/vendors/promotions/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/promotions/:id/target-rules/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(
          createBatchBody(AdminCreatePromotionRule, AdminUpdatePromotionRule)
        )
      ]
    },
    {
      matcher: "/vendors/promotions/:id/buy-rules/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(
          createBatchBody(AdminCreatePromotionRule, AdminUpdatePromotionRule)
        )
      ]
    },
    {
      matcher: "/vendors/campaigns",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreateCampaign)
      ]
    },
    {
      matcher: "/vendors/campaigns",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorCampaignsSchema, {})
      ]
    },
    {
      matcher: "/vendors/campaigns/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdateCampaign)
      ]
    },
    {
      matcher: "/vendors/return-reasons",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorReturnReasonsSchema, {})
      ]
    },
    {
      matcher: "/vendors/return-reasons",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreateReturnReason)
      ]
    },
    {
      matcher: "/vendors/return-reasons/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdateReturnReason)
      ]
    },
    {
      matcher: "/vendors/refund-reasons",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorRefundReasonsSchema, {})
      ]
    },
    {
      matcher: "/vendors/refund-reasons",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminCreatePaymentRefundReason)
      ]
    },
    {
      matcher: "/vendors/refund-reasons/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(AdminUpdatePaymentRefundReason)
      ]
    },
    {
      matcher: "/vendors/inventory-items",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorInventoryItemsSchema, {})
      ]
    },
    {
      matcher: "/vendors/inventory-items",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreateInventoryItemSchema)
      ]
    },
    {
      matcher: "/vendors/inventory-items/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdateInventoryItemSchema)
      ]
    },
    {
      matcher: "/vendors/inventory-items/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/inventory-items/:id/location-levels",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreateInventoryLevelSchema)
      ]
    },
    {
      matcher: "/vendors/inventory-items/:id/location-levels/:location_id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdateInventoryLevelSchema)
      ]
    },
    {
      matcher: "/vendors/inventory-items/:id/location-levels/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorBatchInventoryItemLocationLevelsSchema)
      ]
    },
    {
      matcher: "/vendors/inventory-items/location-levels/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorBatchInventoryItemsLocationLevelsSchema)
      ]
    },
    {
      matcher: "/vendors/reservations",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorReservationsSchema, {})
      ]
    },
    {
      matcher: "/vendors/reservations",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreateReservationSchema)
      ]
    },
    {
      matcher: "/vendors/reservations/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdateReservationSchema)
      ]
    },
    {
      matcher: "/vendors/reservations/:id/*",
      methods: ["POST"],
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/customers",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorCustomersSchema, {})
      ]
    },
    {
      matcher: "/vendors/customers",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreateCustomerSchema)
      ]
    },
    {
      matcher: "/vendors/customers/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdateCustomerSchema)
      ]
    },
    {
      matcher: "/vendors/customers/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/customers/:id/addresses",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreateCustomerAddressSchema)
      ]
    },
    {
      matcher: "/vendors/customers/:id/addresses/:address_id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdateCustomerAddressSchema)
      ]
    },
    {
      matcher: "/vendors/customer-groups",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorCustomerGroupsSchema, {})
      ]
    },
    {
      matcher: "/vendors/customer-groups",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreateCustomerGroupSchema)
      ]
    },
    {
      matcher: "/vendors/customer-groups/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdateCustomerGroupSchema)
      ]
    },
    {
      matcher: "/vendors/customer-groups/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/customer-groups/:id/customers",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCustomerGroupCustomersSchema)
      ]
    },
    {
      matcher: "/vendors/customer-groups/:id/customers/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCustomerGroupCustomersSchema)
      ]
    },
    {
      matcher: "/vendors/price-lists",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorPriceListsSchema, {})
      ]
    },
    {
      matcher: "/vendors/price-lists",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorCreatePriceListSchema)
      ]
    },
    {
      matcher: "/vendors/price-lists/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorUpdatePriceListSchema)
      ]
    },
    {
      matcher: "/vendors/price-lists/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/price-lists/:id/prices/batch",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorBatchPriceListPricesSchema)
      ]
    },
    {
      matcher: "/vendors/price-lists/:id/products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorRemoveProductsPriceListSchema)
      ]
    },
    {
      matcher: "/vendors/venues",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorVenueBodySchema)
      ]
    },
    {
      matcher: "/vendors/venues/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorVenueBodySchema)
      ]
    },
    {
      matcher: "/vendors/venues/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/shows",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostVendorShowBodySchema)
      ]
    },
    {
      matcher: "/vendors/shows/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/shows/:id/seats",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorShowSeatsSchema, {})
      ]
    },
    {
      matcher: "/vendors/collections",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorCollectionsSchema, {})
      ]
    },
    {
      matcher: "/vendors/collections",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorCollectionSchema)
      ]
    },
    {
      matcher: "/vendors/collections/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorCollectionSchema)
      ]
    },
    {
      matcher: "/vendors/collections/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/collections/:id/products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(ManageCollectionProductsSchema)
      ]
    },
    {
      matcher: "/vendors/categories",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorCategoriesSchema, {})
      ]
    },
    {
      matcher: "/vendors/categories",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorCategorySchema)
      ]
    },
    {
      matcher: "/vendors/categories/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorCategorySchema)
      ]
    },
    {
      matcher: "/vendors/categories/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/categories/:id/products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(ManageCategoryProductsSchema)
      ]
    },
    {
      matcher: "/vendors/product-options",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorProductOptionsSchema, {})
      ]
    },
    {
      matcher: "/vendors/product-options",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorProductOptionSchema)
      ]
    },
    {
      matcher: "/vendors/product-options/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorProductOptionSchema)
      ]
    },
    {
      matcher: "/vendors/product-options/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/draft-orders",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorDraftOrdersSchema, {})
      ]
    },
    {
      matcher: "/vendors/draft-orders",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorDraftOrderSchema)
      ]
    },
    {
      matcher: "/vendors/draft-orders/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/team",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorTeamSchema, {})
      ]
    },
    {
      matcher: "/vendors/team",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(InviteVendorMemberSchema)
      ]
    },
    {
      matcher: "/vendors/team/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorMemberSchema)
      ]
    },
    {
      matcher: "/vendors/team/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/stock-locations",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorStockLocationsSchema, {})
      ]
    },
    {
      matcher: "/vendors/stock-locations",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorStockLocationSchema)
      ]
    },
    {
      matcher: "/vendors/stock-locations/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorStockLocationSchema)
      ]
    },
    {
      matcher: "/vendors/stock-locations/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/shipping-profiles",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorShippingProfileSchema)
      ]
    },
    {
      matcher: "/vendors/sales-channels",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorSalesChannelsSchema, {})
      ]
    },
    {
      matcher: "/vendors/sales-channels",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorSalesChannelSchema)
      ]
    },
    {
      matcher: "/vendors/sales-channels/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorSalesChannelSchema)
      ]
    },
    {
      matcher: "/vendors/sales-channels/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/sales-channels/:id/products",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(ManageSalesChannelProductsSchema)
      ]
    },
    {
      matcher: "/vendors/product-types",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorProductTypesSchema, {})
      ]
    },
    {
      matcher: "/vendors/product-types",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorProductTypeSchema)
      ]
    },
    {
      matcher: "/vendors/product-types/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorProductTypeSchema)
      ]
    },
    {
      matcher: "/vendors/product-types/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/product-tags",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorProductTagsSchema, {})
      ]
    },
    {
      matcher: "/vendors/product-tags",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorProductTagSchema)
      ]
    },
    {
      matcher: "/vendors/product-tags/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorProductTagSchema)
      ]
    },
    {
      matcher: "/vendors/product-tags/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/vendors/api-keys",
      methods: ["GET"],
      middlewares: [
        validateAndTransformQuery(GetVendorApiKeysSchema, {})
      ]
    },
    {
      matcher: "/vendors/api-keys",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(CreateVendorApiKeySchema)
      ]
    },
    {
      matcher: "/vendors/api-keys/:id",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(UpdateVendorApiKeySchema)
      ]
    },
    {
      matcher: "/vendors/api-keys/:id/*",
      middlewares: [
        authenticate("vendor", ["session", "bearer"])
      ]
    },
    {
      matcher: "/admin/vendors*",
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"])
      ]
    }
  ]
})