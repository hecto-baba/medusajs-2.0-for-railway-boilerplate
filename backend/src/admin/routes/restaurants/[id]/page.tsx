import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  StatusBadge,
  Table,
  toast,
} from "@medusajs/ui"
import {
  ArrowLeft,
  BuildingStorefront,
  FlyingBox,
  Plus,
  ShoppingBag,
  User,
  Users,
} from "@medusajs/icons"
import { sdk } from "../../../lib/sdk"
import { EditRestaurantForm } from "../components/edit-restaurant-form"
import { AddProductForm } from "../components/add-product-form"

type Product = { id: string; title: string; status: string; description?: string }
type RestaurantAdmin = {
  id: string
  first_name: string
  last_name: string
  email: string
}
type Driver = {
  id: string
  first_name: string
  last_name: string
  phone?: string
}
type Delivery = {
  id: string
  delivery_status: string
  eta?: string | null
  delivered_at?: string | null
  driver?: Driver | null
}

type Restaurant = {
  id: string
  name: string
  handle: string
  is_open: boolean
  description?: string
  address?: string
  phone?: string
  email?: string
  products?: Product[]
  admins?: RestaurantAdmin[]
  deliveries?: Delivery[]
}

type RestaurantResponse = { restaurant: Restaurant }

const RestaurantDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [addStaffOpen, setAddStaffOpen] = useState(false)

  // Staff member form state
  const [staffFirstName, setStaffFirstName] = useState("")
  const [staffLastName, setStaffLastName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")

  const { data, isLoading } = useQuery<RestaurantResponse>({
    queryKey: ["restaurants", id],
    queryFn: async () => sdk.client.fetch(`/admin/restaurants/${id}`),
    enabled: !!id,
  })

  // Staff creation mutation
  const addStaffMutation = useMutation({
    mutationFn: async (payload: {
      first_name: string
      last_name: string
      email: string
    }) => {
      return sdk.client.fetch(`/admin/restaurants/${id}/admins`, {
        method: "POST",
        body: payload,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants", id] })
      toast.success("Success", { description: "Staff member added successfully" })
      setStaffFirstName("")
      setStaffLastName("")
      setStaffEmail("")
      setAddStaffOpen(false)
    },
    onError: (err: any) => {
      toast.error("Error", {
        description: err.message || "Failed to add staff member",
      })
    },
  })

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffEmail) {
      toast.error("Validation Error", { description: "Email is required" })
      return
    }
    addStaffMutation.mutate({
      first_name: staffFirstName || "Staff",
      last_name: staffLastName || "Member",
      email: staffEmail,
    })
  }

  const restaurant = data?.restaurant

  return (
    <div className="flex flex-col gap-y-6 pb-12">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => navigate("/restaurants")}
          >
            <ArrowLeft className="mr-1 inline-block h-4 w-4" /> Back to Restaurants
          </Button>
          <div className="flex items-center gap-2">
            <Heading level="h1">{restaurant?.name || "Restaurant Details"}</Heading>
            {restaurant && (
              <StatusBadge color={restaurant.is_open ? "green" : "grey"}>
                {restaurant.is_open ? "Open" : "Closed"}
              </StatusBadge>
            )}
          </div>
        </div>

        {restaurant && (
          <Drawer open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
              <Button size="small" variant="secondary">
                Edit Restaurant
              </Button>
            </Drawer.Trigger>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Edit Restaurant</Drawer.Title>
              </Drawer.Header>
              <EditRestaurantForm
                restaurant={restaurant as any}
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </Drawer.Content>
          </Drawer>
        )}
      </div>

      {isLoading && (
        <Container>
          <div className="py-8 text-center text-ui-fg-subtle">
            Loading restaurant details...
          </div>
        </Container>
      )}

      {restaurant && (
        <>
          {/* Overview Info Card */}
          <Container className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BuildingStorefront className="h-5 w-5 text-ui-fg-subtle" />
              <Heading level="h2" className="text-base">
                Restaurant Overview
              </Heading>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-ui-fg-muted">Handle:</span>
                <span className="font-mono text-xs">{restaurant.handle}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-ui-fg-muted">Status:</span>
                <span className="font-medium">
                  {restaurant.is_open ? "Accepting Orders" : "Closed"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-ui-fg-muted">Phone:</span>
                <span>{restaurant.phone || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-ui-fg-muted">Email:</span>
                <span>{restaurant.email || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b pb-2 md:col-span-2">
                <span className="text-ui-fg-muted">Address:</span>
                <span>{restaurant.address || "N/A"}</span>
              </div>
              {restaurant.description && (
                <div className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-ui-fg-muted">Description:</span>
                  <p className="text-ui-fg-subtle">{restaurant.description}</p>
                </div>
              )}
            </div>
          </Container>

          {/* Menu Section */}
          <Container className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-ui-fg-subtle" />
                <Heading level="h2" className="text-base">
                  Menu Products ({restaurant.products?.length || 0})
                </Heading>
              </div>
              <Drawer open={addProductOpen} onOpenChange={setAddProductOpen}>
                <Drawer.Trigger asChild>
                  <Button size="small">
                    <Plus className="mr-1 inline-block h-4 w-4" /> Add Dish
                  </Button>
                </Drawer.Trigger>
                <Drawer.Content>
                  <Drawer.Header>
                    <Drawer.Title>Add Dish to Menu</Drawer.Title>
                  </Drawer.Header>
                  <AddProductForm
                    restaurantId={restaurant.id}
                    onSuccess={() => setAddProductOpen(false)}
                    onCancel={() => setAddProductOpen(false)}
                  />
                </Drawer.Content>
              </Drawer>
            </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Title</Table.HeaderCell>
                <Table.HeaderCell>Description</Table.HeaderCell>
                <Table.HeaderCell>Price / Variants</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {restaurant.products && restaurant.products.length > 0 ? (
                restaurant.products.map((product: any) => {
                  const variants = product.variants || []

                  return (
                    <Table.Row
                      key={product.id}
                      className="cursor-pointer hover:bg-ui-bg-subtle-hover transition"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <Table.Cell className="font-medium">
                        <div className="flex items-center gap-3">
                          {product.thumbnail ? (
                            <img
                              src={product.thumbnail}
                              alt={product.title}
                              className="h-9 w-9 rounded-lg object-cover border border-ui-border-base flex-shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center text-xs font-bold text-ui-fg-muted flex-shrink-0">
                              Dish
                            </div>
                          )}
                          <span className="text-ui-fg-base font-semibold">{product.title}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-ui-fg-subtle max-w-[240px] truncate" title={product.description}>
                        {product.description || "-"}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {variants.map((v: any) => {
                            const rawPrice = v.prices?.[0]?.amount
                            const currency = (v.prices?.[0]?.currency_code || "eur").toUpperCase()
                            const formatted =
                              rawPrice != null
                                ? `${currency} ${rawPrice >= 100 ? (rawPrice / 100).toFixed(2) : Number(rawPrice).toFixed(2)}`
                                : ""
                            return (
                              <span
                                key={v.id}
                                className="text-[11px] px-1.5 py-0.5 bg-ui-bg-subtle rounded border border-ui-border-base text-ui-fg-subtle"
                              >
                                {v.title && v.title !== "Default" ? `${v.title}: ` : ""}
                                <strong className="text-ui-fg-base font-medium">{formatted}</strong>
                              </span>
                            )
                          })}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge color={product.status === "published" ? "green" : "grey"}>
                          {product.status}
                        </StatusBadge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/products/${product.id}`)
                          }}
                        >
                          Edit
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center text-ui-fg-muted py-8">
                    No products found. Add one to the menu!
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
          </Container>

          {/* Staff & Admins Section */}
          <Container className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-ui-fg-subtle" />
                <Heading level="h2" className="text-base">
                  Staff & Admins ({restaurant.admins?.length || 0})
                </Heading>
              </div>
              <Drawer open={addStaffOpen} onOpenChange={setAddStaffOpen}>
                <Drawer.Trigger asChild>
                  <Button size="small" variant="secondary">
                    <Plus className="mr-1 inline-block h-4 w-4" /> Add Staff Member
                  </Button>
                </Drawer.Trigger>
                <Drawer.Content>
                  <Drawer.Header>
                    <Drawer.Title>Add Staff Member</Drawer.Title>
                  </Drawer.Header>
                  <form
                    onSubmit={handleAddStaffSubmit}
                    className="flex flex-col gap-4 p-4"
                  >
                    <div>
                      <Label>First Name</Label>
                      <Input
                        value={staffFirstName}
                        onChange={(e) => setStaffFirstName(e.target.value)}
                        placeholder="e.g. Gordon"
                      />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input
                        value={staffLastName}
                        onChange={(e) => setStaffLastName(e.target.value)}
                        placeholder="e.g. Ramsay"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="e.g. gordon@restaurant.com"
                        required
                      />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setAddStaffOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        isLoading={addStaffMutation.isPending}
                      >
                        Save Staff Member
                      </Button>
                    </div>
                  </form>
                </Drawer.Content>
              </Drawer>
            </div>
            {restaurant.admins && restaurant.admins.length > 0 ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Email</Table.HeaderCell>
                    <Table.HeaderCell>ID</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {restaurant.admins.map((admin) => (
                    <Table.Row key={admin.id}>
                      <Table.Cell className="font-medium">
                        {admin.first_name} {admin.last_name}
                      </Table.Cell>
                      <Table.Cell>{admin.email}</Table.Cell>
                      <Table.Cell className="font-mono text-xs text-ui-fg-muted">
                        {admin.id}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <div className="py-4 text-ui-fg-subtle text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>No staff members registered for this restaurant yet.</span>
              </div>
            )}
          </Container>

          {/* Recent Deliveries Section */}
          <Container className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FlyingBox className="h-5 w-5 text-ui-fg-subtle" />
              <Heading level="h2" className="text-base">
                Restaurant Deliveries ({restaurant.deliveries?.length || 0})
              </Heading>
            </div>
            {restaurant.deliveries && restaurant.deliveries.length > 0 ? (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Delivery ID</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Driver</Table.HeaderCell>
                    <Table.HeaderCell>ETA</Table.HeaderCell>
                    <Table.HeaderCell>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {restaurant.deliveries.map((delivery) => (
                    <Table.Row key={delivery.id}>
                      <Table.Cell className="font-mono text-xs">
                        {delivery.id}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          size="xsmall"
                          color={
                            delivery.delivery_status === "delivered"
                              ? "green"
                              : delivery.delivery_status === "restaurant_declined"
                              ? "red"
                              : delivery.delivery_status === "in_transit" ||
                                delivery.delivery_status === "pickup_claimed"
                              ? "blue"
                              : "orange"
                          }
                        >
                          {delivery.delivery_status.replace(/_/g, " ")}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {delivery.driver
                          ? `${delivery.driver.first_name} ${delivery.driver.last_name}`
                          : "Unassigned"}
                      </Table.Cell>
                      <Table.Cell>
                        {delivery.eta
                          ? new Date(delivery.eta).toLocaleString()
                          : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => navigate(`/deliveries/${delivery.id}`)}
                        >
                          View Delivery
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <p className="text-ui-fg-subtle text-sm py-4">
                No deliveries recorded for this restaurant yet.
              </p>
            )}
          </Container>
        </>
      )}
    </div>
  )
}

export default RestaurantDetailPage
