import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import {
  Button,
  Container,
  createDataTableColumnHelper,
  createDataTableFilterHelper,
  DataTable,
  DataTablePaginationState,
  DataTableFilteringState,
  DataTableSortingState,
  Heading,
  Label,
  StatusBadge,
  Switch,
  Text,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/sdk"
import { TransactionTypeDetailDrawer } from "../../components/transaction-type-detail-drawer"
import { TransactionTypeFormModal } from "../../components/transaction-type-form-modal"
import { TransactionTypeImportModal } from "../../components/transaction-type-import-modal"
import { TransactionTypeRankingModal } from "../../components/transaction-type-ranking-modal"
import {
  ExportResponse,
  STATUS_STYLES,
  TransactionType,
  TransactionTypeListResponse,
  TransactionTypeStatus,
  TRANSACTION_TYPE_STATUSES,
} from "../../types/transaction-type"

const PAGE_SIZE = 50

const columnHelper = createDataTableColumnHelper<TransactionType>()
const filterHelper = createDataTableFilterHelper<TransactionType>()

const TransactionTypesPage = () => {
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })
  const [filtering, setFiltering] = useState<DataTableFilteringState>({})
  const [sorting, setSorting] = useState<DataTableSortingState | null>({
    id: "rank",
    desc: false,
  })

  // Deleted rows are hidden by default; the toggle is what makes a soft
  // deleted type reachable again so it can be restored.
  const [showDeleted, setShowDeleted] = useState(false)
  const [selected, setSelected] = useState<TransactionType | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // Every bit of state maps onto a query parameter the list route already
  // understands, so search, sort, filter and pagination are all resolved by
  // the server rather than in the browser.
  const query = useMemo(() => {
    const statusFilter = filtering.status as
      | { value?: string[] }
      | string[]
      | undefined

    const statuses = Array.isArray(statusFilter)
      ? statusFilter
      : statusFilter?.value

    return {
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      ...(search ? { q: search } : {}),
      ...(statuses?.length ? { status: statuses } : {}),
      ...(showDeleted ? { with_deleted: true } : {}),
      ...(sorting
        ? { order: `${sorting.desc ? "-" : ""}${sorting.id}` }
        : {}),
    }
  }, [search, pagination, filtering, sorting, showDeleted])

  const { data, isLoading, isError, error, refetch } =
    useQuery<TransactionTypeListResponse>({
      queryFn: () =>
        sdk.client.fetch("/admin/transaction-types", { query }),
      queryKey: [["transaction-types", query]],
    })

  // The ranking screen always works on the full set in rank order, never on
  // the filtered page the table happens to be showing.
  const { data: allForRanking } = useQuery<TransactionTypeListResponse>({
    queryFn: () =>
      sdk.client.fetch("/admin/transaction-types", {
        query: { limit: 1000, order: "rank" },
      }),
    queryKey: [["transaction-types", "all-for-ranking"]],
    enabled: rankingOpen,
  })

  const transactionTypes = data?.transaction_types ?? []
  const count = data?.count ?? 0

  const refreshAll = () => {
    refetch()
  }

  const exportCsv = async () => {
    try {
      const result = await sdk.client.fetch<ExportResponse>(
        "/admin/transaction-types/export",
        { method: "POST", query }
      )

      toast.success(`Exported ${result.export.count} transaction type(s)`)

      // Opened rather than fetched: the file lives behind the file module's
      // own URL, which the browser can follow directly.
      window.open(result.export.url, "_blank")
    } catch (error: any) {
      toast.error(error?.message || "Could not export")
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("icon_url", {
        header: "",
        enableSorting: false,
        cell: ({ getValue }) => {
          const url = getValue()

          return url ? (
            <img
              src={url}
              alt=""
              className="size-6 rounded border border-ui-border-base object-cover"
            />
          ) : (
            <div className="size-6 rounded border border-dashed border-ui-border-base" />
          )
        },
      }),
      columnHelper.accessor("name", {
        header: "Name",
        enableSorting: true,
        sortLabel: "Name",
        sortAscLabel: "A-Z",
        sortDescLabel: "Z-A",
        cell: ({ getValue, row }) => (
          <div className="flex items-center gap-2">
            <Text size="small" weight="plus">
              {getValue()}
            </Text>
            {row.original.deleted_at && (
              <StatusBadge color="red">Deleted</StatusBadge>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("code", {
        header: "Code",
        enableSorting: true,
        sortLabel: "Code",
        sortAscLabel: "A-Z",
        sortDescLabel: "Z-A",
      }),
      columnHelper.accessor("description", {
        header: "Description",
        enableSorting: false,
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {getValue() || "—"}
          </Text>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        enableSorting: true,
        sortLabel: "Status",
        cell: ({ getValue }) => {
          const style = STATUS_STYLES[getValue() as TransactionTypeStatus]

          return (
            <StatusBadge color={style?.color ?? "grey"}>
              {style?.label ?? getValue()}
            </StatusBadge>
          )
        },
      }),
      columnHelper.accessor("rank", {
        header: "Order",
        enableSorting: true,
        sortLabel: "Order",
        cell: ({ getValue }) => (
          <Text size="small" className="text-ui-fg-subtle">
            {(getValue() as number) + 1}
          </Text>
        ),
      }),
    ],
    []
  )

  const filters = useMemo(
    () => [
      // multiselect rather than select: the backend accepts an array of
      // statuses, and "show me draft and inactive" is a real thing to want.
      filterHelper.accessor("status", {
        type: "multiselect",
        label: "Status",
        options: TRANSACTION_TYPE_STATUSES.map((status) => ({
          label: STATUS_STYLES[status].label,
          value: status,
        })),
      }),
    ],
    []
  )

  const table = useDataTable({
    data: transactionTypes,
    columns,
    filters,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    search: { state: search, onSearchChange: setSearch },
    pagination: { state: pagination, onPaginationChange: setPagination },
    filtering: { state: filtering, onFilteringChange: setFiltering },
    sorting: { state: sorting, onSortingChange: setSorting },
    onRowClick: (_event, row) => {
      setSelected(row)
      setDrawerOpen(true)
    },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <div>
            <Heading level="h2">Transaction Types</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Kinds of transaction the marketplace supports, and the order they
              are shown in
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <DataTable.Search placeholder="Search" />
            <DataTable.FilterMenu tooltip="Filter" />
            <DataTable.SortingMenu tooltip="Sort" />

            {/* Surfaces soft deleted types so they can be restored. Without
                it a deleted type is unreachable, which would make a
                recoverable delete recoverable in name only. */}
            <div className="flex items-center gap-2 px-1">
              <Switch
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={(checked) => {
                  setShowDeleted(checked)
                  setPagination((current) => ({ ...current, pageIndex: 0 }))
                }}
              />
              <Label size="small" htmlFor="show-deleted">
                Show deleted
              </Label>
            </div>

            <Button
              size="small"
              variant="secondary"
              onClick={() => setRankingOpen(true)}
            >
              Edit ranking
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setImportOpen(true)}
            >
              Import
            </Button>
            <Button size="small" variant="secondary" onClick={exportCsv}>
              Export
            </Button>

            <TransactionTypeFormModal
              onSaved={refreshAll}
              trigger={<Button size="small">Create</Button>}
            />
          </div>
        </DataTable.Toolbar>

        {/* A failed request must not render as an empty table: telling an
            admin there are no transaction types when the fetch actually
            failed is worse than showing nothing. */}
        {isError && (
          <div className="px-6 py-4">
            <Text size="small" className="text-ui-fg-error">
              {(error as any)?.message ||
                "Could not load transaction types. Try again."}
            </Text>
          </div>
        )}

        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No transaction types yet",
              description:
                "Create one to configure the kinds of transaction the marketplace supports.",
            },
            filtered: {
              heading: "No matches",
              description:
                "No transaction types match the current search or filters.",
            },
          }}
        />

        <DataTable.Pagination />
      </DataTable>

      <TransactionTypeDetailDrawer
        transactionType={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={() => {
          refreshAll()

          // Keep the drawer's copy in step with what was just saved.
          if (selected) {
            sdk.client
              .fetch<{ transaction_type: TransactionType }>(
                `/admin/transaction-types/${selected.id}`
              )
              .then((result) => setSelected(result.transaction_type))
              .catch(() => setDrawerOpen(false))
          }
        }}
      />

      <TransactionTypeRankingModal
        transactionTypes={allForRanking?.transaction_types ?? transactionTypes}
        open={rankingOpen}
        onOpenChange={setRankingOpen}
        onSaved={refreshAll}
      />

      <TransactionTypeImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshAll}
      />
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Transaction Types",
  icon: CurrencyDollar,
})

export default TransactionTypesPage
