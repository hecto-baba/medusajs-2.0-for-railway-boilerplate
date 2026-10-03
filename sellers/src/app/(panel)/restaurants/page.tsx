"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import {
  ChefHat,
  FlyingBox,
  MapPin,
  PencilSquare,
  Phone,
  Plus,
  Envelope,
  User,
  CheckCircle,
} from "@medusajs/icons"
import Link from "next/link"
import {
  listVendorRestaurants,
  createVendorRestaurant,
  updateVendorRestaurant,
  createVendorRestaurantProduct,
  createVendorRestaurantAdmin,
  VendorRestaurant,
} from "@lib/data/vendor-client"

export default function RestaurantPage() {
  const queryClient = useQueryClient()

  // Modals & Drawers
  const [createRestaurantOpen, setCreateRestaurantOpen] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)
  const [addDishOpen, setAddDishOpen] = useState(false)
  const [addStaffOpen, setAddStaffOpen] = useState(false)

  // Edit / Create Restaurant Form State
  const [restaurantName, setRestaurantName] = useState("")
  const [restaurantPhone, setRestaurantPhone] = useState("")
  const [restaurantEmail, setRestaurantEmail] = useState("")
  const [restaurantAddress, setRestaurantAddress] = useState("")
  const [restaurantDesc, setRestaurantDesc] = useState("")
  const [restaurantImageUrl, setRestaurantImageUrl] = useState("")

  // Add Dish Form State
  const [dishTitle, setDishTitle] = useState("")
  const [dishDesc, setDishDesc] = useState("")
  const [dishPrice, setDishPrice] = useState("")
  const [dishDietary, setDishDietary] = useState("Veg")
  const [dishPortion, setDishPortion] = useState("Regular")

  // Add Staff Form State
  const [staffFirstName, setStaffFirstName] = useState("")
  const [staffLastName, setStaffLastName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")

  // Active Tab
  const [activeTab, setActiveTab] = useState<"menu" | "staff">("menu")

  // Fetch Vendor Restaurants
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-restaurants"],
    queryFn: () => listVendorRestaurants(),
  })

  const restaurants = data?.restaurants || []
  const restaurant = restaurants[0] || null

  // Toggle Restaurant Open/Closed Mutation
  const toggleOpenMutation = useMutation({
    mutationFn: (isOpen: boolean) => {
      if (!restaurant) throw new Error("No restaurant profile")
      return updateVendorRestaurant(restaurant.id, { is_open: isOpen })
    },
    onSuccess: (res) => {
      toast.success("Updated", {
        description: `Restaurant is now ${res.restaurant.is_open ? "OPEN for orders" : "CLOSED"}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurants"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update restaurant status" })
    },
  })

  // Create Restaurant Mutation
  const createRestaurantMutation = useMutation({
    mutationFn: (payload: Partial<VendorRestaurant>) => createVendorRestaurant(payload),
    onSuccess: () => {
      toast.success("Success", { description: "Restaurant profile created successfully" })
      setCreateRestaurantOpen(false)
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurants"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to create restaurant" })
    },
  })

  // Update Restaurant Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (payload: Partial<VendorRestaurant>) => {
      if (!restaurant) throw new Error("No restaurant profile")
      return updateVendorRestaurant(restaurant.id, payload)
    },
    onSuccess: () => {
      toast.success("Success", { description: "Restaurant profile updated" })
      setEditProfileOpen(false)
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurants"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update profile" })
    },
  })

  // Add Dish Mutation
  const addDishMutation = useMutation({
    mutationFn: async () => {
      if (!restaurant) throw new Error("No restaurant profile")
      const priceNum = parseFloat(dishPrice) || 0
      return createVendorRestaurantProduct(restaurant.id, {
        title: dishTitle.trim(),
        description: dishDesc.trim() || undefined,
        status: "published",
        options: [{ title: "Portion", values: [dishPortion] }],
        variants: [
          {
            title: `${dishPortion} (${dishDietary})`,
            options: { Portion: dishPortion },
            prices: [{ amount: priceNum, currency_code: "eur" }],
          },
        ],
        metadata: {
          dietary: dishDietary,
          is_restaurant_item: true,
        },
      })
    },
    onSuccess: () => {
      toast.success("Success", { description: "Menu dish created successfully" })
      setAddDishOpen(false)
      setDishTitle("")
      setDishDesc("")
      setDishPrice("")
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurants"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to add dish" })
    },
  })

  // Add Staff Mutation
  const addStaffMutation = useMutation({
    mutationFn: () => {
      if (!restaurant) throw new Error("No restaurant profile")
      return createVendorRestaurantAdmin(restaurant.id, {
        first_name: staffFirstName.trim(),
        last_name: staffLastName.trim(),
        email: staffEmail.trim(),
      })
    },
    onSuccess: () => {
      toast.success("Success", { description: "Staff member added successfully" })
      setAddStaffOpen(false)
      setStaffFirstName("")
      setStaffLastName("")
      setStaffEmail("")
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurants"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to add staff" })
    },
  })

  const openEditDrawer = () => {
    if (!restaurant) return
    setRestaurantName(restaurant.name)
    setRestaurantPhone(restaurant.phone || "")
    setRestaurantEmail(restaurant.email || "")
    setRestaurantAddress(restaurant.address || "")
    setRestaurantDesc(restaurant.description || "")
    setRestaurantImageUrl(restaurant.image_url || "")
    setEditProfileOpen(true)
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-ui-fg-subtle">
        Loading restaurant information...
      </div>
    )
  }

  // If vendor has no restaurant profile yet, prompt to create one
  if (!restaurant) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Container className="p-8 text-center flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base">
            <ChefHat className="w-10 h-10 text-orange-500" />
          </div>
          <div>
            <Heading level="h1" className="text-2xl font-bold">
              Set Up Your Restaurant Profile
            </Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1 max-w-md mx-auto">
              Configure your kitchen hours, address, food and beverage menu items, and fulfill live delivery orders.
            </Text>
          </div>

          <Button
            size="small"
            variant="primary"
            onClick={() => setCreateRestaurantOpen(true)}
            className="mt-2"
          >
            Create Restaurant Profile
          </Button>

          {/* Create Modal */}
          <Drawer open={createRestaurantOpen} onOpenChange={setCreateRestaurantOpen}>
            <Drawer.Content className="max-w-xl">
              <Drawer.Header>
                <Drawer.Title>Create Restaurant Profile</Drawer.Title>
                <Drawer.Description>
                  Enter your restaurant outlet details to begin managing kitchen deliveries and menu items.
                </Drawer.Description>
              </Drawer.Header>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createRestaurantMutation.mutate({
                    name: restaurantName.trim(),
                    phone: restaurantPhone.trim(),
                    email: restaurantEmail.trim(),
                    address: restaurantAddress.trim(),
                    description: restaurantDesc.trim() || null,
                    image_url: restaurantImageUrl.trim() || null,
                    is_open: true,
                  })
                }}
                className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
              >
                <div>
                  <Label className="text-xs font-semibold">Restaurant Name *</Label>
                  <Input
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g. Bella Italia Trattoria"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Phone Number *</Label>
                  <Input
                    value={restaurantPhone}
                    onChange={(e) => setRestaurantPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Contact Email *</Label>
                  <Input
                    type="email"
                    value={restaurantEmail}
                    onChange={(e) => setRestaurantEmail(e.target.value)}
                    placeholder="kitchen@restaurant.com"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Kitchen Address *</Label>
                  <Input
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    placeholder="123 Food Street, Downtown"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Description</Label>
                  <Input
                    value={restaurantDesc}
                    onChange={(e) => setRestaurantDesc(e.target.value)}
                    placeholder="Authentic artisan stone-baked pizzas and fresh pastas..."
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Logo or Banner Image URL</Label>
                  <Input
                    value={restaurantImageUrl}
                    onChange={(e) => setRestaurantImageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={() => setCreateRestaurantOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="small"
                    isLoading={createRestaurantMutation.isPending}
                  >
                    Create Profile
                  </Button>
                </div>
              </form>
            </Drawer.Content>
          </Drawer>
        </Container>
      </div>
    )
  }

  const productsList = restaurant.products || []
  const adminsList = restaurant.admins || []

  return (
    <div className="flex flex-col gap-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-orange-500" />
              {restaurant.name}
            </Heading>
            <Badge color={restaurant.is_open ? "green" : "grey"} size="small">
              {restaurant.is_open ? "OPEN FOR ORDERS" : "CLOSED"}
            </Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Outlet handle: <span className="font-mono text-ui-fg-base">{restaurant.handle}</span>
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-ui-bg-subtle px-3 py-1.5 rounded-lg border border-ui-border-base">
            <Label className="text-xs font-medium cursor-pointer" htmlFor="live-open-toggle">
              Accepting Orders
            </Label>
            <Switch
              id="live-open-toggle"
              checked={restaurant.is_open}
              onCheckedChange={(checked) => toggleOpenMutation.mutate(checked)}
              disabled={toggleOpenMutation.isPending}
            />
          </div>

          <Link href="/restaurants/deliveries">
            <Button size="small" variant="secondary" className="flex items-center gap-1.5">
              <FlyingBox className="w-4 h-4 text-ui-fg-subtle" />
              Live Deliveries &rarr;
            </Button>
          </Link>

          <Button
            size="small"
            variant="secondary"
            onClick={openEditDrawer}
            className="flex items-center gap-1.5"
          >
            <PencilSquare className="w-4 h-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Container className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Address
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {restaurant.address || "No address set"}
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Phone
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {restaurant.phone || "No phone set"}
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Envelope className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Kitchen Email
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {restaurant.email || "No email set"}
              </Text>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ChefHat className="w-5 h-5 text-ui-fg-subtle mt-0.5 shrink-0" />
            <div>
              <Text size="xsmall" className="text-ui-fg-subtle uppercase font-semibold">
                Dishes / Staff
              </Text>
              <Text className="text-sm font-medium text-ui-fg-base mt-0.5">
                {productsList.length} Menu items · {adminsList.length} Staff
              </Text>
            </div>
          </div>
        </div>

        {restaurant.description && (
          <div className="mt-4 pt-4 border-t border-ui-border-base text-sm text-ui-fg-subtle">
            {restaurant.description}
          </div>
        )}
      </Container>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-ui-border-base pb-2">
        <button
          onClick={() => setActiveTab("menu")}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "menu"
              ? "bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base"
              : "text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          Food & Beverage Menu ({productsList.length})
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            activeTab === "staff"
              ? "bg-ui-bg-subtle text-ui-fg-base border border-ui-border-base"
              : "text-ui-fg-subtle hover:text-ui-fg-base"
          }`}
        >
          Kitchen Staff & Admins ({adminsList.length})
        </button>
      </div>

      {/* Tab 1: Menu Items */}
      {activeTab === "menu" && (
        <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
          <div className="p-4 flex items-center justify-between">
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Menu Catalogue
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Dishes, beverages, portion sizes, and dietary designations.
              </Text>
            </div>

            <Button
              size="small"
              variant="primary"
              onClick={() => setAddDishOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Dish
            </Button>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Dish Name</Table.HeaderCell>
                <Table.HeaderCell>Dietary</Table.HeaderCell>
                <Table.HeaderCell>Portions / Variants</Table.HeaderCell>
                <Table.HeaderCell>Price</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {productsList.length === 0 ? (
                <Table.Row>
                  <td colSpan={5} className="text-center py-12">
                    <ChefHat className="w-8 h-8 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                    <Text className="font-medium text-ui-fg-base">No menu dishes added yet</Text>
                    <Text size="small" className="text-ui-fg-subtle mt-1 max-w-sm mx-auto">
                      Add your restaurant signature dishes, beverages, and portion options to your online menu.
                    </Text>
                    <Button
                      size="small"
                      variant="secondary"
                      className="mt-4"
                      onClick={() => setAddDishOpen(true)}
                    >
                      Add First Dish
                    </Button>
                  </td>
                </Table.Row>
              ) : (
                productsList.map((prod: any) => {
                  const variant = prod.variants?.[0]
                  const price = variant?.prices?.[0]
                  const dietary = prod.metadata?.dietary || "General"

                  return (
                    <Table.Row key={prod.id}>
                      <Table.Cell className="font-medium">
                        <div className="font-semibold text-ui-fg-base">{prod.title}</div>
                        {prod.description && (
                          <div className="text-xs text-ui-fg-subtle max-w-md line-clamp-1">
                            {prod.description}
                          </div>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={
                            dietary === "Veg"
                              ? "green"
                              : dietary === "Non-Veg"
                              ? "red"
                              : "grey"
                          }
                          size="xsmall"
                        >
                          {dietary}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-sm">
                        {prod.variants?.length || 1} {prod.variants?.length === 1 ? "portion" : "portions"}
                      </Table.Cell>
                      <Table.Cell className="font-mono text-sm">
                        {price ? `${price.amount} ${price.currency_code?.toUpperCase()}` : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color="green" size="xsmall">
                          {prod.status || "published"}
                        </Badge>
                      </Table.Cell>
                    </Table.Row>
                  )
                })
              )}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* Tab 2: Kitchen Staff */}
      {activeTab === "staff" && (
        <Container className="p-0 overflow-hidden divide-y divide-ui-border-base">
          <div className="p-4 flex items-center justify-between">
            <div>
              <Heading level="h3" className="text-base font-semibold">
                Kitchen Staff & Managers
              </Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Team members authorized to manage food preparations and kitchen status.
              </Text>
            </div>

            <Button
              size="small"
              variant="primary"
              onClick={() => setAddStaffOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Role</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {adminsList.length === 0 ? (
                <Table.Row>
                  <td colSpan={3} className="text-center py-8 text-ui-fg-subtle">
                    No additional kitchen staff configured.
                  </td>
                </Table.Row>
              ) : (
                adminsList.map((a: any) => (
                  <Table.Row key={a.id}>
                    <Table.Cell className="font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-ui-fg-subtle" />
                      <span>{a.first_name} {a.last_name}</span>
                    </Table.Cell>
                    <Table.Cell className="text-sm font-mono text-ui-fg-subtle">
                      {a.email}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color="blue" size="xsmall">Kitchen Manager</Badge>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* Edit Profile Drawer */}
      <Drawer open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <Drawer.Content className="max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Edit Restaurant Profile</Drawer.Title>
            <Drawer.Description>
              Update your store information, contact numbers, and operational details.
            </Drawer.Description>
          </Drawer.Header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              updateProfileMutation.mutate({
                name: restaurantName.trim(),
                phone: restaurantPhone.trim(),
                email: restaurantEmail.trim(),
                address: restaurantAddress.trim(),
                description: restaurantDesc.trim() || null,
                image_url: restaurantImageUrl.trim() || null,
              })
            }}
            className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            <div>
              <Label className="text-xs font-semibold">Restaurant Name</Label>
              <Input
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                value={restaurantPhone}
                onChange={(e) => setRestaurantPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Email Address</Label>
              <Input
                type="email"
                value={restaurantEmail}
                onChange={(e) => setRestaurantEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Address</Label>
              <Input
                value={restaurantAddress}
                onChange={(e) => setRestaurantAddress(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                value={restaurantDesc}
                onChange={(e) => setRestaurantDesc(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Image URL</Label>
              <Input
                value={restaurantImageUrl}
                onChange={(e) => setRestaurantImageUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setEditProfileOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="small"
                isLoading={updateProfileMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Add Dish Drawer */}
      <Drawer open={addDishOpen} onOpenChange={setAddDishOpen}>
        <Drawer.Content className="max-w-xl">
          <Drawer.Header>
            <Drawer.Title>Add Menu Dish</Drawer.Title>
            <Drawer.Description>
              Create a food or beverage dish with pricing and dietary tags.
            </Drawer.Description>
          </Drawer.Header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              addDishMutation.mutate()
            }}
            className="flex flex-col gap-y-4 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            <div>
              <Label className="text-xs font-semibold">Dish Title *</Label>
              <Input
                value={dishTitle}
                onChange={(e) => setDishTitle(e.target.value)}
                placeholder="e.g. Margherita Woodfired Pizza"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Description / Ingredients</Label>
              <Input
                value={dishDesc}
                onChange={(e) => setDishDesc(e.target.value)}
                placeholder="San Marzano tomato base, fresh buffalo mozzarella, fresh basil..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Portion Size</Label>
                <Input
                  value={dishPortion}
                  onChange={(e) => setDishPortion(e.target.value)}
                  placeholder="Regular, Large, 12-inch"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Dietary Classification</Label>
                <Input
                  value={dishDietary}
                  onChange={(e) => setDishDietary(e.target.value)}
                  placeholder="Veg, Non-Veg, Vegan, Gluten-Free"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Price (EUR) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={dishPrice}
                onChange={(e) => setDishPrice(e.target.value)}
                placeholder="14.50"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setAddDishOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="small"
                isLoading={addDishMutation.isPending}
              >
                Create Dish
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Add Staff Drawer */}
      <Drawer open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <Drawer.Content className="max-w-md">
          <Drawer.Header>
            <Drawer.Title>Add Kitchen Staff</Drawer.Title>
            <Drawer.Description>
              Grant kitchen access to a team member.
            </Drawer.Description>
          </Drawer.Header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              addStaffMutation.mutate()
            }}
            className="flex flex-col gap-y-4 p-6"
          >
            <div>
              <Label className="text-xs font-semibold">First Name *</Label>
              <Input
                value={staffFirstName}
                onChange={(e) => setStaffFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Last Name *</Label>
              <Input
                value={staffLastName}
                onChange={(e) => setStaffLastName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Email Address *</Label>
              <Input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => setAddStaffOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="small"
                isLoading={addStaffMutation.isPending}
              >
                Add Staff
              </Button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}
