import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260919165728 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "enquiry" ("id" text not null, "product_id" text not null, "customer_id" text null, "customer_email" text not null, "message" text not null, "reply" text null, "status" text check ("status" in ('pending', 'responded', 'closed')) not null default 'pending', "responded_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "enquiry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_enquiry_deleted_at" ON "enquiry" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "enquiry" cascade;`);
  }

}
