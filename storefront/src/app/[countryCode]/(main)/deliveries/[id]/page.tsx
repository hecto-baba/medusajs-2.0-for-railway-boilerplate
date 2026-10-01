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
      <div className="content-container py-16 flex flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ui-border-base border-t-ui-fg-interactive mb-4" />
        <p className="text-ui-fg-subtle text-sm">Loading delivery status...</p>
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="content-container py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Delivery Not Found</h1>
        <p className="text-ui-fg-muted mb-6">
          We could not find any active delivery with ID: {id}
        </p>
        <Link
          href={`/${countryCode}/restaurants`}
          className="inline-block rounded-md bg-ui-bg-interactive px-4 py-2 text-sm text-white font-medium hover:opacity-90"
        >
          Browse Restaurants
        </Link>
      </div>
    )
  }

  const currentStep = getStepIndex(delivery.delivery_status)
  const isDeclined = delivery.delivery_status === "restaurant_declined"

  return (
    <div className="content-container py-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ui-border-base pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ui-fg-muted">
              Live Order Tracking
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Delivery #{delivery.id.slice(-8)}
          </h1>
          <p className="text-ui-fg-subtle text-xs mt-1">
            Last updated: {lastSync.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${countryCode}/restaurants`}
            className="text-xs font-medium text-ui-fg-interactive hover:underline"
          >
            ← Back to Restaurants
          </Link>
        </div>
      </div>

      {/* ETA Banner */}
      <div className="rounded-xl bg-ui-bg-subtle border border-ui-border-base p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-ui-fg-muted uppercase">
            Estimated Arrival
          </span>
          <div className="text-2xl font-bold text-ui-fg-base mt-0.5">
            {delivery.delivered_at ? (
              <span className="text-green-600">Order Delivered</span>
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
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            delivery.delivery_status === "delivered"
              ? "bg-green-100 text-green-800"
              : isDeclined
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {delivery.delivery_status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>

      {/* Visual Stepper */}
      {isDeclined ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-800 mb-8 text-center">
          <p className="font-semibold text-base">Order Declined</p>
          <p className="text-xs mt-1">
            The restaurant was unable to fulfill this order. Please contact support or place another order.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-6 mb-8">
          <h2 className="text-base font-semibold mb-6">Delivery Status</h2>
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            {STEPS.map((step, idx) => {
              const isCompleted = currentStep > idx
              const isCurrent = currentStep === idx

              return (
                <div
                  key={step.key}
                  className="flex md:flex-col items-center gap-4 md:gap-2 flex-1 relative z-10"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isCompleted
                        ? "bg-ui-bg-interactive text-white"
                        : isCurrent
                        ? "border-2 border-ui-border-interactive bg-ui-bg-base text-ui-fg-interactive ring-4 ring-blue-100"
                        : "border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted"
                    }`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div className="md:text-center">
                    <p
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? "text-ui-fg-base"
                          : isCompleted
                          ? "text-ui-fg-subtle"
                          : "text-ui-fg-muted"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-[11px] text-ui-fg-muted hidden md:block mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info Card: Restaurant & Delivery Details */}
      <div className="rounded-xl border border-ui-border-base bg-ui-bg-base p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🍽️</span>
          <h3 className="font-semibold text-sm">Restaurant Details</h3>
        </div>
        <p className="font-medium text-sm text-ui-fg-base">
          {delivery.restaurant?.name || "Restaurant Partner"}
        </p>
        {delivery.restaurant?.address && (
          <p className="text-xs text-ui-fg-subtle mt-1">
            {delivery.restaurant.address}
          </p>
        )}
        {delivery.restaurant?.phone && (
          <p className="text-xs text-ui-fg-muted mt-1">
            📞 {delivery.restaurant.phone}
          </p>
        )}
      </div>
    </div>
  )
}

