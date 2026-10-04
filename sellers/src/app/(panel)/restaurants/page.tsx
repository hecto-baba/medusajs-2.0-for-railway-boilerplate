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
  Photo,
  Trash,
  CurrencyDollar,
  InformationCircle,
} from "@medusajs/icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  listVendorRestaurants,
  getVendorRestaurant,
  createVendorRestaurant,
  updateVendorRestaurant,
  createVendorRestaurantProduct,
  createVendorRestaurantAdmin,
  uploadVendorImages,
  VendorRestaurant,
} from "@lib/data/vendor-client"

export default function RestaurantPage() {
  const router = useRouter()
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
  const [dishPrice, setDishPrice] = useState("12.00")
  const [dishCurrency, setDishCurrency] = useState<"eur" | "usd">("eur")
  const [dishDietary, setDishDietary] = useState("veg")
  const [dishPortion, setDishPortion] = useState("Regular")
  const [additionalPortions, setAdditionalPortions] = useState<{ title: string; price: string }[]>([])
  const [newPortionTitle, setNewPortionTitle] = useState("")
  const [newPortionPrice, setNewPortionPrice] = useState("")
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [thumbnailUrl, setThumbnailUrl] = useState("")

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
  const initialRestaurant = restaurants[0] || null

  // Fetch full restaurant details including products
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["vendor-restaurant-detail", initialRestaurant?.id],
    queryFn: () => getVendorRestaurant(initialRestaurant!.id),
    enabled: !!initialRestaurant?.id,
  })

  const restaurant = detailData?.restaurant || initialRestaurant

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
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurant-detail"] })
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
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurant-detail"] })
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
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurant-detail"] })
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message || "Failed to update profile" })
    },
  })

  // Add Dish Mutation
  const addDishMutation = useMutation({
    mutationFn: async () => {
      if (!restaurant) throw new Error("No restaurant profile")
      const basePriceNum = parseFloat(dishPrice) || 0

      let finalThumbnail = thumbnailUrl.trim() || undefined
      if (selectedFile) {
        try {
          const uploaded = await uploadVendorImages([selectedFile])
          if (uploaded?.[0]?.url) {
            finalThumbnail = uploaded[0].url
          }
        } catch (e: any) {
          console.warn("Could not upload dish photo:", e)
        }
      }

      // Build portions/variants
      const allPortions = [
        {
          title: dishPortion.trim() || "Regular",
          price: basePriceNum,
        },
        ...additionalPortions
          .filter((p) => p.title.trim())
          .map((p) => ({
            title: p.title.trim(),
            price: parseFloat(p.price) || basePriceNum,
          })),
      ]

      const options = [
        {
          title: "Portion",
          values: allPortions.map((p) => p.title),
        },
      ]

      const variants = allPortions.map((p) => ({
        title: `${p.title}`,
        options: { Portion: p.title },
        prices: [
          { amount: p.price, currency_code: dishCurrency },
          { amount: p.price, currency_code: dishCurrency === "eur" ? "usd" : "eur" },
        ],
      }))

      const dietaryLabels: Record<string, string> = {
        veg: "Veg",
        non_veg: "Non-Veg",
        egg: "Contains Egg",
        vegan: "Vegan",
        "": "None",
      }

      return createVendorRestaurantProduct(restaurant.id, {
        title: dishTitle.trim(),
        description: dishDesc.trim() || undefined,
        thumbnail: finalThumbnail,
        images: finalThumbnail ? [{ url: finalThumbnail }] : undefined,
        status: "published",
        options,
        variants,
        metadata: {
          dietary: dietaryLabels[dishDietary] || dishDietary,
          dietary_type: dishDietary,
          restaurant_id: restaurant.id,
          is_restaurant_item: true,
          base_currency: dishCurrency,
        },
      })
    },
    onSuccess: () => {
      toast.success("Success", { description: "Menu dish created successfully with variants!" })
      setAddDishOpen(false)
      setDishTitle("")
      setDishDesc("")
      setDishPrice("12.00")
      setDishPortion("Regular")
      setAdditionalPortions([])
      setSelectedFile(null)
      setImagePreview("")
      setThumbnailUrl("")
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurants"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-restaurant-detail"] })
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] })
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
                <Table.HeaderCell>Title</Table.HeaderCell>
                <Table.HeaderCell>Description</Table.HeaderCell>
                <Table.HeaderCell>Price / Variants</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Action</Table.HeaderCell>
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
                  const variants = prod.variants || []
                  const dietary =
                    prod.metadata?.dietary ||
                    (prod.metadata?.dietary_type === "veg"
                      ? "Veg"
                      : prod.metadata?.dietary_type === "non_veg"
                      ? "Non-Veg"
                      : prod.metadata?.dietary_type === "vegan"
                      ? "Vegan"
                      : prod.metadata?.dietary_type === "egg"
                      ? "Contains Egg"
                      : "General")

                  return (
                    <Table.Row
                      key={prod.id}
                      className="cursor-pointer hover:bg-ui-bg-subtle-hover transition"
                      onClick={() => router.push(`/products/${prod.id}`)}
                    >
                      <Table.Cell className="font-medium">
                        <div className="flex items-center gap-3">
                          {prod.thumbnail ? (
                            <img
                              src={prod.thumbnail}
                              alt={prod.title}
                              className="h-9 w-9 rounded-lg object-cover border border-ui-border-base flex-shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center text-xs font-bold text-ui-fg-muted flex-shrink-0">
                              Dish
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ui-fg-base">{prod.title}</span>
                            {dietary && dietary !== "General" && dietary !== "None" && (
                              <Badge
                                color={
                                  dietary === "Veg"
                                    ? "green"
                                    : dietary === "Non-Veg"
                                    ? "red"
                                    : dietary === "Vegan"
                                    ? "green"
                                    : "grey"
                                }
                                size="xsmall"
                              >
                                {dietary}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="text-ui-fg-subtle max-w-[240px] truncate" title={prod.description}>
                        {prod.description || "-"}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          {variants.length > 0 ? (
                            variants.map((v: any) => {
                              const p = v.prices?.[0]
                              const curr = (p?.currency_code || "eur").toUpperCase()
                              const amt =
                                p?.amount != null
                                  ? Number(p.amount).toFixed(2)
                                  : ""
                              return (
                                <span
                                  key={v.id}
                                  className="text-[11px] px-1.5 py-0.5 bg-ui-bg-subtle rounded border border-ui-border-base text-ui-fg-subtle"
                                >
                                  {v.title && v.title !== "Default" ? (
                                    <span>{v.title}: </span>
                                  ) : null}
                                  <strong className="text-ui-fg-base font-medium">{curr} {amt}</strong>
                                </span>
                              )
                            })
                          ) : (
                            <span className="text-ui-fg-muted text-xs">-</span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={prod.status === "published" ? "green" : "grey"} size="xsmall">
                          {prod.status || "published"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/products/${prod.id}`)
                          }}
                        >
                          Edit
                        </Button>
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
              Create a food or beverage dish with pricing, photo, dietary tags, and portion variants.
            </Drawer.Description>
          </Drawer.Header>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              addDishMutation.mutate()
            }}
            className="flex flex-col gap-y-5 p-6 overflow-y-auto max-h-[calc(100vh-180px)]"
          >
            {/* Callout */}
            <div className="flex items-start gap-x-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3 py-2.5">
              <InformationCircle className="h-4 w-4 mt-0.5 text-ui-fg-muted flex-shrink-0" />
              <p className="text-xs text-ui-fg-subtle leading-relaxed">
                Enter the essentials here to quickly add this dish to your restaurant menu.
                Advanced options — additional toppings, detailed inventory, and pricing matrices — can also be
                managed centrally in the <strong className="text-ui-fg-base font-medium">Products</strong> section.
              </p>
            </div>

            {/* Dish Title */}
            <div className="flex flex-col gap-y-1.5">
              <Label className="text-xs font-semibold">Dish Title *</Label>
              <Input
                value={dishTitle}
                onChange={(e) => setDishTitle(e.target.value)}
                placeholder="e.g. Hyderabadi Chicken Biryani, Butter Chicken, Margherita Pizza"
                required
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-y-1.5">
              <Label className="text-xs font-semibold">Description / Ingredients</Label>
              <Input
                value={dishDesc}
                onChange={(e) => setDishDesc(e.target.value)}
                placeholder="Describe the dish — ingredients, spice level, preparation style..."
              />
            </div>

            {/* Price & Currency */}
            <div className="flex flex-col gap-y-1.5">
              <Label className="text-xs font-semibold">Base Price *</Label>
              <div className="flex items-center gap-x-2">
                <div className="w-24 shrink-0">
                  <select
                    value={dishCurrency}
                    onChange={(e) => setDishCurrency(e.target.value as "eur" | "usd")}
                    className="w-full h-8 px-2.5 text-xs rounded-md border border-ui-border-base bg-ui-bg-base text-ui-fg-base font-medium shadow-xs"
                  >
                    <option value="eur">EUR €</option>
                    <option value="usd">USD $</option>
                  </select>
                </div>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ui-fg-muted">
                    {dishCurrency === "eur" ? "€" : "$"}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    placeholder="12.00"
                    required
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Dietary Selection matching Admin */}
            <div className="flex flex-col gap-y-1.5">
              <Label className="text-xs font-semibold">Dietary Classification</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "None / Not Specified", value: "" },
                  { label: "Vegetarian (Veg)", value: "veg" },
                  { label: "Non-Vegetarian (Non-Veg)", value: "non_veg" },
                  { label: "Contains Egg", value: "egg" },
                  { label: "Vegan", value: "vegan" },
                ].map((opt) => {
                  const isSelected = dishDietary === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDishDietary(opt.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
                        isSelected
                          ? "bg-ui-bg-base text-ui-fg-base border-ui-border-interactive shadow-xs font-semibold ring-1 ring-ui-border-interactive"
                          : "bg-ui-bg-subtle text-ui-fg-subtle border-ui-border-base hover:bg-ui-bg-base hover:text-ui-fg-base"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Portions / Variants */}
            <div className="flex flex-col gap-y-2 border border-ui-border-base rounded-lg p-3 bg-ui-bg-subtle/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-ui-fg-base">
                  Portion Sizes & Variants
                </Label>
                <span className="text-[11px] text-ui-fg-muted">
                  {1 + additionalPortions.length} {1 + additionalPortions.length === 1 ? "variant" : "variants"} configured
                </span>
              </div>

              {/* Base portion */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-[11px] text-ui-fg-muted block mb-0.5">Primary Portion Title</Label>
                  <Input
                    value={dishPortion}
                    onChange={(e) => setDishPortion(e.target.value)}
                    placeholder="Regular, Single, 1-Person"
                    required
                  />
                </div>
                <div className="w-28">
                  <Label className="text-[11px] text-ui-fg-muted block mb-0.5">Price ({dishCurrency.toUpperCase()})</Label>
                  <Input
                    value={dishPrice}
                    disabled
                    className="bg-ui-bg-subtle text-ui-fg-muted font-mono"
                  />
                </div>
              </div>

              {/* Additional portions list */}
              {additionalPortions.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-ui-bg-base p-2 rounded-md border border-ui-border-base">
                  <div className="flex-1 text-xs font-medium text-ui-fg-base">
                    {p.title}
                  </div>
                  <div className="w-24 text-xs font-mono text-ui-fg-muted">
                    {dishCurrency === "eur" ? "€" : "$"}{Number(p.price).toFixed(2)}
                  </div>
                  <Button
                    type="button"
                    variant="transparent"
                    size="small"
                    onClick={() => setAdditionalPortions(additionalPortions.filter((_, i) => i !== idx))}
                    className="text-ui-fg-muted hover:text-ui-fg-error"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}

              {/* Add Extra Portion row */}
              <div className="flex items-end gap-2 pt-2 border-t border-ui-border-base">
                <div className="flex-1">
                  <Input
                    placeholder="e.g. Half, Full, Large, 12-inch"
                    value={newPortionTitle}
                    onChange={(e) => setNewPortionTitle(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    value={newPortionPrice}
                    onChange={(e) => setNewPortionPrice(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    if (!newPortionTitle.trim()) {
                      toast.error("Please enter a portion name")
                      return
                    }
                    setAdditionalPortions([
                      ...additionalPortions,
                      {
                        title: newPortionTitle.trim(),
                        price: newPortionPrice.trim() || dishPrice,
                      },
                    ])
                    setNewPortionTitle("")
                    setNewPortionPrice("")
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Variant
                </Button>
              </div>
            </div>

            {/* Dish Image / Photo */}
            <div className="flex flex-col gap-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-1.5">
                  <Photo className="h-3.5 w-3.5 text-ui-fg-muted" />
                  <Label className="text-xs font-semibold">Dish Image / Photo</Label>
                </div>
                <div className="flex items-center gap-1 bg-ui-bg-subtle p-0.5 rounded-md border border-ui-border-base">
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode("upload")
                      setThumbnailUrl("")
                      setImagePreview("")
                    }}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition ${
                      imageMode === "upload"
                        ? "bg-ui-bg-base text-ui-fg-base shadow-xs font-semibold"
                        : "text-ui-fg-subtle hover:text-ui-fg-base"
                    }`}
                  >
                    Upload from Laptop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode("url")
                      setSelectedFile(null)
                      setImagePreview("")
                    }}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition ${
                      imageMode === "url"
                        ? "bg-ui-bg-base text-ui-fg-base shadow-xs font-semibold"
                        : "text-ui-fg-subtle hover:text-ui-fg-base"
                    }`}
                  >
                    Web URL
                  </button>
                </div>
              </div>

              {imageMode === "upload" ? (
                <div className="flex flex-col gap-y-2">
                  <label className="flex flex-col items-center justify-center border border-dashed border-ui-border-base hover:border-ui-border-interactive rounded-lg p-4 cursor-pointer bg-ui-bg-subtle/50 transition gap-y-1">
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.svg,.avif"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setSelectedFile(file)
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            const res = reader.result as string
                            setImagePreview(res)
                            setThumbnailUrl(res)
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="hidden"
                    />
                    <Photo className="h-5 w-5 text-ui-fg-muted" />
                    <span className="text-xs font-medium text-ui-fg-base">
                      {selectedFile ? selectedFile.name : "Click to choose dish photo from your computer"}
                    </span>
                    <span className="text-[11px] text-ui-fg-subtle">
                      PNG, JPG, WebP — up to 50 MB
                    </span>
                  </label>

                  {imagePreview && (
                    <div className="flex items-center gap-3 p-2 bg-ui-bg-subtle rounded-md border border-ui-border-base">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-md border border-ui-border-base shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ui-fg-base truncate">
                          {selectedFile?.name || "Selected Dish Photo"}
                        </p>
                        <p className="text-[10px] text-ui-fg-subtle">Ready to upload on save</p>
                      </div>
                      <Button
                        type="button"
                        variant="transparent"
                        size="small"
                        onClick={() => {
                          setSelectedFile(null)
                          setImagePreview("")
                          setThumbnailUrl("")
                        }}
                        className="text-ui-fg-muted hover:text-ui-fg-error"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-y-2">
                  <Input
                    value={thumbnailUrl}
                    onChange={(e) => {
                      setThumbnailUrl(e.target.value)
                      setImagePreview(e.target.value)
                    }}
                    placeholder="https://example.com/dish-photo.jpg"
                  />
                  {thumbnailUrl && (
                    <div className="flex items-center gap-3 p-2 bg-ui-bg-subtle rounded-md border border-ui-border-base">
                      <img
                        src={thumbnailUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-md border border-ui-border-base shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ui-fg-base truncate">{thumbnailUrl}</p>
                        <p className="text-[10px] text-ui-fg-subtle">Image URL preview</p>
                      </div>
                      <Button
                        type="button"
                        variant="transparent"
                        size="small"
                        onClick={() => {
                          setThumbnailUrl("")
                          setImagePreview("")
                        }}
                        className="text-ui-fg-muted hover:text-ui-fg-error"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
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
