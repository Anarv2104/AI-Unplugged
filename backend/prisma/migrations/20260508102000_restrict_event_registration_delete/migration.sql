-- Drop the invalid foreign key that attempted to SET NULL on a required column.
ALTER TABLE "EventRegistration"
DROP CONSTRAINT "EventRegistration_eventId_fkey";

-- Recreate the relation so event deletes are blocked while registrations exist.
ALTER TABLE "EventRegistration"
ADD CONSTRAINT "EventRegistration_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
