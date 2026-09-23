import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RESTAURANT_MODULE } from "../modules/restaurant"
import { createRestaurantProductsWorkflow } from "../workflows/restaurant/workflows/create-restaurant-products"

export default async function seedCompleteRestaurant({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const restaurantModule = container.resolve(RESTAURANT_MODULE) as any

  logger.info("Seeding full featured restaurant with dishes and images...")

  // Fetch sales channel and shipping profile
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

  // 1. Create or retrieve Bella Napoli
  let restaurants = await restaurantModule.listRestaurants({ handle: "bella-napoli-trattoria" })
  let bellaNapoli = restaurants?.[0]

  if (!bellaNapoli) {
    logger.info("Creating Bella Napoli Gourmet Trattoria...")
    bellaNapoli = await restaurantModule.createRestaurants({
      name: "Bella Napoli Gourmet Trattoria",
      handle: "bella-napoli-trattoria",
      description: "Authentic wood-fired Neapolitan pizzas, handmade pastas, and artisanal Italian delicacies made with imported Italian mozzarella and fresh ingredients.",
      image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      address: "45 Via Del Corso, London, UK",
      phone: "+44 20 7946 0991",
      email: "orders@bellanapoli.com",
      is_open: true,
    })
  } else {
    logger.info("Updating Bella Napoli details...")
    await restaurantModule.updateRestaurants({
      id: bellaNapoli.id,
      image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      description: "Authentic wood-fired Neapolitan pizzas, handmade pastas, and artisanal Italian delicacies made with imported Italian mozzarella and fresh ingredients.",
      address: "45 Via Del Corso, London, UK",
      phone: "+44 20 7946 0991",
      email: "orders@bellanapoli.com",
      is_open: true,
    })
  }

  // 2. Also enrich Hecto Grill House with banner and details
  const grillList = await restaurantModule.listRestaurants({ handle: "hecto-grill" })
  if (grillList && grillList.length > 0) {
    await restaurantModule.updateRestaurants({
      id: grillList[0].id,
      image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
      description: "Premier smokehouse and steakhouse serving slow-smoked ribs, prime beef steaks, and house-crafted BBQ sauces.",
      address: "742 Broadway Ave, New York, NY",
      phone: "+1 212-555-0199",
      is_open: true,
    })
    logger.info("Updated Hecto Grill House banner and info")
  }

  // 3. Create full menu items for Bella Napoli with images, prices, veg/non-veg
  const dishes = [
    {
      title: "Wood-Fired Margherita Pizza",
      description: "San Marzano tomato sauce, fresh buffalo mozzarella, aromatic sweet basil leaves, and cold-pressed extra virgin olive oil on a 48-hour fermented crust.",
      thumbnail: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80",
      images: [{ url: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=600&q=80" }],
      status: "published",
      shipping_profile_id: defaultShippingProfileId,
      sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
      metadata: {
        is_veg: true,
        dietary_type: "veg",
      },
      options: [{ title: "Size", values: ["12-inch Regular"] }],
      variants: [
        {
          title: "12-inch Regular",
          manage_inventory: false,
          prices: [
            { currency_code: "eur", amount: 14.5 },
            { currency_code: "usd", amount: 16.0 },
            { currency_code: "gbp", amount: 12.95 },
          ],
          options: { Size: "12-inch Regular" },
        },
      ],
    },
    {
      title: "Creamy Truffle Mushroom Risotto",
      description: "Carnaroli rice slowly simmered in vegetable broth with sauteed porcini and wild forest mushrooms, finished with black truffle butter and aged Parmigiano-Reggiano.",
      thumbnail: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80",
      images: [{ url: "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80" }],
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
            { currency_code: "eur", amount: 18.0 },
            { currency_code: "usd", amount: 20.0 },
            { currency_code: "gbp", amount: 15.5 },
          ],
          options: { Portion: "Regular" },
        },
      ],
    },
    {
      title: "Crispy Pollo Alla Parmigiana",
      description: "Golden parmesan-crusted chicken breast baked with San Marzano marinara, melted provolone, and fresh oregano, served over garlic butter tagliatelle.",
      thumbnail: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=600&q=80",
      images: [{ url: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=600&q=80" }],
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
            { currency_code: "usd", amount: 22.0 },
            { currency_code: "gbp", amount: 17.0 },
          ],
          options: { Portion: "Regular" },
        },
      ],
    },
    {
      title: "Spicy Calabrian Diavola Pizza",
      description: "Spicy Calabrian spianata salami, fior di latte mozzarella, crushed chili flakes, and San Marzano tomato coulis drizzled with organic hot honey.",
      thumbnail: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80",
      images: [{ url: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80" }],
      status: "published",
      shipping_profile_id: defaultShippingProfileId,
      sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
      metadata: {
        is_veg: false,
        dietary_type: "non_veg",
      },
      options: [{ title: "Size", values: ["12-inch Regular"] }],
      variants: [
        {
          title: "12-inch Regular",
          manage_inventory: false,
          prices: [
            { currency_code: "eur", amount: 17.0 },
            { currency_code: "usd", amount: 19.0 },
            { currency_code: "gbp", amount: 14.95 },
          ],
          options: { Size: "12-inch Regular" },
        },
      ],
    },
    {
      title: "Artisanal Tiramisu al Mascarpone",
      description: "Traditional Savoiardi ladyfingers soaked in dark Italian espresso and marsala, layered with cloud-like mascarpone sabayon and dusted with raw cocoa.",
      thumbnail: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80",
      images: [{ url: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80" }],
      status: "published",
      shipping_profile_id: defaultShippingProfileId,
      sales_channels: defaultSalesChannelId ? [{ id: defaultSalesChannelId }] : undefined,
      metadata: {
        is_veg: true,
        dietary_type: "veg",
      },
      options: [{ title: "Portion", values: ["Individual"] }],
      variants: [
        {
          title: "Individual",
          manage_inventory: false,
          prices: [
            { currency_code: "eur", amount: 8.5 },
            { currency_code: "usd", amount: 9.5 },
            { currency_code: "gbp", amount: 7.5 },
          ],
          options: { Portion: "Individual" },
        },
      ],
    },
  ]

  try {
    await createRestaurantProductsWorkflow(container).run({
      input: {
        products: dishes as any[],
        restaurant_id: bellaNapoli.id,
      },
    })
    logger.info(`Successfully added 5 illustrated dishes to Bella Napoli!`)
  } catch (err: any) {
    logger.error(`Error adding dishes: ${err.message}`)
  }

  logger.info("Done seeding complete restaurant!")
}
