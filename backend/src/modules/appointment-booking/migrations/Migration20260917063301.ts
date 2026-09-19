import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260917063301 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "service_provider" drop constraint if exists "service_provider_provider_id_service_product_id_unique";`);
    this.addSql(`alter table if exists "appointment_attendee" drop constraint if exists "appointment_attendee_appointment_id_customer_id_unique";`);
    this.addSql(`alter table if exists "provider" drop constraint if exists "provider_vendor_admin_id_unique";`);
    this.addSql(`create table if not exists "provider" ("id" text not null, "vendor_admin_id" text not null, "display_name" text null, "bio" text null, "timezone" text not null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "provider_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_provider_vendor_admin_id_unique" ON "provider" ("vendor_admin_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_provider_deleted_at" ON "provider" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "availability_exception" ("id" text not null, "provider_id" text not null, "date" timestamptz not null, "type" text check ("type" in ('blackout', 'extra_hours')) not null, "start_time" text null, "end_time" text null, "reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "availability_exception_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_availability_exception_provider_id" ON "availability_exception" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_availability_exception_deleted_at" ON "availability_exception" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_availability_exception_provider_id_date" ON "availability_exception" ("provider_id", "date") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "appointment" ("id" text not null, "provider_id" text not null, "service_product_id" text not null, "service_variant_id" text null, "start_time" timestamptz not null, "end_time" timestamptz not null, "max_capacity" integer not null default 1, "status" text check ("status" in ('available', 'booked', 'cancelled', 'completed')) not null default 'available', "order_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "appointment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_provider_id" ON "appointment" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_deleted_at" ON "appointment" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_provider_id_start_time_end_time" ON "appointment" ("provider_id", "start_time", "end_time") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_order_id" ON "appointment" ("order_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "appointment_attendee" ("id" text not null, "appointment_id" text not null, "customer_id" text not null, "order_id" text null, "line_item_id" text null, "status" text check ("status" in ('reserved', 'confirmed', 'cancelled')) not null default 'reserved', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "appointment_attendee_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_attendee_appointment_id" ON "appointment_attendee" ("appointment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_attendee_deleted_at" ON "appointment_attendee" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_appointment_attendee_appointment_id_customer_id_unique" ON "appointment_attendee" ("appointment_id", "customer_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "recurring_availability" ("id" text not null, "provider_id" text not null, "day_of_week" integer not null, "start_time" text not null, "end_time" text not null, "effective_from" timestamptz not null, "effective_until" timestamptz null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "recurring_availability_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recurring_availability_provider_id" ON "recurring_availability" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recurring_availability_deleted_at" ON "recurring_availability" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recurring_availability_provider_id_day_of_week" ON "recurring_availability" ("provider_id", "day_of_week") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "service_provider" ("id" text not null, "provider_id" text not null, "service_product_id" text not null, "default_duration_minutes" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "service_provider_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_service_provider_provider_id" ON "service_provider" ("provider_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_service_provider_deleted_at" ON "service_provider" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_service_provider_provider_id_service_product_id_unique" ON "service_provider" ("provider_id", "service_product_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "availability_exception" add constraint "availability_exception_provider_id_foreign" foreign key ("provider_id") references "provider" ("id") on update cascade;`);

    this.addSql(`alter table if exists "appointment" add constraint "appointment_provider_id_foreign" foreign key ("provider_id") references "provider" ("id") on update cascade;`);

    this.addSql(`alter table if exists "appointment_attendee" add constraint "appointment_attendee_appointment_id_foreign" foreign key ("appointment_id") references "appointment" ("id") on update cascade;`);

    this.addSql(`alter table if exists "recurring_availability" add constraint "recurring_availability_provider_id_foreign" foreign key ("provider_id") references "provider" ("id") on update cascade;`);

    this.addSql(`alter table if exists "service_provider" add constraint "service_provider_provider_id_foreign" foreign key ("provider_id") references "provider" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "availability_exception" drop constraint if exists "availability_exception_provider_id_foreign";`);

    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_provider_id_foreign";`);

    this.addSql(`alter table if exists "recurring_availability" drop constraint if exists "recurring_availability_provider_id_foreign";`);

    this.addSql(`alter table if exists "service_provider" drop constraint if exists "service_provider_provider_id_foreign";`);

    this.addSql(`alter table if exists "appointment_attendee" drop constraint if exists "appointment_attendee_appointment_id_foreign";`);

    this.addSql(`drop table if exists "provider" cascade;`);

    this.addSql(`drop table if exists "availability_exception" cascade;`);

    this.addSql(`drop table if exists "appointment" cascade;`);

    this.addSql(`drop table if exists "appointment_attendee" cascade;`);

    this.addSql(`drop table if exists "recurring_availability" cascade;`);

    this.addSql(`drop table if exists "service_provider" cascade;`);
  }

}
