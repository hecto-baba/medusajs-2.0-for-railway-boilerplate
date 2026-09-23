import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260911082655 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "restaurant" alter column "handle" type text using ("handle"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "handle" set not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "is_open" type boolean using ("is_open"::boolean);`);
    this.addSql(`alter table if exists "restaurant" alter column "is_open" set default false;`);
    this.addSql(`alter table if exists "restaurant" alter column "is_open" set not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "phone" type text using ("phone"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "phone" set not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "email" type text using ("email"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "email" set not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "address" type text using ("address"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "address" set not null;`);

    this.addSql(`alter table if exists "restaurant_admin" add column if not exists "last_name" text not null, add column if not exists "email" text not null, add column if not exists "avatar_url" text null;`);
    this.addSql(`alter table if exists "restaurant_admin" rename column "user_id" to "first_name";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "restaurant" alter column "handle" type text using ("handle"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "handle" drop not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "is_open" drop default;`);
    this.addSql(`alter table if exists "restaurant" alter column "is_open" type boolean using ("is_open"::boolean);`);
    this.addSql(`alter table if exists "restaurant" alter column "is_open" drop not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "phone" type text using ("phone"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "phone" drop not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "email" type text using ("email"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "email" drop not null;`);
    this.addSql(`alter table if exists "restaurant" alter column "address" type text using ("address"::text);`);
    this.addSql(`alter table if exists "restaurant" alter column "address" drop not null;`);

    this.addSql(`alter table if exists "restaurant_admin" drop column if exists "last_name", drop column if exists "email", drop column if exists "avatar_url";`);

    this.addSql(`alter table if exists "restaurant_admin" rename column "first_name" to "user_id";`);
  }

}
