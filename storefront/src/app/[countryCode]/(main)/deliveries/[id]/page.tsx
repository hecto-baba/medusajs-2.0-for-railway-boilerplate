"use client"

import { useEffect, useState, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

type Driver = {
  id: string
  first_name: string
  last_name: string
  phone?: string
}

type Restaurant = {
  id: string
  name: string
  address?: string
  phone?: string
}

type Delivery = {
  id: string
  transaction_id?: string
  delivery_status: string
  eta?: string | null
  delivered_at?: string | null
  driver?: Driver | null
  restaurant?: Restaurant | null
}

const STEPS = [
  { key: "pending", title: "Order Placed", desc: "Waiting for restaurant confirmation" },
  { key: "restaurant_accepted", title: "Accepted", desc: "Restaurant accepted your order" },
  { key: "restaurant_preparing", title: "Preparing", desc: "Kitchen is preparing your meal" },
  { key: "ready_for_pickup", title: "Ready for Pickup", desc: "Order is packed and ready" },
  { key: "in_transit", title: "Out for Delivery", desc: "Your order is on the way to you" },
  { key: "delivered", title: "Delivered", desc: "Delivered! Enjoy your meal" },
]

function getStepIndex(status: string): number {
  switch (status) {
    case "pending":
      return 0
    case "restaurant_accepted":
      return 1
    case "restaurant_preparing":
      return 2
    case "ready_for_pickup":
      return 3
    case "pickup_claimed":
    case "in_transit":
      return 4
    case "delivered":
      return 5
    default:
      return 0
  }
}

export default function DeliveryTrackingPage() {
  const params = useParams<{ id: string; countryCode: string }>()
  const id = params?.id
  const countryCode = params?.countryCode || "us"
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<Date>(new Date())

  const backendUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

  // 1. Initial fetch & Polling fallback
  useEffect(() => {
    if (!id) return

    const fetchDelivery = () => {
      fetch(`${backendUrl}/deliveries/${id}`, {
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.delivery) {
            setDelivery(data.delivery)
          }
          setLoading(false)
          setLastSync(new Date())
        })
        .catch((err) => {
          console.error("Failed to fetch delivery status:", err)
          setLoading(false)
        })
    }

    fetchDelivery()

    // 3-second polling fallback for robust real-time updates
    const interval = setInterval(fetchDelivery, 3000)
    return () => clearInterval(interval)
  }, [id, backendUrl])

  // 2. Real-time SSE subscription (Step 20)
  useEffect(() => {
    if (!id) return

    let eventSource: EventSource | null = null

    try {
      eventSource = new EventSource(`${backendUrl}/deliveries/${id}/subscribe`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastSync(new Date())

          if (data.response && "delivery_status" in data.response) {
            setDelivery((prev) => {
              if (!prev) return null
              return {
                ...prev,
                delivery_status: data.response.delivery_status,
                ...(data.response.eta ? { eta: data.response.eta } : {}),
                ...(data.response.delivered_at
                  ? { delivered_at: data.response.delivered_at }
                  : {}),
              }
            })

            startTransition(() => {
              router.refresh()
            })
          }
        } catch (e) {
          console.error("Failed to parse SSE message:", e)
        }
      }

      eventSource.onerror = (err) => {
        console.warn("SSE connection interrupted or closed:", err)
      }
    } catch (err) {
      console.error("Error setting up EventSource:", err)
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [id, backendUrl, router])

  const [advancingStep, setAdvancingStep] = useState<string | null>(null)

  const handleAdvanceStatus = async (endpoint: string) => {
    if (!id) return
    setAdvancingStep(endpoint)
    try {
      const res = await fetch(`${backendUrl}/deliveries/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })
      if (res.ok) {
        // Fetch updated status
        const getRes = await fetch(`${backendUrl}/deliveries/${id}`, {
          credentials: "include",
        })
        const data = await getRes.json()
        if (data.delivery) {
          const finalDelivery = data.delivery.result || data.delivery
          setDelivery(finalDelivery)
        }
        setLastSync(new Date())
      }
    } catch (err) {
      console.error(`Failed to trigger ${endpoint}:`, err)
    } finally {
      setAdvancingStep(null)
    }
  }

  if (loading) {
    return (
      <div className="content-container flex flex-col items-center justify-center py-16">
        <div className="mb-4 h-10 w-10 animate-spin rounded-circle border-4 border-line border-t-brand" />
        <p className="text-sm text-muted">Loading delivery status...</p>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="content-container py-16 text-center">
        <h1 className="mb-2 font-display text-3xl font-extrabold tracking-tight text-ink">
          Delivery Not Found
        </h1>
        <p className="mb-6 break-words text-muted">
          We could not find any active delivery with ID: {id}
        </p>
        <Link
          href={`/${countryCode}/restaurants`}
          className="inline-flex h-11 items-center rounded-large bg-brand px-5 text-sm font-extrabold text-brand-ink hover:opacity-90"
        >
          Browse Restaurants
        </Link>
      </div>
    )
  }

  const currentStep = getStepIndex(delivery.delivery_status)
  const isDeclined = delivery.delivery_status === "restaurant_declined"

  return (
    <div className="content-container max-w-3xl py-8">
      <div className="mb-6 flex flex-col justify-between gap-3 small:flex-row small:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-circle bg-success" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
              Live Order Tracking
            </span>
          </div>
          <h1 className="mt-1 break-words font-display text-3xl font-extrabold tracking-tight text-ink">
            Delivery #{delivery.id.slice(-8)}
          </h1>
          <p className="mt-1 text-xs text-muted">
            Last updated: {lastSync.toLocaleTimeString()}
          </p>
        </div>

        <Link
          href={`/${countryCode}/restaurants`}
          className="self-start text-sm font-bold text-brand hover:underline small:self-auto"
        >
          ‹ Back to Restaurants
        </Link>
      </div>

      <div className="mb-5 flex flex-col items-start justify-between gap-4 rounded-large bg-card p-5 shadow-lift small:flex-row small:items-center">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">
            Estimated Arrival
          </span>
          <div className="mt-0.5 font-display text-2xl font-extrabold tracking-tight text-ink">
            {delivery.delivered_at ? (
              <span className="text-success">Order Delivered</span>
            ) : delivery.eta ? (
              new Date(delivery.eta).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            ) : (
              "Calculating..."
            )}
          </div>
        </div>

        <span
          className={`rounded-circle px-3 py-1.5 text-xs font-bold ${
            delivery.delivery_status === "delivered"
              ? "bg-success-soft text-success"
              : isDeclined
              ? "bg-brand-soft text-brand"
              : "bg-pop text-pop-ink"
          }`}
        >
          {delivery.delivery_status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>

      {isDeclined ? (
        <div className="mb-5 rounded-large bg-brand-soft p-6 text-center text-brand">
          <p className="text-base font-extrabold">Order Declined</p>
          <p className="mt-1 text-xs">
            The restaurant was unable to fulfill this order. Please contact support or place another order.
          </p>
        </div>
      ) : (
        <div className="mb-5 rounded-large bg-card p-5 shadow-lift">
          <h2 className="mb-6 font-display text-lg font-extrabold tracking-tight text-ink">
            Delivery Status
          </h2>
          <div className="relative flex flex-col gap-6 small:flex-row small:items-start small:justify-between">
            {STEPS.map((step, idx) => {
              const isCompleted = currentStep > idx
              const isCurrent = currentStep === idx

              return (
                <div
                  key={step.key}
                  className="relative z-10 flex flex-1 items-center gap-4 small:flex-col small:gap-2"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-circle text-xs font-bold transition-all ${
                      isCompleted
                        ? "bg-brand text-brand-ink"
                        : isCurrent
                        ? "border-2 border-brand bg-card text-brand ring-4 ring-brand-soft"
                        : "border border-line bg-canvas text-muted"
                    }`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div className="min-w-0 small:text-center">
                    <p
                      className={`text-xs font-bold ${
                        isCurrent
                          ? "text-ink"
                          : isCompleted
                          ? "text-muted"
                          : "text-muted opacity-70"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 hidden text-[11px] text-muted small:block">
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-large bg-card p-5 shadow-lift">
        <h3 className="mb-3 font-display text-base font-extrabold tracking-tight text-ink">
          Restaurant Details
        </h3>
        <p className="break-words text-sm font-bold text-ink">
          {delivery.restaurant?.name || "Restaurant Partner"}
        </p>
        {delivery.restaurant?.address && (
          <p className="mt-1 break-words text-xs text-muted">
            {delivery.restaurant.address}
          </p>
        )}
        {delivery.restaurant?.phone && (
          <p className="mt-1 text-xs text-muted">{delivery.restaurant.phone}</p>
        )}
      </div>
    </div>
  )
}
