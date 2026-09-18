"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import {
  searchMasterProducts,
  fetchMasterProductFacets,
  getMasterProductDetail,
  checkVendorProductExists,
  type MasterCatalogSearchParams,
  type MasterCatalogFacetsParams,
} from "@lib/data/master-catalog-client"

// 300ms Debounce Hook
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handler)
  }, [value, delayMs])
  return debounced
}

export function useMasterProducts(
  params: MasterCatalogSearchParams,
  enabled = true
) {
  const debouncedSearch = useDebounce(params.search, 300)

  return useQuery({
    queryKey: ["master-products", { ...params, search: debouncedSearch }],
    queryFn: () =>
      searchMasterProducts({ ...params, search: debouncedSearch }),
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000, // 1 minute
    enabled,
  })
}

export function useMasterProductFacets(
  params: MasterCatalogFacetsParams,
  enabled = true
) {
  return useQuery({
    queryKey: ["master-product-facets", params],
    queryFn: () => fetchMasterProductFacets(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  })
}

export function useMasterProductDetail(
  id: string | null,
  segmentCode?: string
) {
  return useQuery({
    queryKey: ["master-product-detail", id, segmentCode],
    queryFn: () => (id ? getMasterProductDetail(id, segmentCode) : null),
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useCheckVendorProductExists(
  trustclawProductId: string | null
) {
  return useQuery({
    queryKey: ["vendor-product-exists", trustclawProductId],
    queryFn: () =>
      trustclawProductId
        ? checkVendorProductExists(trustclawProductId)
        : { exists: false },
    enabled: Boolean(trustclawProductId),
    staleTime: 30 * 1000,
  })
}
