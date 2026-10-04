import { getVendorToken } from "@lib/data/cookies"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

// Reads are retried by the user and by polling, so they fail fast. Writes and
// uploads get far longer: an abort mid-write can leave the change applied on the
// backend while the seller is told it failed.
const READ_TIMEOUT_MS = 15_000
const WRITE_TIMEOUT_MS = 120_000

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

  // Read the client's body before contacting the backend, so a malformed
  // upload is not reported as a backend failure.
  const requestBody = hasBody
    ? isJson
      ? await req.text()
      : await req.arrayBuffer()
    : undefined

  let status: number
  let body: string
  let upstreamContentType: string | null

  try {
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(hasBody ? { "content-type": contentType } : {}),
      },
      ...(hasBody ? { body: requestBody } : {}),
      cache: "no-store",
      // A hung backend would otherwise leave the page spinning indefinitely.
      signal: AbortSignal.timeout(hasBody ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS),
    })

    // The signal also covers reading the body, so it is read inside the try.
    status = res.status
    upstreamContentType = res.headers.get("content-type")
    body = await res.text()
  } catch (error) {
    // Connection refused / reset / timeout: answer with a clear gateway error
    // rather than letting Next.js log a stack trace and return an opaque 500.
    const timedOut = error instanceof Error && error.name === "TimeoutError"
    return NextResponse.json(
      {
        message: timedOut
          ? hasBody
            ? "The store backend took too long to respond. Your change may still have been saved - refresh before trying again."
            : "The store backend took too long to respond."
          : "The store backend is unreachable.",
      },
      { status: timedOut ? 504 : 502 }
    )
  }

  // The backend's status and body are passed through unchanged so the client
  // sees the real error rather than a generic proxy failure.
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": upstreamContentType ?? "application/json",
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
