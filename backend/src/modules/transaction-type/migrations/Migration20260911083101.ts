import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260911083101 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "transaction_type" drop constraint if exists "transaction_type_code_unique";`);
    this.addSql(`create table if not exists "transaction_type" ("id" text not null, "name" text not null, "code" text not null, "description" text null, "icon_url" text null, "status" text check ("status" in ('draft', 'active', 'inactive', 'archived')) not null default 'draft', "rank" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transaction_type_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transaction_type_code_unique" ON "transaction_type" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_deleted_at" ON "transaction_type" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_rank" ON "transaction_type" ("rank") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_status" ON "transaction_type" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "transaction_type_activity" ("id" text not null, "action" text check ("action" in ('created', 'updated', 'deleted', 'restored', 'status_changed', 'reordered', 'imported')) not null, "actor_id" text null, "actor_email" text null, "previous_status" text null, "new_status" text null, "changes" jsonb null, "transaction_type_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "transaction_type_activity_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_activity_transaction_type_id" ON "transaction_type_activity" ("transaction_type_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_activity_deleted_at" ON "transaction_type_activity" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_activity_transaction_type_id_created_at" ON "transaction_type_activity" ("transaction_type_id", "created_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_transaction_type_activity_action" ON "transaction_type_activity" ("action") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "transaction_type_activity" add constraint "transaction_type_activity_transaction_type_id_foreign" foreign key ("transaction_type_id") references "transaction_type" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "transaction_type_activity" drop constraint if exists "transaction_type_activity_transaction_type_id_foreign";`);

    this.addSql(`drop table if exists "transaction_type" cascade;`);

    this.addSql(`drop table if exists "transaction_type_activity" cascade;`);
  }

}
