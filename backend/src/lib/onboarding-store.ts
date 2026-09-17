import * as fs from "fs"
import * as path from "path"
import { Pool } from "pg"

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
  private pool: Pool | null = null
  private dbReady = false
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initDatabase()
  }

  private getDatabaseUrl(): string | undefined {
    return process.env.DATABASE_URL
  }

  private initDatabase() {
    const dbUrl = this.getDatabaseUrl()
    if (!dbUrl) return

    try {
      this.pool = new Pool({
        connectionString: dbUrl,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: dbUrl.includes("sslmode=require") || process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      })

      this.initPromise = this.ensureTableAndLoad()
    } catch (err) {
      console.warn("[OnboardingStore] Failed to initialize Postgres pool, using file fallback:", err)
    }
  }

  private async ensureTableAndLoad(): Promise<void> {
    if (!this.pool) return
    try {
      // 1. Create table if not exists
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS vendor_onboarding_application (
          vendor_id VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      // 2. Load all records from database into memory
      const { rows } = await this.pool.query(`
        SELECT vendor_id, data FROM vendor_onboarding_application;
      `)

      for (const row of rows) {
        if (row.vendor_id && row.data) {
          const rec = row.data as VendorApplicationRecord
          rec.vendorId = row.vendor_id
          this.records.set(row.vendor_id, rec)
        }
      }

      // 3. Migrate any existing file records into Postgres
      this.loadFromFile()
      for (const [vendorId, record] of this.records.entries()) {
        const found = rows.some((r) => r.vendor_id === vendorId)
        if (!found) {
          await this.persistToDb(record).catch(() => {})
        }
      }

      this.dbReady = true
      this.initialized = true
    } catch (err) {
      console.warn("[OnboardingStore] Database sync error, falling back to local store:", err)
      this.loadFromFile()
    }
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, "utf-8")
        const parsed = JSON.parse(raw) as Record<string, VendorApplicationRecord>
        for (const [k, v] of Object.entries(parsed)) {
          if (!this.records.has(k)) {
            this.records.set(k, v)
          }
        }
      }
    } catch {
      // Ignore file read error
    }
  }

  private async persistToDb(record: VendorApplicationRecord): Promise<void> {
    if (!this.pool) return
    try {
      await this.pool.query(
        `
        INSERT INTO vendor_onboarding_application (vendor_id, data, status, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (vendor_id) DO UPDATE
        SET data = EXCLUDED.data,
            status = EXCLUDED.status,
            updated_at = NOW();
      `,
        [record.vendorId, JSON.stringify(record), record.status]
      )
    } catch (err) {
      console.error(`[OnboardingStore] Failed to persist record ${record.vendorId} to DB:`, err)
    }
  }

  private persistToFile() {
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
      // Ignore file write errors
    }
  }

  private persist(record: VendorApplicationRecord) {
    this.persistToFile()
    if (this.pool) {
      this.persistToDb(record).catch(() => {})
    }
  }

  public async ensureLoaded(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
    }
  }

  public get(vendorId: string): VendorApplicationRecord {
    if (!this.initialized) {
      this.loadFromFile()
    }
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
      this.persist(record)
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
    this.persist(record)
    return record
  }

  public submit(vendorId: string): VendorApplicationRecord {
    const record = this.get(vendorId)
    record.status = "UNDER_REVIEW"
    record.submittedAt = new Date().toISOString()
    record.rejectionReason = null
    record.feedback = null
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist(record)
    return record
  }

  public approve(vendorId: string): VendorApplicationRecord {
    const record = this.get(vendorId)
    record.status = "APPROVED"
    record.approvedAt = new Date().toISOString()
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist(record)
    return record
  }

  public reject(vendorId: string, reason: string): VendorApplicationRecord {
    const record = this.get(vendorId)
    record.status = "REJECTED"
    record.rejectionReason = reason
    record.feedback = reason
    record.rejectedAt = new Date().toISOString()
    record.updatedAt = new Date().toISOString()
    this.records.set(vendorId, record)
    this.persist(record)
    return record
  }

  public listAll(): VendorApplicationRecord[] {
    return Array.from(this.records.values())
  }
}

export const onboardingStore = new OnboardingStore()
