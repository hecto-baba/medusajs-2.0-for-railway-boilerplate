"use client"

import { useEffect, useState } from "react"

import BillBreakdown from "@modules/common/components/bill-breakdown"
import Breadcrumbs from "@modules/common/components/breadcrumbs"
import Chip from "@modules/common/components/chip"
import DiscountBadge from "@modules/common/components/discount-badge"
import Drawer from "@modules/common/components/drawer"
import FreeDeliveryBar from "@modules/common/components/free-delivery-bar"
import Modal from "@modules/common/components/modal"
import Price from "@modules/common/components/price"
import ProductCard from "@modules/common/components/product-card"
import QtyStepper from "@modules/common/components/qty-stepper"
import SectionHeader from "@modules/common/components/section-header"

const Block = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="rounded-large bg-card p-5 shadow-lift">
    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">
      {title}
    </h3>
    {children}
  </section>
)

const Demo = () => {
  const [qty, setQty] = useState(0)
  const [pending, setPending] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [modal, setModal] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    document.documentElement.dataset.mode = next ? "dark" : "light"
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {}
  }

  const change = (delta: number) => {
    setPending(true)
    setTimeout(() => {
      setQty((q) => Math.max(0, q + delta))
      setPending(false)
    }, 400)
  }

  const stepper = (
    <QtyStepper
      quantity={qty}
      pending={pending}
      max={5}
      label="Demo product"
      onIncrement={() => change(1)}
      onDecrement={() => change(-1)}
    />
  )

  return (
    <div className="content-container py-8" data-testid="ui-showcase">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          UI components
        </h1>
        <button
          type="button"
          onClick={toggleDark}
          className="rounded-rounded border border-line bg-card px-4 py-2 text-sm font-bold"
        >
          {dark ? "Switch to light" : "Switch to dark"}
        </button>
      </div>

      <div className="grid gap-5">
        <Block title="Colour tokens">
          <div className="flex flex-wrap gap-3 text-xs font-bold">
            {[
              ["bg-canvas text-ink border border-line", "canvas"],
              ["bg-card text-ink border border-line", "card"],
              ["bg-ink text-canvas", "ink"],
              ["bg-brand text-brand-ink", "brand"],
              ["bg-brand-soft text-brand", "brand soft"],
              ["bg-pop text-pop-ink", "pop"],
              ["bg-success text-success-ink", "success"],
              ["bg-success-soft text-success", "success soft"],
              ["bg-line text-ink", "line"],
              ["bg-canvas text-muted border border-line", "muted text"],
            ].map(([cls, name]) => (
              <span key={name} className={`rounded-rounded px-3 py-2 ${cls}`}>
                {name}
              </span>
            ))}
          </div>
        </Block>

        <Block title="Typography">
          <p className="font-display text-4xl font-extrabold tracking-tight">
            Display heading
          </p>
          <p className="mt-2 text-base">
            Body text in the body face. The quick brown fox jumps over the lazy
            dog.
          </p>
          <p className="mt-1 text-sm text-muted">Muted supporting text</p>
        </Block>

        <Block title="Price and discount">
          <div className="flex flex-wrap items-end gap-8">
            <Price amount={39} currencyCode="eur" size="sm" />
            <Price amount={39} originalAmount={52} currencyCode="eur" />
            <Price
              amount={249}
              originalAmount={320}
              currencyCode="eur"
              size="lg"
              showBadge
            />
            <Price
              amount={24999}
              originalAmount={29999}
              currencyCode="eur"
              size="xl"
              showBadge
            />
            <DiscountBadge percent={25} />
            <DiscountBadge percent={0.2} />
          </div>
        </Block>

        <Block title="Chips">
          <div className="flex flex-wrap gap-2">
            <Chip>Arrives in 9 mins</Chip>
            <Chip tone="warning">Next free 12 Oct</Chip>
            <Chip tone="muted">Closed</Chip>
            <Chip tone="pop">New</Chip>
          </div>
        </Block>

        <Block title="ADD button and stepper (400 ms fake request, max 5)">
          <div className="flex flex-wrap items-center gap-6">
            {stepper}
            <QtyStepper
              size="lg"
              quantity={qty}
              pending={pending}
              max={5}
              addLabel="Add to cart"
              label="Demo product"
              onIncrement={() => change(1)}
              onDecrement={() => change(-1)}
            />
            <span className="text-sm text-muted">quantity: {qty}</span>
          </div>
        </Block>

        <Block title="Product card (three states)">
          <div className="grid grid-cols-2 gap-4 small:grid-cols-4">
            <ProductCard
              title="Banana Robusta"
              href="/store"
              unitLabel="6 pcs"
              amount={39}
              originalAmount={52}
              currencyCode="eur"
              action={stepper}
            />
            <ProductCard
              title="A product with a very long title that must wrap onto two lines and then clip"
              href="/store"
              unitLabel="From 4 options"
              amount={120}
              currencyCode="eur"
              tag="Rent"
              action={
                <a
                  href="#"
                  className="rounded-rounded border-[1.5px] border-brand px-3 py-2 text-sm font-extrabold text-brand"
                >
                  SELECT
                </a>
              }
            />
            <ProductCard title="No price, no image" href="/store" />
          </div>
        </Block>

        <Block title="Free delivery bar">
          <div className="grid max-w-md gap-3">
            <FreeDeliveryBar subtotal={149} threshold={199} currencyCode="eur" />
            <FreeDeliveryBar subtotal={220} threshold={199} currencyCode="eur" />
          </div>
        </Block>

        <Block title="Bill breakdown">
          <div className="max-w-md">
            <BillBreakdown
              currencyCode="eur"
              savings={27}
              lines={[
                { label: "Item total", amount: 149, strikeAmount: 176 },
                { label: "Delivery fee", text: "FREE", tone: "success" },
                { label: "Handling fee", amount: 5 },
              ]}
              total={{ label: "To pay now", amount: 154 }}
              footerLines={[
                {
                  label: "Balance due later (not charged now)",
                  amount: 2500,
                  tone: "muted",
                },
              ]}
            />
          </div>
        </Block>

        <Block title="Breadcrumbs and section header">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Fruits and veg", href: "/store" },
              { label: "Banana Robusta" },
            ]}
          />
          <SectionHeader title="Fresh picks for you" href="/store" />
        </Block>

        <Block title="Drawer and modal">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="rounded-rounded bg-brand px-4 py-2 font-bold text-brand-ink"
            >
              Open drawer
            </button>
            <button
              type="button"
              onClick={() => setModal(true)}
              className="rounded-rounded border border-line bg-card px-4 py-2 font-bold"
            >
              Open modal
            </button>
          </div>
        </Block>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="My cart"
        footer={
          <button
            type="button"
            onClick={() => setDrawer(false)}
            className="h-12 w-full rounded-large bg-brand font-extrabold text-brand-ink"
          >
            Proceed to checkout
          </button>
        }
      >
        <div className="grid gap-3">
          <FreeDeliveryBar subtotal={149} threshold={199} currencyCode="eur" />
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="rounded-large bg-card p-4 shadow-lift">
              Scrollable line {i + 1}
            </div>
          ))}
        </div>
      </Drawer>

      <Modal isOpen={modal} close={() => setModal(false)} size="small">
        <Modal.Title>Modal title</Modal.Title>
        <Modal.Description>
          Uses the card, ink and line tokens.
        </Modal.Description>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setModal(false)}
            className="rounded-rounded bg-brand px-4 py-2 font-bold text-brand-ink"
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default Demo
