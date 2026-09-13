import { getVendorToken } from "@lib/data/cookies"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

/**
 * Same-origin proxy for the backend's /auth/mfa/* routes.
 *
 * A sibling of /api/vendors/[...path] rather than a case inside it: that proxy
 * forwards to BACKEND_URL/vendors/*, and MFA lives at BACKEND_URL/auth/mfa/*
 * instead - a different base path on the same backend, authenticated the same
 * way (the httpOnly vendor token as a Bearer header) since these routes scope
 * by auth_identity_id from the token, not by actor type. See PRODUCTS.md's
 * proxy rationale for why this cannot be called directly from the browser:
 * the token is httpOnly, and /auth is one of only three path prefixes Medusa
 * applies CORS to, but only for its own known auth routes.
 */
const forward = async (
  req: NextRequest,
  path: string[],
  method: "GET" | "POST" | "DELETE"
) => {
  const token = await getVendorToken()

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = `${BACKEND_URL}/auth/mfa/${path.join("/")}${req.nextUrl.search}`
  const hasBody = method === "POST"

  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody ? { "content-type": "application/json" } : {}),
    },
    ...(hasBody ? { body: await req.text() } : {}),
    cache: "no-store",
  })

  const body = await res.text()

  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  })
}

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => forward(req, (await params).path, "GET")

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => forward(req, (await params).path, "POST")

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => forward(req, (await params).path, "DELETE")
