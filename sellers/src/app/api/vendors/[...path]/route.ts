import { getVendorToken } from "@lib/data/cookies"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

/**
 * Same-origin proxy for the backend's /vendors/* routes.
 *
 * The session token lives in an httpOnly cookie so that client JavaScript
 * cannot read it - which also means a client component cannot attach it to a
 * request itself. The DataTable views are interactive and client-side, so
 * they call this route instead and it adds the Authorization header on the
 * server.
 *
 * Being same-origin, it also sidesteps CORS entirely: Medusa applies CORS to
 * /admin, /store and /auth only, so a browser calling /vendors/* on the
 * backend directly would be blocked with no configuration available to allow
 * it.
 */
const forward = async (
  req: NextRequest,
  path: string[],
  method: "GET" | "POST"
) => {
  const token = await getVendorToken()

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const search = req.nextUrl.search
  const url = `${BACKEND_URL}/vendors/${path.join("/")}${search}`

  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(method === "POST" ? { body: await req.text() } : {}),
    cache: "no-store",
  })

  const body = await res.text()

  // The backend's status and body are passed through unchanged so the client
  // sees the real error rather than a generic proxy failure.
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
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
