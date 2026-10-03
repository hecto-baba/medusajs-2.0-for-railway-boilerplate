import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002173258 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "eoi_configuration" rename column "product_id" to "variant_id";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "eoi_configuration" rename column "variant_id" to "product_id";`);
  }

}
