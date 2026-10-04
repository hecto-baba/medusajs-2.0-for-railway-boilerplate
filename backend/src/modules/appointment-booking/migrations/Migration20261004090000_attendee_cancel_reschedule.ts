import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Hand-written. Adds what the cancel email and reschedule need on an attendee:
 * email idempotency markers and the reschedule history.
 *
 * The enum column is a plain text column with a check constraint, as Medusa
 * generates for model.enum().
 */
export class Migration20261004090000_attendee_cancel_reschedule extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "cancellation_sent_at" timestamptz null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "rescheduled_from_start" timestamptz null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "rescheduled_by" text check ("rescheduled_by" in ('buyer', 'vendor', 'admin', 'system')) null;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "reschedule_count" integer not null default 0;`);
    this.addSql(`alter table if exists "appointment_attendee" add column if not exists "reschedule_notified_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "reschedule_notified_at";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "reschedule_count";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "rescheduled_by";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "rescheduled_from_start";`);
    this.addSql(`alter table if exists "appointment_attendee" drop column if exists "cancellation_sent_at";`);
  }

}
