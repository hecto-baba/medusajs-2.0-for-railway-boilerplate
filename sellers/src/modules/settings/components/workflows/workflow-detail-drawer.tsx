"use client"

import {
  type VendorWorkflowExecution,
  type VendorWorkflowStep,
} from "@lib/data/vendor-client"
import {
  ArrowPath,
  Check,
  CheckCircleSolid,
  Clock,
  SquareTwoStack,
  XCircle,
  XCircleSolid,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Copy,
  Drawer,
  Heading,
  StatusBadge,
  Text,
} from "@medusajs/ui"
import { useState } from "react"

interface WorkflowDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  execution: VendorWorkflowExecution | null
}

export const WorkflowDetailDrawer = ({
  open,
  onOpenChange,
  execution,
}: WorkflowDetailDrawerProps) => {
  const [copiedTx, setCopiedTx] = useState(false)
  const [activeTab, setActiveTab] = useState<"steps" | "context" | "raw">("steps")
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  if (!execution) return null

  const stepsMap = execution.execution?.steps || {}
  const actionableSteps: VendorWorkflowStep[] = Object.values(stepsMap).filter(
    (step) => step.id && !step.id.startsWith("_root")
  )

  const completedSteps = actionableSteps.filter(
    (s) => s.invoke?.state === "done"
  )
  const failedSteps = actionableSteps.filter(
    (s) => s.invoke?.state === "failed"
  )

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

  const getStepIcon = (state?: string) => {
    switch (state?.toLowerCase()) {
      case "done":
        return <CheckCircleSolid className="text-ui-fg-interactive h-4 w-4" />
      case "failed":
        return <XCircleSolid className="text-ui-fg-error h-4 w-4" />
      case "invoking":
        return <ArrowPath className="text-ui-fg-interactive h-4 w-4 animate-spin" />
      default:
        return <Clock className="text-ui-fg-muted h-4 w-4" />
    }
  }

  const copyTransactionId = () => {
    navigator.clipboard.writeText(execution.transaction_id)
    setCopiedTx(true)
    setTimeout(() => setCopiedTx(false), 2000)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="max-w-2xl flex flex-col justify-between">
        <Drawer.Header className="border-b px-6 py-4">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between gap-x-3">
              <div className="flex items-center gap-x-2">
                <Badge size="small" className="font-mono text-ui-fg-base">
                  {execution.workflow_id}
                </Badge>
                <StatusBadge color={getStateColor(execution.state)}>
                  <span className="capitalize">{execution.state}</span>
                </StatusBadge>
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {new Date(execution.created_at).toLocaleString()}
              </Text>
            </div>

            <div className="flex items-center gap-x-2">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Transaction ID:
              </Text>
              <code className="text-ui-fg-muted bg-ui-bg-subtle border-ui-border-base rounded px-1.5 py-0.5 text-xs font-mono">
                {execution.transaction_id}
              </code>
              <Button
                variant="transparent"
                size="small"
                className="h-6 w-6 p-0"
                onClick={copyTransactionId}
              >
                {copiedTx ? (
                  <Check className="text-ui-fg-interactive h-3.5 w-3.5" />
                ) : (
                  <SquareTwoStack className="text-ui-fg-muted h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-x-2 border-t pt-3 mt-3">
            <button
              onClick={() => setActiveTab("steps")}
              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                activeTab === "steps"
                  ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              Execution Steps ({actionableSteps.length})
            </button>
            <button
              onClick={() => setActiveTab("context")}
              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                activeTab === "context"
                  ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              Context Data
            </button>
            <button
              onClick={() => setActiveTab("raw")}
              className={`text-xs font-medium px-2.5 py-1 rounded transition-colors ${
                activeTab === "raw"
                  ? "bg-ui-bg-base shadow-elevation-card-rest text-ui-fg-base"
                  : "text-ui-fg-subtle hover:text-ui-fg-base"
              }`}
            >
              Raw JSON
            </button>
          </div>
        </Drawer.Header>

        <Drawer.Body className="flex flex-1 flex-col gap-y-4 p-6 overflow-y-auto">
          {activeTab === "steps" && (
            <div className="flex flex-col gap-y-3">
              {/* Summary stat cards */}
              <div className="grid grid-cols-3 gap-2 pb-2">
                <div className="bg-ui-bg-subtle border-ui-border-base rounded-md border p-2.5">
                  <Text size="xsmall" className="text-ui-fg-muted font-medium">
                    Total Steps
                  </Text>
                  <Text size="large" weight="plus" className="text-ui-fg-base mt-0.5">
                    {actionableSteps.length}
                  </Text>
                </div>
                <div className="bg-ui-bg-subtle border-ui-border-base rounded-md border p-2.5">
                  <Text size="xsmall" className="text-ui-fg-muted font-medium">
                    Completed
                  </Text>
                  <Text size="large" weight="plus" className="text-ui-fg-interactive mt-0.5">
                    {completedSteps.length}
                  </Text>
                </div>
                <div className="bg-ui-bg-subtle border-ui-border-base rounded-md border p-2.5">
                  <Text size="xsmall" className="text-ui-fg-muted font-medium">
                    Failed
                  </Text>
                  <Text size="large" weight="plus" className="text-ui-fg-error mt-0.5">
                    {failedSteps.length}
                  </Text>
                </div>
              </div>

              {/* Step list */}
              {actionableSteps.length === 0 ? (
                <div className="py-8 text-center text-ui-fg-muted text-sm">
                  No step details recorded for this execution.
                </div>
              ) : (
                actionableSteps.map((step, index) => {
                  const stepState = step.invoke?.state || "dormant"
                  const isExpanded = expandedStep === step.id
                  const stepName = step.id.replace(/^[a-zA-Z0-9_-]+\./, "")

                  return (
                    <div
                      key={step.id || index}
                      className="border-ui-border-base bg-ui-bg-subtle/50 rounded-lg border p-3.5 transition-all"
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer select-none"
                        onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                      >
                        <div className="flex items-center gap-x-2.5">
                          {getStepIcon(stepState)}
                          <div>
                            <Text size="small" weight="plus" className="text-ui-fg-base font-mono">
                              {stepName}
                            </Text>
                            <Text size="xsmall" className="text-ui-fg-muted">
                              Attempt {step.attempts || 1} &bull; Failures: {step.failures || 0}
                            </Text>
                          </div>
                        </div>

                        <div className="flex items-center gap-x-2">
                          <StatusBadge color={getStateColor(stepState)}>
                            <span className="capitalize">{stepState}</span>
                          </StatusBadge>
                          <Text size="xsmall" className="text-ui-fg-muted font-mono">
                            {isExpanded ? "Collapse" : "Expand"}
                          </Text>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-ui-border-base mt-3 border-t pt-3 flex flex-col gap-y-2">
                          {step.invoke?.output && (
                            <div>
                              <Text size="xsmall" weight="plus" className="text-ui-fg-muted mb-1">
                                Output:
                              </Text>
                              <pre className="bg-ui-bg-base border-ui-border-base text-ui-fg-subtle max-h-48 overflow-auto rounded border p-2 text-xs font-mono">
                                {JSON.stringify(step.invoke.output, null, 2)}
                              </pre>
                            </div>
                          )}

                          {stepState === "failed" && (
                            <div className="bg-ui-bg-error-subtle border-ui-border-error/30 rounded border p-2.5 text-xs text-ui-fg-error">
                              <Text size="xsmall" weight="plus">
                                Step Execution Failed
                              </Text>
                              <p className="mt-1">
                                The transaction halted at this step. Automatic compensation or rollback was triggered.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {activeTab === "context" && (
            <div className="flex flex-col gap-y-2">
              <Text size="small" className="text-ui-fg-subtle">
                Execution context data passed to this workflow transaction:
              </Text>
              <pre className="bg-ui-bg-base border-ui-border-base text-ui-fg-subtle max-h-[480px] overflow-auto rounded border p-3 text-xs font-mono">
                {JSON.stringify(execution.context || {}, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === "raw" && (
            <div className="flex flex-col gap-y-2">
              <Text size="small" className="text-ui-fg-subtle">
                Complete workflow execution JSON payload:
              </Text>
              <pre className="bg-ui-bg-base border-ui-border-base text-ui-fg-subtle max-h-[480px] overflow-auto rounded border p-3 text-xs font-mono">
                {JSON.stringify(execution, null, 2)}
              </pre>
            </div>
          )}
        </Drawer.Body>

        <Drawer.Footer className="border-t p-4 flex items-center justify-between bg-ui-bg-base">
          <Text size="xsmall" className="text-ui-fg-muted">
            ID: {execution.id}
          </Text>
          <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
