import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Hand-written (Plan 3, Phase 2). Additive except for three deliberate changes:
 *   1. provider.vendor_admin_id is no longer unique / required (many resources
 *      per business).
 *   2. appointment_attendee loses its (appointment_id, customer_id) unique
 *      index in favour of a PARTIAL one that ignores cancelled rows and guests.
 *   3. The overlap exclusion constraint is rebuilt on block_start/block_end
 *      (the slot widened by its buffers) instead of start/end.
 *
 * On (3): block_start/block_end are maintained by a BEFORE INSERT/UPDATE
 * trigger that derives them from start_time/end_time and the buffer columns.
 * They are plain columns (not a generated expression) because adding an
 * interval to a timestamptz is not IMMUTABLE and cannot sit inside a generated
 * column. Because the trigger always overwrites them, no application bug can
 * make the stored range disagree with the real times and buffers - the database
 * stays the source of truth for "no two bookings overlap, buffers included".
 * The generated time_range column is computed AFTER BEFORE triggers run, so it
 * always sees the trigger's values.
 *
 * Existing rows keep working unchanged: buffers default to 0, so their block
 * range equals their real range.
 *
 * After this migration:
 *   - run `npx medusa db:generate appointment-booking` ONCE to refresh the
 *     module snapshot, then DELETE the duplicate migration it emits (this file
 *     already contains the SQL) and keep the updated snapshot;
 *   - run src/scripts/backfill-provider-vendor-id.ts to set vendor_id on
 *     pre-existing providers;
 *   - optionally run src/scripts/cleanup-empty-appointment-slots.ts to remove
 *     the old pre-generated, never-booked "available" slots.
 */
export class Migration20261003090000_appointment_resources_v2 extends Migration {

  override async up(): Promise<void> {
    // ---------------------------------------------------------------- provider
    this.addSql(`alter table if exists "provider" add column if not exists "vendor_id" text null;`);
    this.addSql(`alter table if exists "provider" add column if not exists "description" text null;`);
    this.addSql(`alter table if exists "provider" add column if not exists "image_url" text null;`);
    this.addSql(`alter table if exists "provider" add column if not exists "kind" text not null default 'staff';`);
    this.addSql(`alter table if exists "provider" add column if not exists "session_duration_minutes" integer not null default 30;`);
    this.addSql(`alter table if exists "provider" add column if not exists "slot_step_minutes" integer null;`);
    this.addSql(`alter table if exists "provider" add column if not exists "capacity" integer not null default 1;`);
    this.addSql(`alter table if exists "provider" add column if not exists "buffer_before_minutes" integer not null default 0;`);
    this.addSql(`alter table if exists "provider" add column if not exists "buffer_after_minutes" integer not null default 0;`);
    this.addSql(`alter table if exists "provider" add column if not exists "min_notice_minutes" integer not null default 60;`);
    this.addSql(`alter table if exists "provider" add column if not exists "max_advance_days" integer not null default 60;`);
    this.addSql(`alter table if exists "provider" add column if not exists "hold_minutes" integer not null default 10;`);
    this.addSql(`alter table if exists "provider" add column if not exists "cancellation_window_hours" integer not null default 24;`);

    this.addSql(`drop index if exists "IDX_provider_vendor_admin_id_unique";`);
    this.addSql(`alter table if exists "provider" alter column "vendor_admin_id" drop not null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_provider_vendor_id" ON "provider" ("vendor_id") WHERE deleted_at IS NULL;`);
    // One business cannot have two resources with the same name (case-insensitive):
    // keeps the picker unambiguous and makes a double-submitted "Add resource"
    // fail cleanly instead of creating a twin. Legacy rows (no vendor_id) are exempt.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_provider_vendor_id_display_name_unique" ON "provider" ("vendor_id", lower("display_name")) WHERE deleted_at IS NULL AND vendor_id IS NOT NULL AND display_name IS NOT NULL;`);

    // Sanity bounds so a bad write can never produce a nonsensical schedule.
    this.addSql(`alter table if exists "provider" drop constraint if exists "provider_settings_check";`);
    this.addSql(`alter table if exists "provider" add constraint "provider_settings_check" check (
      session_duration_minutes between 1 and 1440
      and (slot_step_minutes is null or slot_step_minutes between 1 and 1440)
      and capacity between 1 and 10000
      and buffer_before_minutes between 0 and 1440
      and buffer_after_minutes between 0 and 1440
      and min_notice_minutes >= 0
      and max_advance_days between 1 and 730
      and hold_minutes between 1 and 120
      and cancellation_window_hours >= 0
    );`);

    // -------------------------------------------------------- service_provider
    this.addSql(`alter table if exists "service_provider" add column if not exists "duration_minutes" integer null;`);
    this.addSql(`alter table if exists "service_provider" add column if not exists "capacity" integer null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_service_provider_service_product_id" ON "service_provider" ("service_product_id") WHERE deleted_at IS NULL;`);

    // ------------------------------------------------- recurring_availability
    // Idempotency: a double-clicked "Add hours" must not create two identical
    // rules. Soft-delete any existing duplicates (keep the oldest), then
    // enforce uniqueness.
    this.addSql(`update "recurring_availability" set "deleted_at" = now() where "id" in (
      select "id" from (
        select "id", row_number() over (
          partition by "provider_id", "day_of_week", "start_time", "end_time", "effective_from"
          order by "created_at", "id"
        ) as rn
        from "recurring_availability" where "deleted_at" is null
      ) t where t.rn > 1
    );`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recurring_availability_window_unique" ON "recurring_availability" ("provider_id", "day_of_week", "start_time", "end_time", "effective_from") WHERE deleted_at IS NULL;`);

    // ---------------------------------------------------- availability_exception
    this.addSql(`update "availability_exception" set "deleted_at" = now() where "id" in (
      select "id" from (
        select "id", row_number() over (
          partition by "provider_id", "date", "type", coalesce("start_time", ''), coalesce("end_time", '')
          order by "created_at", "id"
        ) as rn
        from "availability_exception" where "deleted_at" is null
      ) t where t.rn > 1
    );`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_availability_exception_entry_unique" ON "availability_exception" ("provider_id", "date", "type", (coalesce("start_time", '')), (coalesce("end_time", ''))) WHERE deleted_at IS NULL;`);

    // -------------------------------------------------------------- appointment
    this.addSql(`alter table if exists "appointment" add column if not exists "buffer_before_minutes" integer not null default 0;`);
    this.addSql(`alter table if exists "appointment" add column if not exists "buffer_after_minutes" integer not null default 0;`);
    this.addSql(`alter table if exists "appointment" add column if not exists "block_start" timestamptz null;`);
    this.addSql(`alter table if exists "appointment" add column if not exists "block_end" timestamptz null;`);
    this.addSql(`alter table if exists "appointment" add column if not exists "resource_timezone" text null;`);

    // Trigger first, then backfill (the backfill UPDATE fires it and fills the
    // block range for every existing row).
    this.addSql(`
      CREATE OR REPLACE FUNCTION appointment_set_block_range() RETURNS trigger AS $$
      BEGIN
        NEW.block_start := NEW.start_time - make_interval(mins => COALESCE(NEW.buffer_before_minutes, 0));
        NEW.block_end   := NEW.end_time   + make_interval(mins => COALESCE(NEW.buffer_after_minutes, 0));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    this.addSql(`DROP TRIGGER IF EXISTS appointment_set_block_range_trg ON "appointment";`);
    this.addSql(`
      CREATE TRIGGER appointment_set_block_range_trg
      BEFORE INSERT OR UPDATE ON "appointment"
      FOR EACH ROW EXECUTE FUNCTION appointment_set_block_range();
    `);
    this.addSql(`update "appointment" set "buffer_before_minutes" = "buffer_before_minutes";`);

    // Rebuild the overlap guard on the buffered range. A NULL bound would make
    // tstzrange unbounded (and block everything), so the columns are NOT NULL;
    // the BEFORE trigger always fills them before the constraint is checked.
    this.addSql(`alter table if exists "appointment" alter column "block_start" set not null;`);
    this.addSql(`alter table if exists "appointment" alter column "block_end" set not null;`);
    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_no_overlap";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "time_range";`);
    this.addSql(`alter table if exists "appointment" add column "time_range" tstzrange GENERATED ALWAYS AS (tstzrange(block_start, block_end, '[)')) STORED;`);
    this.addSql(`alter table if exists "appointment" add constraint "appointment_no_overlap" EXCLUDE USING gist (provider_id WITH =, time_range WITH &&) WHERE (status != 'cancelled' AND deleted_at IS NULL);`);
    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_times_check";`);
    this.addSql(`alter table if exists "appointment" add constraint "appointment_times_check" check (end_time > start_time and max_capacity >= 1);`);

    // -------------------------------------------------------- appointment_attendee
    this.addSql(`alter table if exists "appointment_attendee" alter column "customer_id" drop not null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "buyer_name" text null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "buyer_email" text null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "buyer_phone" text null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "notes" text null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "expires_at" timestamptz null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "confirmation_sent_at" timestamptz null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "cancelled_at" timestamptz null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "cancelled_by" text check ("cancelled_by" in ('buyer', 'vendor', 'admin', 'system')) null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "cancel_reason" text null;`);

    this.addSql(`alter table if exists "appointment_attendee" drop constraint if exists "appointment_attendee_appointment_id_customer_id_unique";`);
    this.addSql(`drop index if exists "IDX_appointment_attendee_appointment_id_customer_id_unique";`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_appointment_attendee_active_customer_unique" ON "appointment_attendee" ("appointment_id", "customer_id") WHERE deleted_at IS NULL AND status <> 'cancelled' AND customer_id IS NOT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_attendee_customer_id" ON "appointment_attendee" ("customer_id") WHERE deleted_at IS NULL;`);
    // Hold-expiry job: only reserved rows with an expiry are ever scanned.
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_attendee_reserved_expires_at" ON "appointment_attendee" ("expires_at") WHERE status = 'reserved' AND deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_attendee_order_id" ON "appointment_attendee" ("order_id") WHERE deleted_at IS NULL;`);

    // ------------------------------------------------------------ pricing_rule
    this.addSql(`create table if not exists "pricing_rule" ("id" text not null, "vendor_id" text not null, "resource_id" text null, "product_id" text null, "name" text not null, "type" text check ("type" in ('percent_adjust', 'fixed_adjust', 'override_price')) not null, "value" real not null, "currency_code" text null, "days_of_week" jsonb null, "start_time" text null, "end_time" text null, "valid_from" timestamptz null, "valid_until" timestamptz null, "priority" integer not null default 0, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pricing_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pricing_rule_deleted_at" ON "pricing_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pricing_rule_vendor_id_resource_id" ON "pricing_rule" ("vendor_id", "resource_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pricing_rule" cascade;`);

    this.addSql(`drop index if exists "IDX_appointment_attendee_order_id";`);
    this.addSql(`drop index if exists "IDX_appointment_attendee_reserved_expires_at";`);
    this.addSql(`drop index if exists "IDX_appointment_attendee_customer_id";`);
    this.addSql(`drop index if exists "IDX_appointment_attendee_active_customer_unique";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "cancel_reason";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "cancelled_by";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "cancelled_at";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "confirmation_sent_at";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "expires_at";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "notes";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "buyer_phone";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "buyer_email";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "buyer_name";`);
    // customer_id stays nullable and the old unique index is not restored:
    // either could fail on data written after the up() migration.

    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_times_check";`);
    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_no_overlap";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "time_range";`);
    this.addSql(`alter table if exists "appointment" add column "time_range" tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;`);
    this.addSql(`alter table if exists "appointment" add constraint "appointment_no_overlap" EXCLUDE USING gist (provider_id WITH =, time_range WITH &&) WHERE (status != 'cancelled' AND deleted_at IS NULL);`);
    this.addSql(`DROP TRIGGER IF EXISTS appointment_set_block_range_trg ON "appointment";`);
    this.addSql(`DROP FUNCTION IF EXISTS appointment_set_block_range();`);
    this.addSql(`alter table if exists "appointment" drop column if exists "resource_timezone";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "block_end";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "block_start";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "buffer_after_minutes";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "buffer_before_minutes";`);

    this.addSql(`drop index if exists "IDX_availability_exception_entry_unique";`);
    this.addSql(`drop index if exists "IDX_recurring_availability_window_unique";`);

    this.addSql(`drop index if exists "IDX_service_provider_service_product_id";`);
    this.addSql(`alter table if exists "service_provider" drop column if exists "capacity";`);
    this.addSql(`alter table if exists "service_provider" drop column if exists "duration_minutes";`);

    this.addSql(`alter table if exists "provider" drop constraint if exists "provider_settings_check";`);
    this.addSql(`drop index if exists "IDX_provider_vendor_id_display_name_unique";`);
    this.addSql(`drop index if exists "IDX_provider_vendor_id";`);
    this.addSql(`alter table if exists "provider" drop column if exists "cancellation_window_hours";`);
    this.addSql(`alter table if exists "provider" drop column if exists "hold_minutes";`);
    this.addSql(`alter table if exists "provider" drop column if exists "max_advance_days";`);
    this.addSql(`alter table if exists "provider" drop column if exists "min_notice_minutes";`);
    this.addSql(`alter table if exists "provider" drop column if exists "buffer_after_minutes";`);
    this.addSql(`alter table if exists "provider" drop column if exists "buffer_before_minutes";`);
    this.addSql(`alter table if exists "provider" drop column if exists "capacity";`);
    this.addSql(`alter table if exists "provider" drop column if exists "slot_step_minutes";`);
    this.addSql(`alter table if exists "provider" drop column if exists "session_duration_minutes";`);
    this.addSql(`alter table if exists "provider" drop column if exists "kind";`);
    this.addSql(`alter table if exists "provider" drop column if exists "image_url";`);
    this.addSql(`alter table if exists "provider" drop column if exists "description";`);
    this.addSql(`alter table if exists "provider" drop column if exists "vendor_id";`);
    // vendor_admin_id stays nullable and its unique index is not restored: it
    // would fail as soon as one admin owns more than one resource.
  }

}
