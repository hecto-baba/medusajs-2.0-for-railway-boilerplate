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
import { AdminCreateProduct } from "@medusajs/medusa/api/admin/products/validators";
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
    }
  ]
})