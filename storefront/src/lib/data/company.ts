"use server"

import { sdk } from "../config"
import { getAuthHeaders } from "./cookies"
import { revalidatePath } from "next/cache"

export type CompanyData = {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  currency_code?: string
}

export type EmployeeData = {
  id: string
  is_admin: boolean
  spending_limit?: number | null
}

export type CompanyEmployee = {
  id: string
  is_admin: boolean
  spending_limit?: number | null
  customer?: {
    id: string
    first_name?: string
    last_name?: string
    email: string
    phone?: string
  }
}

export type CustomerCompanyResponse = {
  company: CompanyData | null
  employee: EmployeeData | null
  employees: CompanyEmployee[]
  is_manager: boolean
  spending_limit: number | null
}

export const getCustomerCompany = async (): Promise<CustomerCompanyResponse> => {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }

    const res = await sdk.client.fetch<CustomerCompanyResponse>(
      `/store/customers/me/company`,
      {
        headers,
        cache: "no-cache",
      }
    )

    return {
      ...res,
      employees: res.employees || [],
    }
  } catch (error) {
    return {
      company: null,
      employee: null,
      employees: [],
      is_manager: false,
      spending_limit: null,
    }
  }
}

export const addCompanyEmployee = async (payload: {
  first_name: string
  last_name: string
  email: string
  password?: string
  is_admin?: boolean
  spending_limit?: number | null
  phone?: string
}) => {
  const headers = await getAuthHeaders()
  try {
    const res = await sdk.client.fetch<any>(
      `/store/customers/me/company/employees`,
      {
        method: "POST",
        headers,
        body: payload,
      }
    )
    revalidatePath("/[countryCode]/account/company", "page")
    return { success: true, employee: res.employee }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to add employee",
    }
  }
}

export const getCompanyApprovals = async () => {
  try {
    const headers = {
      ...(await getAuthHeaders()),
    }

    const { approvals } = await sdk.client.fetch<{ approvals: any[] }>(
      `/store/approvals`,
      {
        headers,
        cache: "no-cache",
      }
    )

    return approvals || []
  } catch (error) {
    return []
  }
}

export const submitCartForApproval = async (cartId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const res = await sdk.client.fetch<{ success: boolean; message: string }>(
    `/store/carts/${cartId}/submit-approval`,
    {
      method: "POST",
      headers,
      cache: "no-cache",
    }
  )

  return res
}

export const updateApprovalStatus = async (
  approvalId: string,
  status: "approved" | "rejected"
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const res = await sdk.client.fetch<{ success: boolean }>(
    `/store/approvals`,
    {
      method: "POST",
      headers,
      body: { approval_id: approvalId, status },
      cache: "no-cache",
    }
  )

  return res
}
