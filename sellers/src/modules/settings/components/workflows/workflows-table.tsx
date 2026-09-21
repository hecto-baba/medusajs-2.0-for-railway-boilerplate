"use client"

import {
  listVendorWorkflowExecutions,
  type VendorWorkflowExecution,
} from "@lib/data/vendor-client"
import {
  ArrowPath,
  Check,
  InformationCircleSolid,
  MagnifyingGlass,
  SquareTwoStack,
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
import { WorkflowDetailDrawer } from "./workflow-detail-drawer"

type WorkflowStateFilter = "all" | "done" | "failed" | "invoking" | "reverted"

const PAGE_SIZE = 20

export const WorkflowsTable = () => {
  const [activeTab, setActiveTab] = useState<WorkflowStateFilter>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [selectedExecution, setSelectedExecution] =
    useState<VendorWorkflowExecution | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const limit = PAGE_SIZE
  const offset = page * limit

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vendor-workflow-executions", limit, offset, activeTab, search],
    queryFn: () =>
      listVendorWorkflowExecutions({
        limit,
        offset,
        state: activeTab === "all" ? undefined : activeTab,
        q: search.trim() || undefined,
      }),
    placeholderData: (prev) => prev,
  })

  const executions = useMemo(
    () => data?.workflow_executions || [],
    [data?.workflow_executions]
  )
  const totalCount = data?.count || 0
  const totalPages = Math.ceil(totalCount / limit) || 1

  const getStateColor = (state: string) => {
    switch (state?.toLowerCase()) {
      case "done":
        return "green"
      case "failed":
        return "red"
      case "invoking":
        return "blue"
      case "reverted":
        return "orange"
      default:
        return "grey"
    }
  }

  const copyTransaction = (e: React.MouseEvent, txId: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(txId)
    setCopiedId(txId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRowClick = (exec: VendorWorkflowExecution) => {
    setSelectedExecution(exec)
    setDrawerOpen(true)
  }

  return (
    <>
      <Container className="divide-y p-0 overflow-hidden shadow-elevation-card-rest">
        {/* Header Section */}
        <div className="flex flex-col gap-y-3 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Heading level="h2">Workflows</Heading>
              <Text size="small" className="text-ui-fg-subtle mt-0.5">
                View and track workflow executions, automated background jobs, and API integrations for your store.
              </Text>
            </div>

            <div className="flex items-center gap-x-2">
              <Button
                variant="secondary"
                size="small"
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-x-1.5"
              >
                <ArrowPath
                  className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-ui-fg-interactive" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Controls: Search and State Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-x-1 bg-ui-bg-subtle p-1 rounded-lg border border-ui-border-base">
              {(["all", "done", "failed", "invoking", "reverted"] as WorkflowStateFilter[]).map(
                (tab) => {
                  const isActive = activeTab === tab
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab)
                        setPage(0)
                      }}
                      className={`px-3 py-1 rounded text-xs font-medium capitalize transition-all ${
                        isActive
                          ? "bg-ui-bg-base text-ui-fg-base shadow-sm font-semibold"
                          : "text-ui-fg-subtle hover:text-ui-fg-base"
                      }`}
                    >
                      {tab}
                    </button>
                  )
                }
              )}
            </div>

            <div className="w-full sm:w-72 relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ui-fg-muted pointer-events-none" />
              <Input
                size="small"
                placeholder="Search by workflow or transaction..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="w-1/4">Workflow</Table.HeaderCell>
                <Table.HeaderCell className="w-1/3">Transaction ID</Table.HeaderCell>
                <Table.HeaderCell>State</Table.HeaderCell>
                <Table.HeaderCell>Progress</Table.HeaderCell>
                <Table.HeaderCell>Created</Table.HeaderCell>
                <Table.HeaderCell className="text-right"></Table.HeaderCell>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {isLoading ? (
                <Table.Row>
                  <td colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-y-2 text-ui-fg-muted">
                      <ArrowPath className="h-6 w-6 animate-spin text-ui-fg-interactive" />
                      <Text size="small">Loading workflow executions...</Text>
                    </div>
                  </td>
                </Table.Row>
              ) : executions.length === 0 ? (
                <Table.Row>
                  <td colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-y-2 text-ui-fg-muted py-6 max-w-md mx-auto">
                      <InformationCircleSolid className="h-8 w-8 text-ui-fg-muted" />
                      <Text size="small" weight="plus" className="text-ui-fg-base">
                        {search || activeTab !== "all"
                          ? "No matching workflow executions found"
                          : "No workflows have been executed, yet"}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {search || activeTab !== "all"
                          ? "Try adjusting your state filter or search term."
                          : "When automated catalog imports, price calculations, or batch transactions run, they will be logged here."}
                      </Text>
                    </div>
                  </td>
                </Table.Row>
              ) : (
                executions.map((exec) => {
                  const stepsMap = exec.execution?.steps || {}
                  const actionableSteps = Object.values(stepsMap).filter(
                    (s) => s.id && !s.id.startsWith("_root")
                  )
                  const completedSteps = actionableSteps.filter(
                    (s) => s.invoke?.state === "done"
                  )

                  return (
                    <Table.Row
                      key={exec.id}
                      className="cursor-pointer transition-colors hover:bg-ui-bg-subtle/70"
                      onClick={() => handleRowClick(exec)}
                    >
                      <Table.Cell>
                        <Badge size="2xsmall" className="font-mono text-ui-fg-base max-w-[200px] truncate">
                          {exec.workflow_id}
                        </Badge>
                      </Table.Cell>

                      <Table.Cell>
                        <div className="flex items-center gap-x-1.5">
                          <code className="text-ui-fg-subtle bg-ui-bg-subtle border-ui-border-base rounded px-1.5 py-0.5 text-xs font-mono max-w-[240px] truncate">
                            {exec.transaction_id}
                          </code>
                          <button
                            onClick={(e) => copyTransaction(e, exec.transaction_id)}
                            className="text-ui-fg-muted hover:text-ui-fg-base p-1 rounded transition-colors"
                            title="Copy Transaction ID"
                          >
                            {copiedId === exec.transaction_id ? (
                              <Check className="text-ui-fg-interactive h-3.5 w-3.5" />
                            ) : (
                              <SquareTwoStack className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </Table.Cell>

                      <Table.Cell>
                        <StatusBadge color={getStateColor(exec.state)}>
                          <span className="capitalize text-xs">{exec.state}</span>
                        </StatusBadge>
                      </Table.Cell>

                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-subtle">
                          {actionableSteps.length > 0
                            ? `${completedSteps.length} of ${actionableSteps.length} steps`
                            : "-"}
                        </Text>
                      </Table.Cell>

                      <Table.Cell>
                        <Text size="small" className="text-ui-fg-muted">
                          {new Date(exec.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </Table.Cell>

                      <Table.Cell className="text-right">
                        <Button variant="transparent" size="small" className="text-xs text-ui-fg-interactive">
                          View details
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
                })
              )}
            </Table.Body>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-3 border-t bg-ui-bg-subtle/30">
          <Text size="xsmall" className="text-ui-fg-muted">
            {totalCount > 0
              ? `Showing ${offset + 1} - ${Math.min(offset + limit, totalCount)} of ${totalCount} executions`
              : "0 executions"}
          </Text>

          <div className="flex items-center gap-x-2">
            <Button
              variant="secondary"
              size="small"
              disabled={page === 0 || isLoading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Text size="xsmall" className="text-ui-fg-subtle px-1">
              Page {page + 1} of {totalPages}
            </Text>
            <Button
              variant="secondary"
              size="small"
              disabled={page + 1 >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Container>

      <WorkflowDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        execution={selectedExecution}
      />
    </>
  )
}
