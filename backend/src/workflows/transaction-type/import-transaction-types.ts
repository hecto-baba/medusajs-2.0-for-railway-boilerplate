import {
  createStep,
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { parseTransactionTypesCsvStep } from "../steps/transaction-type/parse-transaction-types-csv"
import { applyTransactionTypesImportStep } from "../steps/transaction-type/apply-transaction-types-import"
import { recordTransactionTypeActivitiesStep } from "../steps/transaction-type/record-transaction-type-activity"
import { TransactionTypeActivityAction } from "../../modules/transaction-type/models/transaction-type-activity"
import { ActivityActor } from "../steps/transaction-type/types"

export type ImportTransactionTypesWorkflowInput = ActivityActor & {
  fileContent: string
  filename: string
}

export const waitConfirmationTransactionTypeImportStepId =
  "wait-confirmation-transaction-type-import"

/**
 * Exported because the confirm route needs it to address the parked run:
 * setStepSuccess is keyed by workflow id plus step id, so both have to be
 * referenced by constant rather than retyped as string literals.
 */
export const importTransactionTypesWorkflowId = "import-transaction-types"

/**
 * Pauses the workflow until an admin confirms the preview.
 *
 * An empty async step with no timeout: the workflow engine parks the run here
 * and only resumes when setStepSuccess is called with this step's id, which
 * the confirm route does. That is what makes the import two-phase - the
 * summary is returned and nothing is written until a human agrees to it.
 */
export const waitConfirmationTransactionTypeImportStep = createStep(
  {
    name: waitConfirmationTransactionTypeImportStepId,
    async: true,
    // Bounded at an hour, matching Medusa's own product import. A parked run
    // holds engine state, so an admin who opens a preview and walks away
    // would otherwise orphan it indefinitely.
    timeout: 60 * 60,
  },
  async () => {}
)

export const importTransactionTypesWorkflow = createWorkflow(
  importTransactionTypesWorkflowId,
  (input: ImportTransactionTypesWorkflowInput) => {
    // Parses and validates without writing, so the summary can be shown first.
    const summary = parseTransactionTypesCsvStep({
      fileContent: input.fileContent,
      filename: input.filename,
    })

    waitConfirmationTransactionTypeImportStep()

    const rows = transform({ summary }, (data) => {
      // Re-checked after confirmation rather than before the pause: refusing
      // here means a file with broken rows cannot be committed even if the
      // confirm call is made directly rather than through the UI.
      if (data.summary.errors.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `"${data.summary.filename}" has ${data.summary.errors.length} invalid row(s) and cannot be imported.`
        )
      }

      return data.summary.rows
    })

    const applied = applyTransactionTypesImportStep({ rows })

    const activities = transform({ input, applied }, (data) => [
      ...data.applied.created.map((transactionType: any) => ({
        transaction_type_id: transactionType.id,
        action: TransactionTypeActivityAction.IMPORTED,
        actor_id: data.input.actor_id,
        actor_email: data.input.actor_email,
        new_status: transactionType.status,
      })),
      ...data.applied.updated.map((transactionType: any) => ({
        transaction_type_id: transactionType.id,
        action: TransactionTypeActivityAction.IMPORTED,
        actor_id: data.input.actor_id,
        actor_email: data.input.actor_email,
      })),
    ])

    recordTransactionTypeActivitiesStep({ activities })

    return new WorkflowResponse(summary)
  }
)
