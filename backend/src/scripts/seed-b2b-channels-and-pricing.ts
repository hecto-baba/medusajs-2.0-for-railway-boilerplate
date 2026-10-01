import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function seedB2BChannelsAndPricing({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any
  const apiKeyModule = container.resolve(Modules.API_KEY) as any
  const customerModule = container.resolve(Modules.CUSTOMER) as any
  const pricingModule = container.resolve(Modules.PRICING) as any
  const productModule = container.resolve(Modules.PRODUCT) as any
  const remoteLink = container.resolve(ContainerRegistrationKeys.LINK) as any

  logger.info("Configuring B2B Sales Channel & Wholesale Pricing according to Medusa B2B Recipe...")

  // 1. Create or retrieve B2B Sales Channel
  let b2bSalesChannel: any
  try {
    const existingChannels = await salesChannelModule.listSalesChannels({
      name: "B2B Wholesale Channel",
    })
    if (existingChannels && existingChannels.length > 0) {
      b2bSalesChannel = existingChannels[0]
      logger.info(`B2B Sales Channel exists: ${b2bSalesChannel.id}`)
    } else {
      b2bSalesChannel = await salesChannelModule.createSalesChannels({
        name: "B2B Wholesale Channel",
        description: "Dedicated sales channel for B2B contract clients and verified wholesale companies.",
        is_disabled: false,
      })
      logger.info(`Created B2B Sales Channel: ${b2bSalesChannel.id}`)
    }
  } catch (err) {
    logger.warn("Could not setup B2B sales channel: " + err)
  }

  // 2. Associate Publishable API Key with B2B Sales Channel
  try {
    const apiKeys = await apiKeyModule.listApiKeys({ type: "publishable" })
    if (apiKeys && apiKeys.length > 0 && b2bSalesChannel && remoteLink) {
      for (const key of apiKeys) {
        try {
          await remoteLink.create({
            [Modules.API_KEY]: {
              api_key_id: key.id,
            },
            [Modules.SALES_CHANNEL]: {
              sales_channel_id: b2bSalesChannel.id,
            },
          })
          logger.info(`Linked Publishable Key (${key.title}) to B2B Sales Channel`)
        } catch {
          // Already linked
        }
      }
    }
  } catch (err) {
    logger.warn("Could not link API key: " + err)
  }

  // 3. Add existing products to B2B Sales Channel
  try {
    if (b2bSalesChannel && remoteLink) {
      const products = await productModule.listProducts({}, { take: 10 })
      for (const prod of products) {
        try {
          await remoteLink.create({
            [Modules.PRODUCT]: {
              product_id: prod.id,
            },
            [Modules.SALES_CHANNEL]: {
              sales_channel_id: b2bSalesChannel.id,
            },
          })
        } catch {}
      }
      logger.info(`Added ${products.length} products to B2B Sales Channel`)
    }
  } catch (err) {
    logger.warn("Could not add products to B2B channel: " + err)
  }

  // 4. Retrieve Apex Wholesale Customer Group
  let customerGroup: any
  try {
    const groups = await customerModule.listCustomerGroups({
      name: "Apex Wholesale Group",
    })
    if (groups && groups.length > 0) {
      customerGroup = groups[0]
    }
  } catch {}

  // 5. Create B2B Wholesale Contract Price List scoped to Apex Wholesale Group
  if (customerGroup) {
    try {
      const existingPriceLists = await pricingModule.listPriceLists({
        title: "Apex Wholesale Contract Price List",
      })
      if (existingPriceLists && existingPriceLists.length > 0) {
        logger.info(`Wholesale Price List already exists: ${existingPriceLists[0].id}`)
      } else {
        const [priceList] = await pricingModule.createPriceLists([
          {
            title: "Apex Wholesale Contract Price List",
            description: "Exclusive contracted wholesale pricing for Apex Wholesale Group members.",
            status: "active",
            type: "sale",
            rules: {
              customer_group_id: [customerGroup.id],
            },
          },
        ])
        logger.info(`Created B2B Wholesale Price List: ${priceList.id} scoped to ${customerGroup.name}`)
      }
    } catch (priceErr) {
      logger.warn("Could not create wholesale price list: " + priceErr)
    }
  }

  logger.info("Successfully completed B2B Recipe setup (Sales Channel, API Key, Customer Group, Price List)!")
}
