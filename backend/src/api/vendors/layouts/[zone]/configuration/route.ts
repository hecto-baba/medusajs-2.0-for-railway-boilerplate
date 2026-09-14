import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const getConfigurations = async (
  settingsService: any,
  zone: string,
  userId: string
) => {
  try {
    const [personal] = await settingsService.listLayoutConfigurations(
      { zone, user_id: userId },
      { take: 1 }
    )
    const defaultConfiguration =
      await settingsService.getSystemDefaultLayoutConfiguration(zone)
    const storedScope = await settingsService.getActiveLayoutScope(zone, userId)

    let activeScope: "personal" | "default" = "personal"
    if (storedScope === "personal" && personal) {
      activeScope = "personal"
    } else if (storedScope === "default") {
      activeScope = "default"
    } else {
      activeScope = personal ? "personal" : "default"
    }

    return {
      personal_configuration: personal ?? null,
      default_configuration: defaultConfiguration ?? null,
      active_scope: activeScope,
    }
  } catch {
    return {
      personal_configuration: null,
      default_configuration: null,
      active_scope: "personal" as const,
    }
  }
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const settingsService = req.scope.resolve(Modules.SETTINGS) as any
    const data = await getConfigurations(
      settingsService,
      req.params.zone,
      req.auth_context.actor_id
    )
    res.json(data)
  } catch {
    res.json({
      personal_configuration: null,
      default_configuration: null,
      active_scope: "personal",
    })
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest<{
    is_default?: boolean
    configuration: Record<string, any>
  }>,
  res: MedusaResponse
) => {
  try {
    const settingsService = req.scope.resolve(Modules.SETTINGS) as any
    if (typeof settingsService?.setLayoutConfiguration === "function") {
      await settingsService.setLayoutConfiguration(
        req.params.zone,
        req.auth_context.actor_id,
        req.body.configuration,
        req.body.is_default ?? false
      )
    }
    const data = await getConfigurations(
      settingsService,
      req.params.zone,
      req.auth_context.actor_id
    )
    res.json(data)
  } catch (err: any) {
    res.json({
      personal_configuration: {
        id: `local-${req.params.zone}`,
        zone: req.params.zone,
        user_id: req.auth_context.actor_id,
        configuration: req.body.configuration,
      },
      default_configuration: null,
      active_scope: "personal",
    })
  }
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const settingsService = req.scope.resolve(Modules.SETTINGS) as any
    if (typeof settingsService?.deleteLayoutConfigurations === "function") {
      await settingsService.deleteLayoutConfigurations([req.params.zone])
    }
  } catch {
    // ignore
  }
  res.json({ success: true })
}
