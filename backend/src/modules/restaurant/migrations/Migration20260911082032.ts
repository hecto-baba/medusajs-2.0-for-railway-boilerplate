import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260911082032 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "restaurant_admin" ("id" text not null, "user_id" text not null, "restaurant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "restaurant_admin_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_restaurant_admin_restaurant_id" ON "restaurant_admin" ("restaurant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_restaurant_admin_deleted_at" ON "restaurant_admin" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "restaurant_admin" add constraint "restaurant_admin_restaurant_id_foreign" foreign key ("restaurant_id") references "restaurant" ("id") on update cascade;`);

    this.addSql(`alter table if exists "restaurant" add column if not exists "handle" text null, add column if not exists "is_open" boolean null, add column if not exists "description" text null, add column if not exists "phone" text null, add column if not exists "email" text null, add column if not exists "address" text null, add column if not exists "image_url" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "restaurant_admin" cascade;`);

    this.addSql(`alter table if exists "restaurant" drop column if exists "handle", drop column if exists "is_open", drop column if exists "description", drop column if exists "phone", drop column if exists "email", drop column if exists "address", drop column if exists "image_url";`);
  }

}
