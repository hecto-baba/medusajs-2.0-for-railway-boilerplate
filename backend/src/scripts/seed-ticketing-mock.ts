import { onboardingStore } from "../lib/onboarding-store"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9000"

async function run() {
  console.log("Seeding mock Ticketing/Venues/Shows vendor...")

  const email = "arena@grandlive.com"
  const password = "password123"
  const vendorName = "Grand Arena Live & Entertainment"
  const handle = "grand-arena-live"

  // 1. Register Auth Identity
  let token: string | null = null
  try {
    const regRes = await fetch(`${BACKEND_URL}/auth/vendor/emailpass/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const regJson = await regRes.json()
    token = regJson.token
  } catch (err) {
    console.log("Registration step error or already exists:", err)
  }

  // 2. Create Vendor
  let vendorId: string | null = null
  if (token) {
    try {
      const vRes = await fetch(`${BACKEND_URL}/vendors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: vendorName,
          handle,
          admin: {
            email,
            first_name: "Marcus",
            last_name: "Vance",
          },
        }),
      })
      const vJson = await vRes.json()
      vendorId = vJson?.vendor?.id
      console.log("Vendor created with ID:", vendorId)
    } catch (err) {
      console.log("Vendor creation note:", err)
    }
  }

  // 3. Login to get authenticated actor session token
  let loginToken: string | null = null
  try {
    const loginRes = await fetch(`${BACKEND_URL}/auth/vendor/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const loginJson = await loginRes.json()
    loginToken = loginJson.token
    console.log("Logged in successfully. Session token obtained.")
  } catch (err) {
    console.error("Login failed:", err)
    return
  }

  if (!loginToken) {
    console.error("No login token obtained.")
    return
  }

  // Get vendor profile details
  const meRes = await fetch(`${BACKEND_URL}/vendors/me`, {
    headers: { Authorization: `Bearer ${loginToken}` },
  })
  const meJson = await meRes.json()
  vendorId = meJson?.vendor_admin?.vendor?.id || vendorId

  if (!vendorId) {
    console.error("Could not retrieve vendor ID.")
    return
  }

  // 4. Save and Approve Onboarding as Entertainment & Ticketing
  onboardingStore.saveStep(
    vendorId,
    "SEGMENT_SELECTION",
    {},
    {
      segmentId: "seg_entertainment",
      vendorTypeId: "vt_booking",
      vendorCategoryId: "vc_venues",
      segment: {
        id: "seg_entertainment",
        name: "Entertainment & Live Events",
        code: "ENTERTAINMENT",
      },
      vendorType: {
        id: "vt_booking",
        name: "Ticketing & Event Booking",
        code: "BOOKING",
      },
      vendorCategory: {
        id: "vc_venues",
        name: "Live Concerts & Arenas",
        code: "CONCERTS",
      },
    }
  )
  onboardingStore.approve(vendorId)
  console.log(`Onboarding status for vendor ${vendorId} set to APPROVED with BOOKING/ENTERTAINMENT capabilities.`)

  // 5. Create Mock Venue 1
  let venue1Id: string | null = null
  try {
    const venue1Res = await fetch(`${BACKEND_URL}/vendors/venues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginToken}`,
      },
      body: JSON.stringify({
        name: "Grand Symphony Concert Hall",
        address: "100 Festival Boulevard, Central Arts District",
        rows: [
          { row_number: "A", row_type: "vip", seat_count: 24 },
          { row_number: "B", row_type: "vip", seat_count: 24 },
          { row_number: "C", row_type: "premium", seat_count: 48 },
          { row_number: "D", row_type: "premium", seat_count: 48 },
          { row_number: "E", row_type: "standard", seat_count: 80 },
          { row_number: "F", row_type: "balcony", seat_count: 100 },
        ],
      }),
    })
    const v1Json = await venue1Res.json()
    venue1Id = v1Json?.venue?.id
    console.log("Venue 1 created:", v1Json?.venue?.name, "ID:", venue1Id)
  } catch (err) {
    console.log("Venue 1 creation note:", err)
  }

  // 6. Create Mock Venue 2
  let venue2Id: string | null = null
  try {
    const venue2Res = await fetch(`${BACKEND_URL}/vendors/venues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginToken}`,
      },
      body: JSON.stringify({
        name: "Skyline Open-Air Amphitheatre",
        address: "45 Riverside Promenade, West Waterfront",
        rows: [
          { row_number: "BOX-1", row_type: "vip", seat_count: 16 },
          { row_number: "FRONT-1", row_type: "premium", seat_count: 50 },
          { row_number: "LAWN-A", row_type: "standard", seat_count: 120 },
          { row_number: "LAWN-B", row_type: "balcony", seat_count: 200 },
        ],
      }),
    })
    const v2Json = await venue2Res.json()
    venue2Id = v2Json?.venue?.id
    console.log("Venue 2 created:", v2Json?.venue?.name, "ID:", venue2Id)
  } catch (err) {
    console.log("Venue 2 creation note:", err)
  }

  // 7. Create Mock Show 1
  if (venue1Id) {
    try {
      const show1Res = await fetch(`${BACKEND_URL}/vendors/shows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginToken}`,
        },
        body: JSON.stringify({
          name: "Summer Rock & Philharmonic Gala 2026",
          description: "An electrifying live crossover performance featuring top orchestral talent and modern symphonic rock.",
          venue_id: venue1Id,
          dates: ["2026-08-15T19:00:00.000Z", "2026-08-16T19:00:00.000Z"],
          variants: [
            {
              row_type: "vip",
              seat_count: 48,
              prices: [{ currency_code: "eur", amount: 120 }, { currency_code: "usd", amount: 130 }],
            },
            {
              row_type: "premium",
              seat_count: 96,
              prices: [{ currency_code: "eur", amount: 75 }, { currency_code: "usd", amount: 80 }],
            },
            {
              row_type: "standard",
              seat_count: 80,
              prices: [{ currency_code: "eur", amount: 45 }, { currency_code: "usd", amount: 50 }],
            },
            {
              row_type: "balcony",
              seat_count: 100,
              prices: [{ currency_code: "eur", amount: 28 }, { currency_code: "usd", amount: 30 }],
            },
          ],
        }),
      })
      const s1Json = await show1Res.json()
      console.log("Show 1 created:", s1Json?.show?.name)
    } catch (err) {
      console.log("Show 1 creation note:", err)
    }
  }

  // 8. Create Mock Show 2
  if (venue2Id) {
    try {
      const show2Res = await fetch(`${BACKEND_URL}/vendors/shows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loginToken}`,
        },
        body: JSON.stringify({
          name: "International Comedy All-Stars Live",
          description: "A hilarious night under the stars with award-winning standup comedians and improv troupes.",
          venue_id: venue2Id,
          dates: ["2026-09-05T20:00:00.000Z", "2026-09-06T20:00:00.000Z"],
          variants: [
            {
              row_type: "vip",
              seat_count: 16,
              prices: [{ currency_code: "eur", amount: 95 }, { currency_code: "usd", amount: 105 }],
            },
            {
              row_type: "premium",
              seat_count: 50,
              prices: [{ currency_code: "eur", amount: 55 }, { currency_code: "usd", amount: 60 }],
            },
            {
              row_type: "standard",
              seat_count: 120,
              prices: [{ currency_code: "eur", amount: 35 }, { currency_code: "usd", amount: 40 }],
            },
            {
              row_type: "balcony",
              seat_count: 200,
              prices: [{ currency_code: "eur", amount: 20 }, { currency_code: "usd", amount: 22 }],
            },
          ],
        }),
      })
      const s2Json = await show2Res.json()
      console.log("Show 2 created:", s2Json?.show?.name)
    } catch (err) {
      console.log("Show 2 creation note:", err)
    }
  }

  console.log("\n==================================================")
  console.log("Mock Ticketing & Venues Vendor Seeded Successfully!")
  console.log("Email:    arena@grandlive.com")
  console.log("Password: password123")
  console.log("==================================================")
}

run()
