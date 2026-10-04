import { getVendorToken } from "@lib/data/cookies"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export const POST = async (req: NextRequest) => {
  const token = await getVendorToken(req)

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const url = `${BACKEND_URL}/vendors/uploads`

    // By passing the parsed formData directly as body to fetch, Node.js / undici
    // sets the proper multipart/form-data header with the correct boundary.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: formData,
      cache: "no-store",
    })

    const body = await res.text()

    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "File upload failed" },
      { status: 500 }
    )
  }
}
