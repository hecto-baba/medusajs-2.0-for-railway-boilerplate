import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Hand-written, not generated: this is the fix for a real race condition
 * found by audit. The application-level check in
 * validate-appointment-availability.ts (count active attendees < max_capacity)
 * is only safe against a single writer - it does nothing to stop two
 * different carts, completing concurrently in two different transactions,
 * from both reading "capacity available" and both inserting an attendee.
 *
 * This trigger closes that gap the same way the appointment_no_overlap
 * exclusion constraint closes the double-booking gap: by making the
 * database itself the source of truth, not just the application code.
 *
 * It runs BEFORE INSERT OR UPDATE on appointment_attendee, locks the parent
 * appointment row (SELECT ... FOR UPDATE) so concurrent inserts for the same
 * appointment serialize against each other rather than racing, then counts
 * existing non-cancelled attendees and rejects the write if it would exceed
 * max_capacity. The FOR UPDATE lock is what makes this safe under
 * concurrency - without it, two transactions could each see a stale count
 * before either commits.
 */
export class Migration20260919090000_appointment_attendee_capacity extends Migration {

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
          AND id != NEW.id;

        IF active_count >= capacity THEN
          RAISE EXCEPTION 'appointment % is fully booked (capacity %)', NEW.appointment_id, capacity
            USING ERRCODE = 'check_violation';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    this.addSql(`
      DROP TRIGGER IF EXISTS appointment_attendee_capacity_check ON appointment_attendee;
    `);

    this.addSql(`
      CREATE TRIGGER appointment_attendee_capacity_check
      BEFORE INSERT OR UPDATE ON appointment_attendee
      FOR EACH ROW
      EXECUTE FUNCTION enforce_appointment_capacity();
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TRIGGER IF EXISTS appointment_attendee_capacity_check ON appointment_attendee;`);
    this.addSql(`DROP FUNCTION IF EXISTS enforce_appointment_capacity();`);
  }

}
