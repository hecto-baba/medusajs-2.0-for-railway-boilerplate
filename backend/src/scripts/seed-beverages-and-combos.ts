import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRestaurantProductsWorkflow } from "../workflows/restaurant/workflows/create-restaurant-products"

export default async function seedBeveragesAndCombos({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  console.log("Seeding Juices, Pizzas, and Combos with multi-variant options & deals...")

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

  const items = [
    {
      title: "Fresh Alphonso Mango Cold-Pressed Juice",
      description: "100% natural, freshly squeezed ripe Alphonso mango nectar with crushed ice and organic mint leaves.",
      thumbnail: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80",
      status: "published" as const,
      shipping_profile_id: shippingProfileId,
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata: {
        dietary_type: "vegan",
        is_veg: true,
        promo_badge: "🥤 Buy 1 Get 1 Free",
      },
      options: [
        {
          title: "Volume / Size",
          values: ["Regular Glass (350ml)", "Large Mason Jar (500ml)", "Family Pitcher (1 Litre)"],
        },
      ],
      variants: [
        {
          title: "Regular Glass (350ml)",
          manage_inventory: false,
          options: { "Volume / Size": "Regular Glass (350ml)" },
          prices: [
            { currency_code: "eur", amount: 3.50 },
            { currency_code: "usd", amount: 4.00 },
            { currency_code: "gbp", amount: 3.00 },
          ],
        },
        {
          title: "Large Mason Jar (500ml)",
          manage_inventory: false,
          options: { "Volume / Size": "Large Mason Jar (500ml)" },
          prices: [
            { currency_code: "eur", amount: 5.50 },
            { currency_code: "usd", amount: 6.00 },
            { currency_code: "gbp", amount: 4.80 },
          ],
        },
        {
          title: "Family Pitcher (1 Litre)",
          manage_inventory: false,
          options: { "Volume / Size": "Family Pitcher (1 Litre)" },
          prices: [
            { currency_code: "eur", amount: 9.00 },
            { currency_code: "usd", amount: 10.00 },
            { currency_code: "gbp", amount: 8.00 },
          ],
        },
      ],
    },
    {
      title: "Wood-Fired Truffle Funghi Pizza",
      description: "Creamy wild mushroom purée, fior di latte, roasted portobello, white truffle oil, and shaved parmesan.",
      thumbnail: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
      status: "published" as const,
      shipping_profile_id: shippingProfileId,
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata: {
        dietary_type: "veg",
        is_veg: true,
        promo_badge: "🏷️ 20% OFF Deal",
      },
      options: [
        {
          title: "Crust / Size",
          values: ["10-inch Thin Crust", "12-inch Traditional", "14-inch Cheese Burst"],
        },
      ],
      variants: [
        {
          title: "10-inch Thin Crust",
          manage_inventory: false,
          options: { "Crust / Size": "10-inch Thin Crust" },
          prices: [
            { currency_code: "eur", amount: 9.00 },
            { currency_code: "usd", amount: 10.00 },
            { currency_code: "gbp", amount: 8.00 },
          ],
        },
        {
          title: "12-inch Traditional",
          manage_inventory: false,
          options: { "Crust / Size": "12-inch Traditional" },
          prices: [
            { currency_code: "eur", amount: 13.50 },
            { currency_code: "usd", amount: 14.50 },
            { currency_code: "gbp", amount: 12.00 },
          ],
        },
        {
          title: "14-inch Cheese Burst",
          manage_inventory: false,
          options: { "Crust / Size": "14-inch Cheese Burst" },
          prices: [
            { currency_code: "eur", amount: 17.50 },
            { currency_code: "usd", amount: 19.00 },
            { currency_code: "gbp", amount: 15.50 },
          ],
        },
      ],
    },
    {
      title: "Chef Special Smoked Burger Feast Combo",
      description: "Artisanal brioche burger with hand-cut seasoned waffle fries, garlic aioli dip, and your choice of drink.",
      thumbnail: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
      status: "published" as const,
      shipping_profile_id: shippingProfileId,
      sales_channels: salesChannelId ? [{ id: salesChannelId }] : undefined,
      metadata: {
        dietary_type: "non_veg",
        is_veg: false,
        promo_badge: "🎁 Free Drink Included",
      },
      options: [
        {
          title: "Combo Package",
          values: ["Solo Meal (Burger + Fries)", "Duo Feast (2 Burgers + Fries + 2 Drinks)", "Mega Party Platter (Serves 4)"],
        },
      ],
      variants: [
        {
          title: "Solo Meal (Burger + Fries)",
          manage_inventory: false,
          options: { "Combo Package": "Solo Meal (Burger + Fries)" },
          prices: [
            { currency_code: "eur", amount: 9.50 },
            { currency_code: "usd", amount: 10.50 },
            { currency_code: "gbp", amount: 8.50 },
          ],
        },
        {
          title: "Duo Feast (2 Burgers + Fries + 2 Drinks)",
          manage_inventory: false,
          options: { "Combo Package": "Duo Feast (2 Burgers + Fries + 2 Drinks)" },
          prices: [
            { currency_code: "eur", amount: 18.50 },
            { currency_code: "usd", amount: 20.00 },
            { currency_code: "gbp", amount: 16.00 },
          ],
        },
        {
          title: "Mega Party Platter (Serves 4)",
          manage_inventory: false,
          options: { "Combo Package": "Mega Party Platter (Serves 4)" },
          prices: [
            { currency_code: "eur", amount: 34.00 },
            { currency_code: "usd", amount: 37.00 },
            { currency_code: "gbp", amount: 30.00 },
          ],
        },
      ],
    },
  ]

  const { result } = await createRestaurantProductsWorkflow(container).run({
    input: {
      products: items as any,
      restaurant_id: restaurantId,
    },
  })

  console.log(`Successfully seeded ${result.length} food & beverage items with custom variants & offer badges!`)
}