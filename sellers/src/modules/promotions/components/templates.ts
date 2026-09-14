/**
 * The 6 promotion type presets, matching the admin's Type step exactly
 * (labels and descriptions copied from the admin dashboard's
 * routes/promotions/promotion-create/templates.ts).
 *
 * Each template maps to a concrete { type, target_type, method_type }
 * combination on application_method - the same fields the admin's own
 * template picker sets as defaultValues.
 */
export type PromotionTemplateId =
  | "amount_off_products"
  | "amount_off_order"
  | "percentage_off_product"
  | "percentage_off_order"
  | "buyget"
  | "free_shipping"

export type PromotionTemplate = {
  id: PromotionTemplateId
  title: string
  description: string
  promotionType: "standard" | "buyget"
  targetType: "order" | "shipping_methods" | "items"
  methodType: "fixed" | "percentage"
  /** Whether this template uses the Products step's target-rules picker. */
  usesTargetProducts: boolean
  /** Whether this template uses the Products step's buy-rules picker too. */
  usesBuyProducts: boolean
}

export const PROMOTION_TEMPLATES: PromotionTemplate[] = [
  {
    id: "amount_off_products",
    title: "Amount off products",
    description: "Discount specific products or collection of products",
    promotionType: "standard",
    targetType: "items",
    methodType: "fixed",
    usesTargetProducts: true,
    usesBuyProducts: false,
  },
  {
    id: "amount_off_order",
    title: "Amount off order",
    description: "Discounts the total order amount",
    promotionType: "standard",
    targetType: "order",
    methodType: "fixed",
    usesTargetProducts: false,
    usesBuyProducts: false,
  },
  {
    id: "percentage_off_product",
    title: "Percentage off product",
    description: "Discounts a percentage off selected products",
    promotionType: "standard",
    targetType: "items",
    methodType: "percentage",
    usesTargetProducts: true,
    usesBuyProducts: false,
  },
  {
    id: "percentage_off_order",
    title: "Percentage off order",
    description: "Discounts a percentage of the total order amount",
    promotionType: "standard",
    targetType: "order",
    methodType: "percentage",
    usesTargetProducts: false,
    usesBuyProducts: false,
  },
  {
    id: "buyget",
    title: "Buy X Get Y",
    description: "Buy X product(s), get Y product(s)",
    promotionType: "buyget",
    targetType: "items",
    methodType: "percentage",
    usesTargetProducts: true,
    usesBuyProducts: true,
  },
  {
    id: "free_shipping",
    title: "Free shipping",
    description: "Applies a 100% discount to shipping fees",
    promotionType: "standard",
    targetType: "shipping_methods",
    methodType: "percentage",
    usesTargetProducts: false,
    usesBuyProducts: false,
  },
]

export const getTemplate = (id: PromotionTemplateId): PromotionTemplate =>
  PROMOTION_TEMPLATES.find((template) => template.id === id) ??
  PROMOTION_TEMPLATES[0]

/** Reverses a saved promotion's fields back to the template that produced them, for edit. */
export const templateFromPromotion = (
  type: "standard" | "buyget",
  targetType: "order" | "shipping_methods" | "items",
  methodType: "fixed" | "percentage"
): PromotionTemplateId => {
  if (type === "buyget") {
    return "buyget"
  }

  if (targetType === "shipping_methods") {
    return "free_shipping"
  }

  if (targetType === "order") {
    return methodType === "percentage" ? "percentage_off_order" : "amount_off_order"
  }

  return methodType === "percentage" ? "percentage_off_product" : "amount_off_products"
}
