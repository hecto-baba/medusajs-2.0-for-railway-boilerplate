import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Hand-written, not generated: an EXCLUDE constraint isn't expressible via
 * model.define. This is the actual guarantee against double-booking - the
 * application-level lock + overlap check in the workflow layer is a fast,
 * friendly first line of defense, but this is what makes it impossible for
 * two overlapping non-cancelled appointments to exist for the same
 * provider, even if that application-level check is ever buggy or bypassed.
 */
export class Migration20260917063400_appointment_no_overlap extends Migration {

  override async up(): Promise<void> {
    this.addSql(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
    this.addSql(`alter table if exists "appointment" add column if not exists "time_range" tstzrange GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;`);
    this.addSql(`alter table if exists "appointment" add constraint "appointment_no_overlap" EXCLUDE USING gist (provider_id WITH =, time_range WITH &&) WHERE (status != 'cancelled' AND deleted_at IS NULL);`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_no_overlap";`);
    this.addSql(`alter table if exists "appointment" drop column if exists "time_range";`);
  }

}
