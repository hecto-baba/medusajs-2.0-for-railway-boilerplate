import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  ArrowPath,
  ArrowUpRightOnBox,
  Buildings,
  BuildingStorefront,
  Calendar,
  CheckCircle,
  Clock,
  CogSixTooth,
  CurrencyDollar,
  Folder,
  Key,
  MagnifyingGlass,
  MapPin,
  ReceiptPercent,
  ShoppingCart,
  SquareTwoStack,
  Tag,
  Users,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  StatusBadge,
  Table,
  Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { sdk } from "../../../lib/sdk"

type SingleVendor360Response = {
  vendor: {
    id: string
    name: string
    handle: string
    logo?: string | null
    created_at: string
    updated_at: string
  }
  admins?: Array<{
    id: string
    first_name?: string | null
    last_name?: string | null
    email: string
  }>
  products?: Array<{
    id: string
    title: string
    handle: string
    thumbnail?: string | null
    status?: string
    created_at: string
    collection_id?: string | null
    collection?: { id: string; title: string } | null
    categories?: Array<{ id: string; name: string }>
    variants?: Array<{
      id: string
      title: string
      sku?: string | null
      prices?: Array<{ amount: number; currency_code: string }>
    }>
    options?: Array<{
      id: string
      title: string
      values?: Array<{ value: string }>
    }>
    sales_channels?: Array<{ id: string; name: string }>
  }>
  collections?: Array<{
    id: string
    title: string
    handle: string
    products_count?: number
    created_at: string
  }>
  categories?: Array<{
    id: string
    name: string
    handle: string
    description?: string | null
    is_active?: boolean
    products_count?: number
    created_at: string
  }>
  product_options?: Array<{
    id: string
    title: string
    product_title?: string
    values?: string[]
  }>
  orders?: Array<{
    id: string
    display_id?: number
    created_at: string
    status?: string
    payment_status?: string
    fulfillment_status?: string
    currency_code?: string
    total?: number
    customer?: {
      id?: string
      email: string
      first_name?: string | null
      last_name?: string | null
      phone?: string | null
    }
    items?: Array<{
      id: string
      title: string
      quantity: number
      unit_price: number
      thumbnail?: string | null
    }>
  }>
  inventory_items?: Array<{
    id: string
    sku?: string | null
    title?: string | null
    description?: string | null
    requires_shipping?: boolean
    stocked_quantity: number
    reserved_quantity: number
    available_quantity: number
    created_at: string
    location_levels?: Array<{
      id: string
      location_id: string
      stocked_quantity: number
      reserved_quantity: number
      stock_locations?: { id: string; name: string } | null
    }>
  }>
  customers?: Array<{
    id: string
    email: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    company_name?: string | null
    created_at: string
    orders_count?: number
  }>
  customer_groups?: Array<{
    id: string
    name: string
    created_at: string
  }>
  price_lists?: Array<{
    id: string
    title: string
    description?: string | null
    type: string
    status: string
    starts_at?: string | null
    ends_at?: string | null
    prices_count?: number
    rules_count?: number
    created_at: string
  }>
  promotions?: Array<{
    id: string
    code: string
    type: string
    status: string
    is_automatic?: boolean
    application_method?: {
      type?: string
      value?: number
      currency_code?: string
    }
    campaign?: {
      id: string
      name: string
    } | null
    created_at: string
  }>
  campaigns?: Array<{
    id: string
    name: string
    description?: string | null
    campaign_identifier?: string | null
    starts_at?: string | null
    ends_at?: string | null
    created_at: string
  }>
  venues?: Array<{
    id: string
    name: string
    address?: string | null
    rows_count?: number
    capacity?: number
    tiers?: string[]
    created_at: string
  }>
  shows?: Array<{
    id: string
    title: string
    venue_name?: string
    venue_capacity?: number
    dates?: string[]
    dates_count?: number
    tiers_count?: number
    created_at: string
  }>
  sales_channels?: Array<{
    id: string
    name: string
    description?: string | null
    is_disabled?: boolean
    created_at: string
  }>
  stock_locations?: Array<{
    id: string
    name: string
    address?: {
      address_1?: string
      city?: string
      country_code?: string
    } | null
    created_at: string
  }>
  api_keys?: Array<{
    id: string
    title: string
    type: string
    redacted?: string
    token?: string
    created_at: string
  }>
  return_reasons?: Array<{
    id: string
    label: string
    value: string
    description?: string | null
    created_at: string
  }>
  refund_reasons?: Array<{
    id: string
    label: string
    code: string
    description?: string | null
    created_at: string
  }>
  metrics?: {
    total_products: number
    total_orders: number
    total_revenue: number
    total_inventory_items: number
    total_stocked_quantity: number
    total_available_quantity: number
    total_customers: number
    total_customer_groups: number
    total_collections: number
    total_categories: number
    total_price_lists: number
    total_promotions: number
    total_campaigns: number
    total_venues: number
    total_shows: number
    total_admins: number
    total_sales_channels: number
    total_stock_locations: number
    total_api_keys: number
    total_return_reasons: number
    total_refund_reasons: number
  }
}

const VendorDetailsPage = () => {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<string>("overview")

  // Search filter states
  const [productSearch, setProductSearch] = useState("")
  const [orderSearch, setOrderSearch] = useState("")
  const [inventorySearch, setInventorySearch] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [venueSearch, setVenueSearch] = useState("")

  // Sub tab toggles
  const [catalogSubTab, setCatalogSubTab] = useState<
    "products" | "collections" | "categories" | "options"
  >("products")
  const [pricingSubTab, setPricingSubTab] = useState<
    "pricelists" | "promotions" | "campaigns"
  >("pricelists")
  const [venueSubTab, setVenueSubTab] = useState<"venues" | "shows">("venues")
  const [customerSubTab, setCustomerSubTab] = useState<"customers" | "groups">(
    "customers"
  )

  const { data, isLoading, error, refetch } = useQuery<SingleVendor360Response>({
    queryFn: () =>
      sdk.client.fetch<SingleVendor360Response>(`/admin/vendors/${id}`),
    queryKey: [["admin-vendor-details", id]],
    enabled: !!id,
  })

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const prods = data?.products || []
    if (!productSearch.trim()) return prods
    const term = productSearch.toLowerCase().trim()
    return prods.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.handle.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
    )
  }, [data?.products, productSearch])

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const ords = data?.orders || []
    if (!orderSearch.trim()) return ords
    const term = orderSearch.toLowerCase().trim()
    return ords.filter((o) => {
      const displayId = String(o.display_id || "")
      const email = o.customer?.email?.toLowerCase() || ""
      const name = `${o.customer?.first_name || ""} ${
        o.customer?.last_name || ""
      }`.toLowerCase()
      return (
        o.id.toLowerCase().includes(term) ||
        displayId.includes(term) ||
        email.includes(term) ||
        name.includes(term)
      )
    })
  }, [data?.orders, orderSearch])

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    const items = data?.inventory_items || []
    if (!inventorySearch.trim()) return items
    const term = inventorySearch.toLowerCase().trim()
    return items.filter(
      (i) =>
        (i.title || "").toLowerCase().includes(term) ||
        (i.sku || "").toLowerCase().includes(term) ||
        i.id.toLowerCase().includes(term)
    )
  }, [data?.inventory_items, inventorySearch])

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    const custs = data?.customers || []
    if (!customerSearch.trim()) return custs
    const term = customerSearch.toLowerCase().trim()
    return custs.filter((c) => {
      const email = (c.email || "").toLowerCase()
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase()
      const phone = (c.phone || "").toLowerCase()
      const company = (c.company_name || "").toLowerCase()
      return (
        email.includes(term) ||
        fullName.includes(term) ||
        phone.includes(term) ||
        company.includes(term)
      )
    })
  }, [data?.customers, customerSearch])

  // Filtered Venues
  const filteredVenues = useMemo(() => {
    const vens = data?.venues || []
    if (!venueSearch.trim()) return vens
    const term = venueSearch.toLowerCase().trim()
    return vens.filter(
      (v) =>
        v.name.toLowerCase().includes(term) ||
        (v.address || "").toLowerCase().includes(term)
    )
  }, [data?.venues, venueSearch])

  if (isLoading) {
    return (
      <Container className="p-16 text-center">
        <div className="flex flex-col items-center justify-center gap-3">
          <ArrowPath className="w-7 h-7 animate-spin text-ui-fg-interactive" />
          <Text size="base" weight="plus" className="text-ui-fg-base">
            Loading Vendor 360 Dashboard...
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Aggregating catalog, inventory stock, orders, venues, and settings.
          </Text>
        </div>
      </Container>
    )
  }

  if (error || !data?.vendor) {
    return (
      <Container className="p-8 space-y-4">
        <Heading level="h2">Vendor Profile Unavailable</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Could not load the requested vendor details.
        </Text>
        <Link to="/vendors">
          <Button variant="secondary" size="small">
            ← Back to Vendors List
          </Button>
        </Link>
      </Container>
    )
  }

  const {
    vendor,
    admins = [],
    products = [],
    collections = [],
    categories = [],
    product_options = [],
    orders = [],
    inventory_items = [],
    customers = [],
    customer_groups = [],
    price_lists = [],
    promotions = [],
    campaigns = [],
    venues = [],
    shows = [],
    sales_channels = [],
    stock_locations = [],
    api_keys = [],
    return_reasons = [],
    refund_reasons = [],
    metrics,
  } = data

  const totalRevenueFormatted = (
    ((metrics?.total_revenue || 0) / 100)
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Tab definitions
  const NAV_TABS = [
    { id: "overview", label: "Overview", icon: BuildingStorefront, count: null },
    { id: "products", label: "Products", icon: Tag, count: products.length },
    { id: "orders", label: "Orders", icon: ShoppingCart, count: orders.length },
    {
      id: "inventory",
      label: "Inventory",
      icon: SquareTwoStack,
      count: inventory_items.length,
    },
    { id: "customers", label: "Customers", icon: Users, count: customers.length },
    {
      id: "pricing",
      label: "Pricing & Deals",
      icon: CurrencyDollar,
      count: price_lists.length + promotions.length,
    },
    {
      id: "venues",
      label: "Venues & Shows",
      icon: Buildings,
      count: venues.length + shows.length,
    },
    { id: "settings", label: "Settings", icon: CogSixTooth, count: null },
  ]

  return (
    <div className="flex flex-col gap-y-6 pb-16">
      {/* Top Breadcrumb Link & Action */}
      <div className="flex items-center justify-between">
        <Link
          to="/vendors"
          className="text-ui-fg-subtle hover:text-ui-fg-base text-xs font-semibold inline-flex items-center gap-1.5 transition"
        >
          <span>←</span>
          <span>Back to All Vendors</span>
        </Link>
        <Button variant="secondary" size="small" onClick={() => refetch()}>
          <ArrowPath className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Main Vendor Header Card */}
      <Container className="p-6 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {vendor.logo ? (
              <img
                src={vendor.logo}
                alt={vendor.name}
                className="w-16 h-16 rounded-2xl object-cover border border-ui-border-base shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-ui-bg-subtle flex items-center justify-center font-bold text-2xl text-ui-fg-base border border-ui-border-base shrink-0">
                {vendor.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Heading level="h1" className="text-2xl font-bold text-ui-fg-base">
                  {vendor.name}
                </Heading>
                <StatusBadge color="green">Active Vendor</StatusBadge>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-ui-fg-subtle flex-wrap">
                <span className="font-mono bg-ui-bg-subtle px-2 py-0.5 rounded text-ui-fg-base font-semibold border border-ui-border-base">
                  @{vendor.handle}
                </span>
                <span>•</span>
                <span className="font-mono text-ui-fg-muted">ID: {vendor.id}</span>
                <span>•</span>
                <span>
                  Registered {new Date(vendor.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-ui-bg-subtle px-4 py-2.5 rounded-xl border border-ui-border-base text-center">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Products
              </Text>
              <Text size="base" weight="plus" className="text-ui-fg-base font-mono">
                {metrics?.total_products ?? products.length}
              </Text>
            </div>
            <div className="bg-ui-bg-subtle px-4 py-2.5 rounded-xl border border-ui-border-base text-center">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Orders
              </Text>
              <Text size="base" weight="plus" className="text-ui-fg-base font-mono">
                {metrics?.total_orders ?? orders.length}
              </Text>
            </div>
            <div className="bg-ui-bg-subtle px-4 py-2.5 rounded-xl border border-ui-border-base text-center">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Stock Units
              </Text>
              <Text size="base" weight="plus" className="text-ui-fg-base font-mono">
                {metrics?.total_stocked_quantity ?? 0}
              </Text>
            </div>
            <div className="bg-ui-bg-subtle px-4 py-2.5 rounded-xl border border-ui-border-base text-center">
              <Text size="xsmall" className="text-ui-fg-subtle font-medium">
                Revenue
              </Text>
              <Text size="base" weight="plus" className="text-ui-fg-base font-mono">
                ${totalRevenueFormatted}
              </Text>
            </div>
          </div>
        </div>
      </Container>

      {/* Modern Solid Navigation Bar (No sliding animations or glitch) */}
      <div className="flex items-center gap-1.5 p-1.5 bg-ui-bg-subtle border border-ui-border-base rounded-2xl overflow-x-auto shadow-sm">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors select-none ${
                isActive
                  ? "bg-ui-bg-base text-ui-fg-base shadow-sm border border-ui-border-base font-bold"
                  : "text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover border border-transparent"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-ui-fg-interactive" : "text-ui-fg-muted"
                }`}
              />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                    isActive
                      ? "bg-ui-bg-subtle text-ui-fg-base font-bold border border-ui-border-base"
                      : "bg-ui-bg-base text-ui-fg-muted"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stat Cards 4-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Container className="p-4 space-y-1 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-ui-fg-subtle">
                <Text size="xsmall" weight="plus" className="tracking-wider">
                  TOTAL SALES REVENUE
                </Text>
                <CurrencyDollar className="w-4 h-4 text-ui-fg-interactive" />
              </div>
              <Heading level="h2" className="text-2xl font-bold font-mono text-ui-fg-base">
                ${totalRevenueFormatted}
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle">
                From {orders.length} completed/active orders
              </Text>
            </Container>

            <Container className="p-4 space-y-1 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-ui-fg-subtle">
                <Text size="xsmall" weight="plus" className="tracking-wider">
                  PRODUCT CATALOG
                </Text>
                <Tag className="w-4 h-4 text-ui-fg-interactive" />
              </div>
              <Heading level="h2" className="text-2xl font-bold font-mono text-ui-fg-base">
                {products.length}
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {collections.length} collections, {categories.length} categories
              </Text>
            </Container>

            <Container className="p-4 space-y-1 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-ui-fg-subtle">
                <Text size="xsmall" weight="plus" className="tracking-wider">
                  WAREHOUSE INVENTORY
                </Text>
                <SquareTwoStack className="w-4 h-4 text-ui-fg-interactive" />
              </div>
              <Heading level="h2" className="text-2xl font-bold font-mono text-ui-fg-base">
                {metrics?.total_stocked_quantity ?? 0}
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {metrics?.total_available_quantity ?? 0} available for sale
              </Text>
            </Container>

            <Container className="p-4 space-y-1 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-ui-fg-subtle">
                <Text size="xsmall" weight="plus" className="tracking-wider">
                  CUSTOMER BASE
                </Text>
                <Users className="w-4 h-4 text-ui-fg-interactive" />
              </div>
              <Heading level="h2" className="text-2xl font-bold font-mono text-ui-fg-base">
                {customers.length}
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {customer_groups.length} segmentation group(s)
              </Text>
            </Container>
          </div>

          {/* Administrators & Contacts */}
          <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Authorized Administrators & Team Accounts
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Users with permissions to manage this vendor store.
                </Text>
              </div>
              <Badge size="small" rounded="full">
                {admins.length} Admin(s)
              </Badge>
            </div>
            {admins.length === 0 ? (
              <div className="px-6 py-6 text-center text-ui-fg-subtle text-sm">
                No administrator accounts linked.
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Admin Name</Table.HeaderCell>
                    <Table.HeaderCell>Email Address</Table.HeaderCell>
                    <Table.HeaderCell>Admin ID</Table.HeaderCell>
                    <Table.HeaderCell>Role</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {admins.map((admin) => {
                    const fullName = [admin.first_name, admin.last_name]
                      .filter(Boolean)
                      .join(" ")
                    return (
                      <Table.Row key={admin.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {fullName || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono">
                            {admin.email}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text
                            size="small"
                            className="text-ui-fg-subtle font-mono text-xs"
                          >
                            {admin.id}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">Vendor Admin</Badge>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table>
            )}
          </Container>

          {/* Quick Previews: Recent Orders & Catalog Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders Preview */}
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <Heading level="h3" className="text-sm font-bold text-ui-fg-base">
                    Recent Sales Activity
                  </Heading>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Latest customer orders
                  </Text>
                </div>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => setActiveTab("orders")}
                >
                  View All ({orders.length}) →
                </Button>
              </div>
              {orders.slice(0, 4).length === 0 ? (
                <div className="px-6 py-8 text-center text-ui-fg-subtle text-xs">
                  No orders recorded yet.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Order #</Table.HeaderCell>
                      <Table.HeaderCell>Customer</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {orders.slice(0, 4).map((o) => (
                      <Table.Row key={o.id}>
                        <Table.Cell>
                          <Link
                            to={`/orders/${o.id}`}
                            className="font-mono text-xs font-semibold text-ui-fg-interactive hover:underline"
                          >
                            #{o.display_id || o.id.slice(0, 8)}
                          </Link>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="xsmall" className="truncate max-w-[130px]">
                            {o.customer?.email || "Guest"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge color={o.status === "completed" ? "green" : "blue"}>
                            {o.status || "Pending"}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <Text size="xsmall" weight="plus" className="font-mono">
                            ${(((o.total || 0) / 100)).toFixed(2)}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>

            {/* Catalog Highlights Preview */}
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <Heading level="h3" className="text-sm font-bold text-ui-fg-base">
                    Product Highlights
                  </Heading>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Vendor catalog preview
                  </Text>
                </div>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => setActiveTab("products")}
                >
                  View All ({products.length}) →
                </Button>
              </div>
              {products.slice(0, 4).length === 0 ? (
                <div className="px-6 py-8 text-center text-ui-fg-subtle text-xs">
                  No products published yet.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Product</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Price</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {products.slice(0, 4).map((p) => {
                      const price = p.variants?.[0]?.prices?.[0]
                      return (
                        <Table.Row key={p.id}>
                          <Table.Cell>
                            <div className="flex items-center gap-2">
                              {p.thumbnail ? (
                                <img
                                  src={p.thumbnail}
                                  alt={p.title}
                                  className="w-7 h-7 rounded object-cover border border-ui-border-base shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-ui-bg-subtle flex items-center justify-center text-ui-fg-subtle text-xs font-bold shrink-0">
                                  P
                                </div>
                              )}
                              <Link
                                to={`/products/${p.id}`}
                                className="text-xs font-medium text-ui-fg-base hover:text-ui-fg-interactive truncate max-w-[160px]"
                              >
                                {p.title}
                              </Link>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge color={p.status === "published" ? "green" : "grey"}>
                              {p.status || "Draft"}
                            </StatusBadge>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Text size="xsmall" weight="plus" className="font-mono">
                              {price
                                ? `${price.currency_code?.toUpperCase()} ${price.amount}`
                                : "—"}
                            </Text>
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table>
              )}
            </Container>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PRODUCTS & CATALOG */}
      {/* ======================================================== */}
      {activeTab === "products" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={catalogSubTab === "products" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCatalogSubTab("products")}
            >
              Products ({products.length})
            </Button>
            <Button
              variant={catalogSubTab === "collections" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCatalogSubTab("collections")}
            >
              Collections ({collections.length})
            </Button>
            <Button
              variant={catalogSubTab === "categories" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCatalogSubTab("categories")}
            >
              Categories ({categories.length})
            </Button>
            <Button
              variant={catalogSubTab === "options" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCatalogSubTab("options")}
            >
              Options ({product_options.length})
            </Button>
          </div>

          {catalogSubTab === "products" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
                <div>
                  <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                    Vendor Products
                  </Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    All products managed and sold by this vendor.
                  </Text>
                </div>
                <div className="w-full sm:w-64">
                  <Input
                    size="small"
                    placeholder="Search products or handle..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  {productSearch ? "No products matching search." : "No products found for this vendor."}
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Product</Table.HeaderCell>
                      <Table.HeaderCell>Handle</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell>Collection / Category</Table.HeaderCell>
                      <Table.HeaderCell>Variants</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Price</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredProducts.map((p) => {
                      const primaryVariant = p.variants?.[0]
                      const price = primaryVariant?.prices?.[0]
                      const colTitle = p.collection?.title
                      const catName = p.categories?.[0]?.name

                      return (
                        <Table.Row key={p.id}>
                          <Table.Cell>
                            <div className="flex items-center gap-3">
                              {p.thumbnail ? (
                                <img
                                  src={p.thumbnail}
                                  alt={p.title}
                                  className="w-9 h-9 rounded-lg object-cover border border-ui-border-base shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-ui-bg-subtle flex items-center justify-center text-ui-fg-subtle text-xs font-bold shrink-0">
                                  P
                                </div>
                              )}
                              <div>
                                <Link
                                  to={`/products/${p.id}`}
                                  className="text-ui-fg-base hover:text-ui-fg-interactive transition"
                                >
                                  <Text size="small" weight="plus">
                                    {p.title}
                                  </Text>
                                </Link>
                                <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                                  {p.id}
                                </Text>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="font-mono text-ui-fg-subtle">
                              /{p.handle}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge color={p.status === "published" ? "green" : "grey"}>
                              {p.status || "Published"}
                            </StatusBadge>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small">
                              {colTitle || catName || "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge size="2xsmall">
                              {p.variants?.length || 1} variant(s)
                            </Badge>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Text size="small" weight="plus" className="font-mono">
                              {price
                                ? `${price.currency_code?.toUpperCase()} ${price.amount}`
                                : "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Link to={`/products/${p.id}`}>
                              <Button variant="secondary" size="small">
                                View <ArrowUpRightOnBox className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {catalogSubTab === "collections" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Product Collections
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Curated product groupings created and managed by this vendor.
                </Text>
              </div>
              {collections.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No collections created by this vendor.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Collection Title</Table.HeaderCell>
                      <Table.HeaderCell>Handle</Table.HeaderCell>
                      <Table.HeaderCell>Products Count</Table.HeaderCell>
                      <Table.HeaderCell>Created Date</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {collections.map((col) => (
                      <Table.Row key={col.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-ui-fg-subtle" />
                            <Text size="small" weight="plus">
                              {col.title}
                            </Text>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono text-ui-fg-subtle">
                            /{col.handle}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {col.products_count ?? 0} Products
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {new Date(col.created_at).toLocaleDateString()}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {catalogSubTab === "categories" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Product Categories
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Store taxonomy categories linked to this vendor's catalog.
                </Text>
              </div>
              {categories.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No categories associated with this vendor's products.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Category Name</Table.HeaderCell>
                      <Table.HeaderCell>Handle</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell>Associated Products</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {categories.map((cat) => (
                      <Table.Row key={cat.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {cat.name}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono text-ui-fg-subtle">
                            /{cat.handle}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge color={cat.is_active !== false ? "green" : "grey"}>
                            {cat.is_active !== false ? "Active" : "Inactive"}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {cat.products_count ?? 0} Products
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {catalogSubTab === "options" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Product Options & Attributes
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Custom variant option dimensions configured by vendor.
                </Text>
              </div>
              {product_options.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No custom product options configured.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Option Title</Table.HeaderCell>
                      <Table.HeaderCell>Product Reference</Table.HeaderCell>
                      <Table.HeaderCell>Configured Values</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {product_options.map((opt) => (
                      <Table.Row key={opt.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {opt.title}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {opt.product_title || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap gap-1">
                            {(opt.values || []).map((val, idx) => (
                              <Badge key={idx} size="2xsmall" rounded="full">
                                {val}
                              </Badge>
                            ))}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ORDERS & SALES */}
      {/* ======================================================== */}
      {activeTab === "orders" && (
        <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                Marketplace Sales & Orders
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Customer orders containing products sold by this vendor.
              </Text>
            </div>
            <div className="w-full sm:w-64">
              <Input
                size="small"
                placeholder="Search order # or customer..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
              {orderSearch ? "No orders matching search." : "No orders recorded for this vendor yet."}
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Order #</Table.HeaderCell>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Customer</Table.HeaderCell>
                  <Table.HeaderCell>Items Purchased</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredOrders.map((order) => {
                  const customerName = [
                    order.customer?.first_name,
                    order.customer?.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")

                  const itemsCount = (order.items || []).reduce(
                    (sum, item) => sum + (item.quantity || 1),
                    0
                  )

                  return (
                    <Table.Row key={order.id}>
                      <Table.Cell>
                        <Link
                          to={`/orders/${order.id}`}
                          className="font-mono text-sm font-bold text-ui-fg-interactive hover:underline"
                        >
                          #{order.display_id || order.id.slice(0, 8)}
                        </Link>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-subtle">
                          {new Date(order.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <div>
                          {customerName && (
                            <Text size="small" weight="plus">
                              {customerName}
                            </Text>
                          )}
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {order.customer?.email || "Guest checkout"}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <Badge size="2xsmall">{itemsCount} item(s)</Badge>
                          <Text size="xsmall" className="text-ui-fg-subtle truncate max-w-[140px]">
                            {order.items?.[0]?.title}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge
                          color={
                            order.status === "completed"
                              ? "green"
                              : order.status === "canceled"
                              ? "red"
                              : "blue"
                          }
                        >
                          {order.status || "Pending"}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Text size="small" weight="plus" className="font-mono">
                          {order.currency_code?.toUpperCase() || "$"}{" "}
                          {(((order.total || 0) / 100)).toFixed(2)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Link to={`/orders/${order.id}`}>
                          <Button variant="secondary" size="small">
                            View Order <ArrowUpRightOnBox className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          )}
        </Container>
      )}

      {/* ======================================================== */}
      {/* TAB 4: INVENTORY */}
      {/* ======================================================== */}
      {activeTab === "inventory" && (
        <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                Vendor Inventory Stock
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Warehouse inventory levels, stock allocations, and reservations.
              </Text>
            </div>
            <div className="w-full sm:w-64">
              <Input
                size="small"
                placeholder="Search SKU or title..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
              />
            </div>
          </div>

          {filteredInventory.length === 0 ? (
            <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
              {inventorySearch
                ? "No inventory items matching your search."
                : "No inventory items found for this vendor."}
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Item / Title</Table.HeaderCell>
                  <Table.HeaderCell>SKU</Table.HeaderCell>
                  <Table.HeaderCell>Locations</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Stocked</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Reserved</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Available</Table.HeaderCell>
                  <Table.HeaderCell>Shipping</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredInventory.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <Text size="small" weight="plus">
                        {item.title || "Inventory Item"}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                        {item.id}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="font-mono text-ui-fg-base font-medium">
                        {item.sku || "—"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall">
                        {item.location_levels?.length || 1} Location(s)
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono">
                      <Text size="small">{item.stocked_quantity}</Text>
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono text-ui-fg-subtle">
                      <Text size="small">{item.reserved_quantity}</Text>
                    </Table.Cell>
                    <Table.Cell className="text-right font-mono">
                      <Badge
                        size="2xsmall"
                        className={
                          item.available_quantity > 0
                            ? "bg-ui-tag-green-bg text-ui-tag-green-text font-bold"
                            : "bg-ui-tag-red-bg text-ui-tag-red-text font-bold"
                        }
                      >
                        {item.available_quantity} available
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge
                        color={item.requires_shipping !== false ? "green" : "grey"}
                      >
                        {item.requires_shipping !== false ? "Physical" : "Digital"}
                      </StatusBadge>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Container>
      )}

      {/* ======================================================== */}
      {/* TAB 5: CUSTOMERS & GROUPS */}
      {/* ======================================================== */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant={customerSubTab === "customers" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCustomerSubTab("customers")}
            >
              Customers ({customers.length})
            </Button>
            <Button
              variant={customerSubTab === "groups" ? "primary" : "secondary"}
              size="small"
              onClick={() => setCustomerSubTab("groups")}
            >
              Customer Groups ({customer_groups.length})
            </Button>
          </div>

          {customerSubTab === "customers" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
                <div>
                  <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                    Vendor Customers
                  </Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    Customers who have registered or placed orders with this vendor.
                  </Text>
                </div>
                <div className="w-full sm:w-64">
                  <Input
                    size="small"
                    placeholder="Search name, email, phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredCustomers.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  {customerSearch
                    ? "No customers matching search."
                    : "No customers associated with this vendor yet."}
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Customer Name</Table.HeaderCell>
                      <Table.HeaderCell>Email Address</Table.HeaderCell>
                      <Table.HeaderCell>Phone / Company</Table.HeaderCell>
                      <Table.HeaderCell>Joined Date</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Vendor Orders</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredCustomers.map((cust) => {
                      const fullName = [cust.first_name, cust.last_name]
                        .filter(Boolean)
                        .join(" ")

                      return (
                        <Table.Row key={cust.id}>
                          <Table.Cell>
                            <Text size="small" weight="plus">
                              {fullName || "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="font-mono">
                              {cust.email}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="text-ui-fg-subtle">
                              {cust.phone || cust.company_name || "—"}
                            </Text>
                          </Table.Cell>
                          <Table.Cell>
                            <Text size="small" className="text-ui-fg-subtle">
                              {new Date(cust.created_at).toLocaleDateString()}
                            </Text>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <Badge size="2xsmall">
                              {cust.orders_count || 0} Order(s)
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {customerSubTab === "groups" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Customer Groups
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Custom customer segmentation groups managed by this vendor.
                </Text>
              </div>
              {customer_groups.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No customer groups created by this vendor.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Group Name</Table.HeaderCell>
                      <Table.HeaderCell>Group ID</Table.HeaderCell>
                      <Table.HeaderCell>Created Date</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {customer_groups.map((group) => (
                      <Table.Row key={group.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {group.name}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono text-ui-fg-subtle">
                            {group.id}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {new Date(group.created_at).toLocaleDateString()}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: PRICING & PROMOTIONS */}
      {/* ======================================================== */}
      {activeTab === "pricing" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={pricingSubTab === "pricelists" ? "primary" : "secondary"}
              size="small"
              onClick={() => setPricingSubTab("pricelists")}
            >
              Price Lists ({price_lists.length})
            </Button>
            <Button
              variant={pricingSubTab === "promotions" ? "primary" : "secondary"}
              size="small"
              onClick={() => setPricingSubTab("promotions")}
            >
              Promotions ({promotions.length})
            </Button>
            <Button
              variant={pricingSubTab === "campaigns" ? "primary" : "secondary"}
              size="small"
              onClick={() => setPricingSubTab("campaigns")}
            >
              Campaigns ({campaigns.length})
            </Button>
          </div>

          {pricingSubTab === "pricelists" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Vendor Price Lists
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Custom pricing rules, sale prices, and volume discounts.
                </Text>
              </div>
              {price_lists.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No price lists configured by this vendor.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Title</Table.HeaderCell>
                      <Table.HeaderCell>Type</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                      <Table.HeaderCell>Prices Count</Table.HeaderCell>
                      <Table.HeaderCell>Date Range</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {price_lists.map((pl) => (
                      <Table.Row key={pl.id}>
                        <Table.Cell>
                          <div>
                            <Text size="small" weight="plus">
                              {pl.title}
                            </Text>
                            {pl.description && (
                              <Text size="xsmall" className="text-ui-fg-subtle">
                                {pl.description}
                              </Text>
                            )}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {pl.type.toUpperCase()}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge color={pl.status === "active" ? "green" : "grey"}>
                            {pl.status}
                          </StatusBadge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {pl.prices_count ?? 0} Price(s)
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {pl.starts_at ? new Date(pl.starts_at).toLocaleDateString() : "Immediate"}{" "}
                            → {pl.ends_at ? new Date(pl.ends_at).toLocaleDateString() : "Ongoing"}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {pricingSubTab === "promotions" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Vendor Promotions
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Discount codes, standard promotions, and automatic deals.
                </Text>
              </div>
              {promotions.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No promotions created by this vendor.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Promo Code</Table.HeaderCell>
                      <Table.HeaderCell>Type</Table.HeaderCell>
                      <Table.HeaderCell>Discount Value</Table.HeaderCell>
                      <Table.HeaderCell>Campaign</Table.HeaderCell>
                      <Table.HeaderCell>Status</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {promotions.map((promo) => (
                      <Table.Row key={promo.id}>
                        <Table.Cell>
                          <span className="font-mono text-xs font-bold bg-ui-bg-subtle px-2 py-1 rounded border border-ui-border-base">
                            {promo.code}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {promo.type}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {promo.application_method?.value
                              ? `${promo.application_method.value} ${
                                  promo.application_method.type === "percentage"
                                    ? "%"
                                    : promo.application_method.currency_code?.toUpperCase() || ""
                                }`
                              : "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {promo.campaign?.name || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge color={promo.status === "active" ? "green" : "grey"}>
                            {promo.status}
                          </StatusBadge>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {pricingSubTab === "campaigns" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Marketing Campaigns
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Time-bounded marketing campaigns grouping vendor promotions.
                </Text>
              </div>
              {campaigns.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No marketing campaigns found.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Campaign Name</Table.HeaderCell>
                      <Table.HeaderCell>Identifier</Table.HeaderCell>
                      <Table.HeaderCell>Duration</Table.HeaderCell>
                      <Table.HeaderCell>Created Date</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {campaigns.map((camp) => (
                      <Table.Row key={camp.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {camp.name}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono text-ui-fg-subtle">
                            {camp.campaign_identifier || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {camp.starts_at ? new Date(camp.starts_at).toLocaleDateString() : "Immediate"}{" "}
                            → {camp.ends_at ? new Date(camp.ends_at).toLocaleDateString() : "Ongoing"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {new Date(camp.created_at).toLocaleDateString()}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: VENUES & SHOWS */}
      {/* ======================================================== */}
      {activeTab === "venues" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant={venueSubTab === "venues" ? "primary" : "secondary"}
              size="small"
              onClick={() => setVenueSubTab("venues")}
            >
              Venues ({venues.length})
            </Button>
            <Button
              variant={venueSubTab === "shows" ? "primary" : "secondary"}
              size="small"
              onClick={() => setVenueSubTab("shows")}
            >
              Shows & Events ({shows.length})
            </Button>
          </div>

          {venueSubTab === "venues" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4">
                <div>
                  <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                    Vendor Venues & Auditoriums
                  </Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    Physical venues configured for ticket booking seating rows.
                  </Text>
                </div>
                <div className="w-full sm:w-64">
                  <Input
                    size="small"
                    placeholder="Search venue or address..."
                    value={venueSearch}
                    onChange={(e) => setVenueSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredVenues.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  {venueSearch ? "No venues matching search." : "No venues registered for this vendor."}
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Venue Name</Table.HeaderCell>
                      <Table.HeaderCell>Address</Table.HeaderCell>
                      <Table.HeaderCell>Seating Rows</Table.HeaderCell>
                      <Table.HeaderCell>Seating Tiers</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Total Capacity</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredVenues.map((venue) => (
                      <Table.Row key={venue.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {venue.name}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {venue.address || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {venue.rows_count ?? 0} Row(s)
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap gap-1">
                            {(venue.tiers || []).map((tier: string, i: number) => (
                              <Badge key={i} size="2xsmall" rounded="full">
                                {tier}
                              </Badge>
                            ))}
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-right font-mono">
                          <Text size="small" weight="plus">
                            {venue.capacity ?? 0} seats
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}

          {venueSubTab === "shows" && (
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Shows & Ticket Events
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Bookable shows and performances managed by this vendor.
                </Text>
              </div>
              {shows.length === 0 ? (
                <div className="px-6 py-12 text-center text-ui-fg-subtle text-sm">
                  No shows or ticketed events found.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Show Title</Table.HeaderCell>
                      <Table.HeaderCell>Venue</Table.HeaderCell>
                      <Table.HeaderCell>Dates Scheduled</Table.HeaderCell>
                      <Table.HeaderCell>Seating Tiers</Table.HeaderCell>
                      <Table.HeaderCell className="text-right">Venue Capacity</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {shows.map((show) => (
                      <Table.Row key={show.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {show.title}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="text-ui-fg-subtle">
                            {show.venue_name}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {show.dates_count ?? 0} Date(s)
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall">
                            {show.tiers_count ?? 0} Tier(s)
                          </Badge>
                        </Table.Cell>
                        <Table.Cell className="text-right font-mono">
                          <Text size="small">
                            {show.venue_capacity ?? 0} seats
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 8: SETTINGS & CONFIGURATIONS */}
      {/* ======================================================== */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Sales Channels */}
          <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Sales Channels
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Channels through which this vendor's catalog is published.
                </Text>
              </div>
              <Badge size="small" rounded="full">
                {sales_channels.length} Channel(s)
              </Badge>
            </div>
            {sales_channels.length === 0 ? (
              <div className="px-6 py-8 text-center text-ui-fg-subtle text-sm">
                Default marketplace sales channel active.
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Channel Name</Table.HeaderCell>
                    <Table.HeaderCell>Description</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {sales_channels.map((sc) => (
                    <Table.Row key={sc.id}>
                      <Table.Cell>
                        <Text size="small" weight="plus">
                          {sc.name}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-subtle">
                          {sc.description || "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={!sc.is_disabled ? "green" : "red"}>
                          {!sc.is_disabled ? "Active" : "Disabled"}
                        </StatusBadge>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Container>

          {/* Stock Locations */}
          <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Stock Locations & Warehouses
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Fulfillment origins and inventory storage locations.
                </Text>
              </div>
              <Badge size="small" rounded="full">
                {stock_locations.length} Location(s)
              </Badge>
            </div>
            {stock_locations.length === 0 ? (
              <div className="px-6 py-8 text-center text-ui-fg-subtle text-sm">
                Default warehouse location assigned.
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Location Name</Table.HeaderCell>
                    <Table.HeaderCell>Address</Table.HeaderCell>
                    <Table.HeaderCell>Country</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {stock_locations.map((loc) => (
                    <Table.Row key={loc.id}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-ui-fg-subtle" />
                          <Text size="small" weight="plus">
                            {loc.name}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-subtle">
                          {loc.address?.address_1 || loc.address?.city || "—"}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="font-mono uppercase font-bold">
                          {loc.address?.country_code || "—"}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Container>

          {/* API Keys */}
          <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                  Storefront API Keys & Access Tokens
                </Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  Publishable and secret API credentials generated for this store.
                </Text>
              </div>
              <Badge size="small" rounded="full">
                {api_keys.length} Key(s)
              </Badge>
            </div>
            {api_keys.length === 0 ? (
              <div className="px-6 py-8 text-center text-ui-fg-subtle text-sm">
                No dedicated API keys provisioned.
              </div>
            ) : (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Key Title</Table.HeaderCell>
                    <Table.HeaderCell>Type</Table.HeaderCell>
                    <Table.HeaderCell>Token Identifier</Table.HeaderCell>
                    <Table.HeaderCell>Created Date</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {api_keys.map((key) => (
                    <Table.Row key={key.id}>
                      <Table.Cell>
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-ui-fg-subtle" />
                          <Text size="small" weight="plus">
                            {key.title}
                          </Text>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge size="2xsmall">
                          {key.type}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="font-mono text-xs text-ui-fg-subtle">
                          {key.redacted || key.token || key.id}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-subtle">
                          {new Date(key.created_at).toLocaleDateString()}
                        </Text>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </Container>

          {/* Return & Refund Reasons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h3" className="text-sm font-bold text-ui-fg-base">
                  Return Reasons ({return_reasons.length})
                </Heading>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Customer return options
                </Text>
              </div>
              {return_reasons.length === 0 ? (
                <div className="px-6 py-6 text-center text-ui-fg-subtle text-xs">
                  Default store return reasons apply.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Label</Table.HeaderCell>
                      <Table.HeaderCell>Value</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {return_reasons.map((rr) => (
                      <Table.Row key={rr.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {rr.label}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono text-ui-fg-subtle">
                            {rr.value}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>

            <Container className="divide-y p-0 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="px-6 py-4">
                <Heading level="h3" className="text-sm font-bold text-ui-fg-base">
                  Refund Reasons ({refund_reasons.length})
                </Heading>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Merchant refund justifications
                </Text>
              </div>
              {refund_reasons.length === 0 ? (
                <div className="px-6 py-6 text-center text-ui-fg-subtle text-xs">
                  Default store refund reasons apply.
                </div>
              ) : (
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Label</Table.HeaderCell>
                      <Table.HeaderCell>Code</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {refund_reasons.map((rf) => (
                      <Table.Row key={rf.id}>
                        <Table.Cell>
                          <Text size="small" weight="plus">
                            {rf.label}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="small" className="font-mono text-ui-fg-subtle">
                            {rf.code}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </Container>
          </div>
        </div>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Vendor Details",
})

export default VendorDetailsPage
