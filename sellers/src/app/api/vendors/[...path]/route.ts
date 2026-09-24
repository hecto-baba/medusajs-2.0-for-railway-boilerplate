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
  method: "GET" | "POST" | "PATCH" | "DELETE"
) => {
  const token = await getVendorToken(req)

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const search = req.nextUrl.search
  const url = `${BACKEND_URL}/vendors/${path.join("/")}${search}`

  // File uploads arrive as multipart/form-data with a generated boundary in
  // the content-type. Forcing application/json on every request would corrupt
  // them, and re-reading the body as text would lose the binary payload, so a
  // non-JSON request is streamed through with its original content-type.
  const contentType = req.headers.get("content-type") ?? "application/json"
  const isJson = contentType.includes("application/json")
  const hasBody = method === "POST" || method === "PATCH"

  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody ? { "content-type": contentType } : {}),
    },
    ...(hasBody
      ? { body: isJson ? await req.text() : await req.arrayBuffer() }
      : {}),
    cache: "no-store",
  })

  const body = await res.text()

  // The backend's status and body are passed through unchanged so the client
  // sees the real error rather than a generic proxy failure.
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

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => forward(req, (await params).path, "PATCH")

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => forward(req, (await params).path, "DELETE")
