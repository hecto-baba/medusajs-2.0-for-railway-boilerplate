"use server"

import { DigitalProduct } from "../../types/global"
import { sdk } from "../config"
import { getAuthHeaders, getCacheDirectives } from "./cookies"

export const getCustomerDigitalProducts = async () => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const { digital_products } = await sdk.client.fetch<{
    digital_products: DigitalProduct[]
  }>(`/store/customers/me/digital-products`, {
    headers,
    cache: "no-cache",
  })

  return digital_products as DigitalProduct[]
}

export const getDigitalMediaDownloadLink = async (mediaId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const { url } = await sdk.client.fetch<{
    url: string
  }>(`/store/customers/me/digital-products/${mediaId}/download`, {
    method: "POST",
    headers,
    cache: "no-cache",
  })

  return url
}

export const getDigitalProductPreview = async function ({
  id,
}: {
  id: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{
      previews: import("../../types/global").DigitalProductPreview[]
    }>(`/store/digital-products/${id}/preview`, {
      headers,
      cache: "no-cache",
    })
    .then(({ previews }) => (previews.length ? previews[0].url : ""))
}
