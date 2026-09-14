import {
  Badge,
  Button,
  Container,
  Heading,
  StatusBadge,
  Table,
  Text,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { sdk } from "../../../lib/sdk"

type SingleVendorResponse = {
  vendor: {
    id: string
    name: string
    handle: string
    logo?: string | null
    created_at: string
    updated_at: string
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
      variants?: Array<{
        id: string
        title: string
        prices?: Array<{ amount: number; currency_code: string }>
      }>
    }>
  }
  orders?: Array<{
    id: string
    display_id?: number
    created_at: string
    status?: string
    currency_code?: string
    total?: number
    customer?: {
      email: string
      first_name?: string | null
      last_name?: string | null
    }
    items?: Array<{
      id: string
      title: string
      quantity: number
      unit_price: number
    }>
  }>
}

const VendorDetailsPage = () => {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading, error } = useQuery<SingleVendorResponse>({
    queryFn: () => sdk.client.fetch<SingleVendorResponse>(`/admin/vendors/${id}`),
    queryKey: [["admin-vendor-details", id]],
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <Container className="p-8">
        <Text size="small" className="text-ui-fg-subtle">
          Loading vendor details and activity...
        </Text>
      </Container>
    )
  }

  if (error || !data?.vendor) {
    return (
      <Container className="p-8 space-y-4">
        <Heading level="h2">Vendor Not Found</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          The requested vendor profile does not exist or could not be loaded.
        </Text>
        <Link to="/vendors">
          <Button variant="secondary" size="small">
            ← Back to Vendors
          </Button>
        </Link>
      </Container>
    )
  }

  const { vendor, orders = [] } = data
  const products = vendor.products || []
  const admins = vendor.admins || []

  return (
    <div className="flex flex-col gap-y-6">
      {/* Back link and Header */}
      <div>
        <Link
          to="/vendors"
          className="text-ui-fg-subtle hover:text-ui-fg-base text-xs font-medium inline-flex items-center gap-1 mb-3 transition"
        >
          <span>←</span>
          <span>Back to Vendors</span>
        </Link>

        {/* Vendor Header Card */}
        <Container className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {vendor.logo ? (
                <img
                  src={vendor.logo}
                  alt={vendor.name}
                  className="w-14 h-14 rounded-2xl object-cover border border-ui-border-base shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-ui-bg-subtle flex items-center justify-center font-bold text-xl text-ui-fg-base border border-ui-border-base shrink-0">
                  {vendor.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Heading level="h1" className="text-xl font-bold">
                    {vendor.name}
                  </Heading>
                  <StatusBadge color="green">Active</StatusBadge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-ui-fg-subtle">
                  <span className="font-mono bg-ui-bg-subtle px-1.5 py-0.5 rounded text-ui-fg-base">
                    @{vendor.handle}
                  </span>
                  <span>•</span>
                  <span>ID: {vendor.id}</span>
                  <span>•</span>
                  <span>
                    Registered {new Date(vendor.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge size="small" rounded="full" className="bg-ui-bg-subtle px-3 py-1">
                {products.length} Products
              </Badge>
              <Badge size="small" rounded="full" className="bg-ui-bg-subtle px-3 py-1">
                {orders.length} Orders
              </Badge>
            </div>
          </div>
        </Container>
      </div>

      {/* Section 1: Vendor Administrators */}
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Administrators & Contacts</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Authorized merchant user accounts for this vendor.
          </Text>
        </div>

        {admins.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No administrator accounts associated.
            </Text>
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
                      <Text size="small" className="text-ui-fg-subtle font-mono text-xs">
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

      {/* Section 2: Linked Products Catalog */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Vendor Product Catalog</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Products published and managed by this vendor.
            </Text>
          </div>
          <Badge size="small" rounded="full">
            {products.length} Items
          </Badge>
        </div>

        {products.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No products created by this vendor yet.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Handle</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Variants</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Price</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {products.map((p) => {
                const primaryVariant = p.variants?.[0]
                const price = primaryVariant?.prices?.[0]

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
                        {p.variants?.length || 1} variant(s)
                      </Text>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Text size="small" weight="plus">
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

      {/* Section 3: Marketplace Orders & Activity */}
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Sales & Order Activity</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Customer orders containing items purchased from this vendor.
            </Text>
          </div>
          <Badge size="small" rounded="full">
            {orders.length} Orders
          </Badge>
        </div>

        {orders.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              No orders placed for this vendor&apos;s products yet.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Order</Table.HeaderCell>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Total</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {orders.map((order) => {
                const customerName = [
                  order.customer?.first_name,
                  order.customer?.last_name,
                ]
                  .filter(Boolean)
                  .join(" ")

                return (
                  <Table.Row key={order.id}>
                    <Table.Cell>
                      <Link
                        to={`/orders/${order.id}`}
                        className="text-ui-fg-interactive hover:underline"
                      >
                        <Text size="small" weight="plus" className="font-mono">
                          #{order.display_id || order.id.slice(0, 8)}
                        </Text>
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle">
                        {new Date(order.created_at).toLocaleDateString()}
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
                          {order.customer?.email || "—"}
                        </Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge color="blue">
                        {order.status || "Pending"}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Text size="small" weight="plus">
                        {order.currency_code?.toUpperCase()}{" "}
                        {((order.total || 0) / 100).toFixed(2)}
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
  )
}

export default VendorDetailsPage
