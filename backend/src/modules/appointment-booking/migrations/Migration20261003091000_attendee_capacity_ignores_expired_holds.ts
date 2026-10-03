import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Hand-written. The capacity trigger (Migration20260919090000) counted every
 * non-cancelled attendee, including a "reserved" hold whose expires_at has
 * already passed but which the one-minute release job has not cancelled yet. The
 * availability engine treats such a hold as free (it is only a hold, and it has
 * lapsed), so for up to a minute a slot was OFFERED and then refused by the
 * trigger with "just taken".
 *
 * This replaces the function so a lapsed hold no longer counts against capacity,
 * matching what the engine shows. Confirmed attendees, and holds that have not
 * expired, count exactly as before. The trigger itself is unchanged - only the
 * function body it calls.
 */
export class Migration20261003091000_attendee_capacity_ignores_expired_holds extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      CREATE OR REPLACE FUNCTION enforce_appointment_capacity() RETURNS trigger AS $$
      DECLARE
        capacity integer;
        active_count integer;
      BEGIN
        IF NEW.status = 'cancelled' THEN
          RETURN NEW;
        END IF;

        SELECT max_capacity INTO capacity
        FROM appointment
        WHERE id = NEW.appointment_id
        FOR UPDATE;

        IF capacity IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT count(*) INTO active_count
        FROM appointment_attendee
        WHERE appointment_id = NEW.appointment_id
          AND status != 'cancelled'
          AND deleted_at IS NULL
          AND id != NEW.id
          AND NOT (status = 'reserved' AND expires_at IS NOT NULL AND expires_at <= now());

        IF active_count >= capacity THEN
          RAISE EXCEPTION 'appointment % is fully booked (capacity %)', NEW.appointment_id, capacity
            USING ERRCODE = 'check_violation';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      CREATE OR REPLACE FUNCTION enforce_appointment_capacity() RETURNS trigger AS $$
      DECLARE
        capacity integer;
        active_count integer;
      BEGIN
        IF NEW.status = 'cancelled' THEN
          RETURN NEW;
        END IF;

        SELECT max_capacity INTO capacity
        FROM appointment
        WHERE id = NEW.appointment_id
        FOR UPDATE;

        IF capacity IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT count(*) INTO active_count
        FROM appointment_attendee
        WHERE appointment_id = NEW.appointment_id
          AND status != 'cancelled'
          AND deleted_at IS NULL
          AND id != NEW.id;

        IF active_count >= capacity THEN
          RAISE EXCEPTION 'appointment % is fully booked (capacity %)', NEW.appointment_id, capacity
            USING ERRCODE = 'check_violation';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

}
