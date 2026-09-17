import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260915190806 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "rental_configuration" add column if not exists "rental_unit" text check ("rental_unit" in ('hour', 'day', 'week', 'month', 'custom')) not null default 'day', add column if not exists "min_rental_units" integer not null default 1, add column if not exists "max_rental_units" integer null, add column if not exists "security_deposit_amount" numeric not null default 0, add column if not exists "security_deposit_type" text check ("security_deposit_type" in ('fixed', 'percentage')) not null default 'fixed', add column if not exists "requires_time_selection" boolean not null default false, add column if not exists "raw_security_deposit_amount" jsonb not null default '{"value":"0","precision":20}';`);

    this.addSql(`alter table if exists "rental" add column if not exists "rental_unit" text check ("rental_unit" in ('hour', 'day', 'week', 'month', 'custom')) not null default 'day', add column if not exists "rental_units_count" integer null, add column if not exists "pickup_time" text null, add column if not exists "return_time" text null, add column if not exists "security_deposit_amount" numeric not null default 0, add column if not exists "security_deposit_status" text check ("security_deposit_status" in ('held', 'refunded', 'partially_refunded', 'forfeited')) null, add column if not exists "raw_security_deposit_amount" jsonb not null default '{"value":"0","precision":20}';`);

    // Backfill: mirror the legacy day-only columns into the new generic
    // unit columns so every pre-existing rental_configuration row behaves
    // identically to before this migration. rental_unit already defaults to
    // 'day' above, so only the min/max values need copying across.
    this.addSql(`update "rental_configuration" set "min_rental_units" = "min_rental_days", "max_rental_units" = "max_rental_days";`);

    // Same idea for existing Rental (booking) rows: rental_units_count
    // mirrors rental_days so unit-aware code reading the new column sees
    // the same quantity the old day-only code already recorded.
    this.addSql(`update "rental" set "rental_units_count" = "rental_days" where "rental_units_count" is null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "rental_configuration" drop column if exists "rental_unit", drop column if exists "min_rental_units", drop column if exists "max_rental_units", drop column if exists "security_deposit_amount", drop column if exists "security_deposit_type", drop column if exists "requires_time_selection", drop column if exists "raw_security_deposit_amount";`);

    this.addSql(`alter table if exists "rental" drop column if exists "rental_unit", drop column if exists "rental_units_count", drop column if exists "pickup_time", drop column if exists "return_time", drop column if exists "security_deposit_amount", drop column if exists "security_deposit_status", drop column if exists "raw_security_deposit_amount";`);
  }

}
