import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createRestaurantProductsWorkflow } from "../workflows/restaurant/workflows/create-restaurant-products"

export default async function seedBiryaniVariants({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  console.log("Seeding Biryani dishes with multi-variant portion sizes & dietary types...")

  // 1. Get default sales channel
  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
    pagination: { take: 1 },
  })
  const salesChannelId = channels?.[0]?.id

  // 2. Get default shipping profile
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    pagination: { take: 1 },
  })
  const shippingProfileId = profiles?.[0]?.id

  const restaurantId = "01M2837XEZF3VSFG15KYG9FARK" // Hecto Grill House

  const dishes = [
    {
      title: "Royal Hyderabadi Chicken Dum Biryani",
      description: "Authentic slow-cooked saffron basmati rice layered with aromatic marinated chicken, caramelized onions, mint, and whole spices.",
      thumbnail: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
      status: "published" as const,
      shipping_profile_id: shippingProfileId,
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata: {
        dietary_type: "non_veg",
        is_veg: false,
      },
      options: [
        {
          title: "Portion Size",
          values: ["Half Portion", "Regular Portion", "Full / Family Portion"],
        },
      ],
      variants: [
        {
          title: "Half Portion",
          manage_inventory: false,
          options: { "Portion Size": "Half Portion" },
          prices: [
            { currency_code: "eur", amount: 8.00 },
            { currency_code: "usd", amount: 8.50 },
            { currency_code: "gbp", amount: 7.00 },
          ],
        },
        {
          title: "Regular Portion",
          manage_inventory: false,
          options: { "Portion Size": "Regular Portion" },
          prices: [
            { currency_code: "eur", amount: 12.00 },
            { currency_code: "usd", amount: 13.00 },
            { currency_code: "gbp", amount: 10.50 },
          ],
        },
        {
          title: "Full / Family Portion",
          manage_inventory: false,
          options: { "Portion Size": "Full / Family Portion" },
          prices: [
            { currency_code: "eur", amount: 18.00 },
            { currency_code: "usd", amount: 19.50 },
            { currency_code: "gbp", amount: 16.00 },
          ],
        },
      ],
    },
    {
      title: "Shahi Paneer Tikka Dum Biryani",
      description: "Charcoal grilled cottage cheese cubes tossed in tandoori spices and baked with fragrant kewra-infused long grain rice.",
      thumbnail: "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=600&q=80",
      status: "published" as const,
      shipping_profile_id: shippingProfileId,
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata: {
        dietary_type: "veg",
        is_veg: true,
      },
      options: [
        {
          title: "Portion Size",
          values: ["Half Portion", "Regular Portion", "Full / Family Portion"],
        },
      ],
      variants: [
        {
          title: "Half Portion",
          manage_inventory: false,
          options: { "Portion Size": "Half Portion" },
          prices: [
            { currency_code: "eur", amount: 7.00 },
            { currency_code: "usd", amount: 7.50 },
            { currency_code: "gbp", amount: 6.00 },
          ],
        },
        {
          title: "Regular Portion",
          manage_inventory: false,
          options: { "Portion Size": "Regular Portion" },
          prices: [
            { currency_code: "eur", amount: 11.00 },
            { currency_code: "usd", amount: 12.00 },
            { currency_code: "gbp", amount: 9.50 },
          ],
        },
        {
          title: "Full / Family Portion",
          manage_inventory: false,
          options: { "Portion Size": "Full / Family Portion" },
          prices: [
            { currency_code: "eur", amount: 16.00 },
            { currency_code: "usd", amount: 17.50 },
            { currency_code: "gbp", amount: 14.00 },
          ],
        },
      ],
    },
    {
      title: "Nawabi Egg Dum Biryani",
      description: "Crispy fried golden eggs cooked with cardamom, cloves, and aromatic aged basmati rice served with spicy salan.",
      thumbnail: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80",
      status: "published" as const,
      shipping_profile_id: shippingProfileId,
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata: {
        dietary_type: "egg",
        is_veg: false,
      },
      options: [
        {
          title: "Portion Size",
          values: ["Half Portion", "Regular Portion", "Full / Family Portion"],
        },
      ],
      variants: [
        {
          title: "Half Portion",
          manage_inventory: false,
          options: { "Portion Size": "Half Portion" },
          prices: [
            { currency_code: "eur", amount: 6.50 },
            { currency_code: "usd", amount: 7.00 },
            { currency_code: "gbp", amount: 5.50 },
          ],
        },
        {
          title: "Regular Portion",
          manage_inventory: false,
          options: { "Portion Size": "Regular Portion" },
          prices: [
            { currency_code: "eur", amount: 10.00 },
            { currency_code: "usd", amount: 11.00 },
            { currency_code: "gbp", amount: 8.50 },
          ],
        },
        {
          title: "Full / Family Portion",
          manage_inventory: false,
          options: { "Portion Size": "Full / Family Portion" },
          prices: [
            { currency_code: "eur", amount: 15.00 },
            { currency_code: "usd", amount: 16.50 },
            { currency_code: "gbp", amount: 13.00 },
          ],
        },
      ],
    },
  ]

  const { result } = await createRestaurantProductsWorkflow(container).run({
    input: {
      products: dishes as any,
      restaurant_id: restaurantId,
    },
  })

  console.log(`Successfully seeded ${result.length} biryani products with variants and dietary types!`)
}