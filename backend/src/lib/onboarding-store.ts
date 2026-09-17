import * as fs from "fs"
import * as path from "path"

export type OnboardingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"

export interface VendorApplicationRecord {
  vendorId: string
  vendorName?: string
  email?: string
  status: OnboardingStatus
  currentStep: string
  completedSteps: string[]
  segmentId?: string | null
  vendorTypeId?: string | null
  vendorCategoryId?: string | null
  segment?: { id: string; name: string; code: string } | null
  vendorType?: { id: string; name: string; code: string } | null
  vendorCategory?: { id: string; name: string; code: string } | null
  answers: Record<string, Record<string, any>>
  rejectionReason?: string | null
  feedback?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  createdAt: string
  updatedAt: string
}

const STORE_PATH = path.resolve(process.cwd(), ".medusa", "vendor-onboarding-store.json")

class OnboardingStore {
  private records: Map<string, VendorApplicationRecord> = new Map()
  private initialized = false

  private load() {
    if (this.initialized) return
    this.initialized = true
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, "utf-8")
        const parsed = JSON.parse(raw) as Record<string, VendorApplicationRecord>
        for (const [k, v] of Object.entries(parsed)) {
          this.records.set(k, v)
        }
      }
    } catch {
      // In-memory fallback
    }
  }

  private persist() {
    try {
      const dir = path.dirname(STORE_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const obj: Record<string, VendorApplicationRecord> = {}
      for (const [k, v] of this.records.entries()) {
        obj[k] = v
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), "utf-8")
    } catch {
      // Ignore write errors in ephemeral environments
    }
  }

  public get(vendorId: string): VendorApplicationRecord {
    this.load()
    let record = this.records.get(vendorId)
    if (!record) {
      record = {
        vendorId,
        status: "DRAFT",
        currentStep: "SEGMENT_SELECTION",
        completedSteps: [],
        answers: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.records.set(vendorId, record)
      this.persist()
    }
    return record
  }

  public saveStep(
    vendorId: string,
    step: string,
    stepAnswers: Record<string, any>,
    taxonomy?: {
      segmentId?: string
      vendorTypeId?: string
      vendorCategoryId?: string
      segment?: { id: string; name: string; code: string } | null
      vendorType?: { id: string; name: string; code: string } | null
      vendorCategory?: { id: string; name: string; code: string } | null
    }
  ): VendorApplicationRecord {
    this.load()
    const record = this.get(vendorId)

    if (taxonomy?.segmentId !== undefined) record.segmentId = taxonomy.segmentId
    if (taxonomy?.vendorTypeId !== undefined) record.vendorTypeId = taxonomy.vendorTypeId
    if (taxonomy?.vendorCategoryId !== undefined) record.vendorCategoryId = taxonomy.vendorCategoryId
    if (taxonomy?.segment !== undefined) record.segment = taxonomy.segment
    if (taxonomy?.vendorType !== undefined) record.vendorType = taxonomy.vendorType
    if (taxonomy?.vendorCategory !== undefined) record.vendorCategory = taxonomy.vendorCategory

    if (step && step !== "SEGMENT_SELECTION" && step !== "REVIEW") {
      record.answers = record.answers || {}
      record.answers[step] = {
        ...(record.answers[step] || {}),
        ...stepAnswers,
      }
    }

    if (!record.completedSteps.includes(step)) {
      record.completedSteps.push(step)
    }

    record.currentStep = step
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist()
    return record
  }

  public submit(vendorId: string): VendorApplicationRecord {
    this.load()
    const record = this.get(vendorId)
    record.status = "UNDER_REVIEW"
    record.submittedAt = new Date().toISOString()
    record.rejectionReason = null
    record.feedback = null
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist()
    return record
  }

  public approve(vendorId: string): VendorApplicationRecord {
    this.load()
    const record = this.get(vendorId)
    record.status = "APPROVED"
    record.approvedAt = new Date().toISOString()
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist()
    return record
  }

  public reject(vendorId: string, reason: string): VendorApplicationRecord {
    this.load()
    const record = this.get(vendorId)
    record.status = "REJECTED"
    record.rejectionReason = reason
    record.feedback = reason
    record.rejectedAt = new Date().toISOString()
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist()
    return record
  }

  public listAll(): VendorApplicationRecord[] {
    this.load()
    return Array.from(this.records.values())
  }
}

export const onboardingStore = new OnboardingStore()
