"use client"

import {
  getVendorOnboardingStatus,
  getVendorOnboardingQuestions,
  getVendorOnboardingAnswers,
  saveVendorOnboardingStep,
  submitVendorOnboarding,
  getTrustClawSegments,
  getTrustClawVendorTypes,
  getTrustClawVendorCategories,
  type SaveVendorOnboardingStepPayload,
} from "@lib/data/vendor-client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export const ONBOARDING_QUERY_KEY = ["vendor", "onboarding"] as const

export const useVendorOnboardingStatus = () => {
  return useQuery({
    queryKey: [...ONBOARDING_QUERY_KEY, "status"],
    queryFn: async () => {
      const res = await getVendorOnboardingStatus().catch(() => null)
      return res?.onboarding ?? null
    },
    staleTime: 30 * 1000,
  })
}

export const useVendorOnboardingAnswers = () => {
  return useQuery({
    queryKey: [...ONBOARDING_QUERY_KEY, "answers"],
    queryFn: async () => {
      const res = await getVendorOnboardingAnswers()
      return res.answers
    },
    staleTime: 60 * 1000,
  })
}

export const useVendorOnboardingQuestions = (params: {
  vendorCategoryId?: string
  step?: string
  segmentId?: string
  vendorTypeId?: string
} = {}) => {
  return useQuery({
    queryKey: [...ONBOARDING_QUERY_KEY, "questions", params],
    queryFn: async () => {
      const res = await getVendorOnboardingQuestions(params)
      return res.questions
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useSaveVendorOnboardingStep = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SaveVendorOnboardingStepPayload) =>
      saveVendorOnboardingStep(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...ONBOARDING_QUERY_KEY, "status"] })
      queryClient.invalidateQueries({ queryKey: [...ONBOARDING_QUERY_KEY, "answers"] })
    },
  })
}

export const useSubmitVendorOnboarding = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => submitVendorOnboarding(),
    onSuccess: (data) => {
      queryClient.setQueryData([...ONBOARDING_QUERY_KEY, "status"], (old: any) => ({
        ...(old || {}),
        status: data?.result?.status || "UNDER_REVIEW",
        submittedAt: data?.result?.submittedAt || new Date().toISOString(),
      }))
      queryClient.invalidateQueries({ queryKey: [...ONBOARDING_QUERY_KEY] })
    },
  })
}

export const useTaxonomySegments = () => {
  return useQuery({
    queryKey: ["taxonomy", "segments"],
    queryFn: () => getTrustClawSegments(),
    staleTime: 10 * 60 * 1000,
  })
}

export const useTaxonomyVendorTypes = (params: {
  segmentCode?: string
  segmentId?: string
} = {}) => {
  return useQuery({
    queryKey: ["taxonomy", "vendor-types", params],
    queryFn: () => getTrustClawVendorTypes(params),
    staleTime: 10 * 60 * 1000,
  })
}

export const useTaxonomyVendorCategories = (params: {
  segmentCode?: string
  segmentId?: string
  vendorTypeCode?: string
  vendorTypeId?: string
} = {}) => {
  return useQuery({
    queryKey: ["taxonomy", "vendor-categories", params],
    queryFn: () => getTrustClawVendorCategories(params),
    staleTime: 10 * 60 * 1000,
  })
}
