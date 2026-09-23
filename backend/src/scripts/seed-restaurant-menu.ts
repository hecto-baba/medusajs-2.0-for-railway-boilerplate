import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createRestaurantProductsWorkflow } from "../workflows/restaurant/workflows/create-restaurant-products"

export default async function seedRestaurantMenu({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("Starting Restaurant Menu Seeding...")

  let defaultSalesChannelId: string | undefined
  try {
    const { data: channels } = await query.graph({
      entity: "sales_channel",
      fields: ["id"],
      pagination: { take: 1 },
    })
    if (channels && channels.length > 0) {
      defaultSalesChannelId = channels[0].id
    }
  } catch (e) {}

  let defaultShippingProfileId: string | undefined
  try {
    const { data: profiles } = await query.graph({
      entity: "shipping_profile",
      fields: ["id"],
      pagination: { take: 1 },
    })
    if (profiles && profiles.length > 0) {
      defaultShippingProfileId = profiles[0].id
    }
  } catch (e) {}

  const { data: restaurants } = await query.graph({
    entity: "restaurant",
    fields: ["id", "name"],
  })

  logger.info(`Found ${restaurants?.length || 0} restaurants`)

  for (const rest of (restaurants || [])) {
    logger.info(`Seeding dishes for ${rest.name} (${rest.id})...`)
    
    const dishes = [
      {
        title: `${rest.name} Royal Paneer Butter Masala`,
        description: "Soft cottage cheese simmered in a rich tomato, butter, and cashew nut sauce infused with aromatic spices.",
        status: "published",
        shipping_profile_id: defaultShippingProfileId,
        sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
        metadata: {
          is_veg: true,
          dietary_type: "veg",
        },
        options: [{ title: "Portion", values: ["Regular"] }],
        variants: [
          {
            title: "Regular",
            manage_inventory: false,
            prices: [
              { currency_code: "eur", amount: 14.0 },
              { currency_code: "usd", amount: 15.0 },
              { currency_code: "gbp", amount: 12.5 },
            ],
            options: { Portion: "Regular" },
          },
        ],
      },
      {
        title: `${rest.name} Crispy Veg Spring Rolls [4 Pcs]`,
        description: "Golden crispy pastries packed with seasoned garden vegetables and noodles, served with sweet plum dip.",
        status: "published",
        shipping_profile_id: defaultShippingProfileId,
        sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
        metadata: {
          is_veg: true,
          dietary_type: "veg",
        },
        options: [{ title: "Portion", values: ["Regular"] }],
        variants: [
          {
            title: "Regular",
            manage_inventory: false,
            prices: [
              { currency_code: "eur", amount: 9.5 },
              { currency_code: "usd", amount: 10.0 },
              { currency_code: "gbp", amount: 8.5 },
            ],
            options: { Portion: "Regular" },
          },
        ],
      },
      {
        title: `${rest.name} Smoked BBQ Chicken Burger`,
        description: "Chargrilled chicken breast glazed in bold hickory BBQ sauce, melted cheddar, crisp lettuce, and onion relish on a brioche bun.",
        status: "published",
        shipping_profile_id: defaultShippingProfileId,
        sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
        metadata: {
          is_veg: false,
          dietary_type: "non_veg",
        },
        options: [{ title: "Portion", values: ["Regular"] }],
        variants: [
          {
            title: "Regular",
            manage_inventory: false,
            prices: [
              { currency_code: "eur", amount: 16.5 },
              { currency_code: "usd", amount: 18.0 },
              { currency_code: "gbp", amount: 14.5 },
            ],
            options: { Portion: "Regular" },
          },
        ],
      },
      {
        title: `${rest.name} Signature Garlic Butter Prawns`,
        description: "Juicy jumbo prawns flash-fried in garlic herb butter with a hint of white wine and cracked black pepper.",
        status: "published",
        shipping_profile_id: defaultShippingProfileId,
        sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
        metadata: {
          is_veg: false,
          dietary_type: "non_veg",
        },
        options: [{ title: "Portion", values: ["Regular"] }],
        variants: [
          {
            title: "Regular",
            manage_inventory: false,
            prices: [
              { currency_code: "eur", amount: 19.5 },
              { currency_code: "usd", amount: 21.0 },
              { currency_code: "gbp", amount: 17.0 },
            ],
            options: { Portion: "Regular" },
          },
        ],
      },
    ]

    try {
      await createRestaurantProductsWorkflow(container).run({
        input: {
          products: dishes as any[],
          restaurant_id: rest.id,
        },
      })
      logger.info(`Successfully added dishes to ${rest.name}`)
    } catch (err: any) {
      logger.error(`Error adding dishes to ${rest.name}: ${err.message}`)
    }
  }

  logger.info("Finished seeding restaurant menu dishes!")
}
