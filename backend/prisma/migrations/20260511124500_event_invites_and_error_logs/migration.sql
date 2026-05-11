CREATE TABLE "EventInvite" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppErrorLog" (
  "id" TEXT NOT NULL,
  "route" TEXT,
  "method" TEXT,
  "statusCode" INTEGER,
  "safeMessage" TEXT,
  "internalMessage" TEXT,
  "stack" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EventRegistration" ADD COLUMN "waitlistReason" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "inviteId" TEXT;

CREATE UNIQUE INDEX "EventInvite_token_key" ON "EventInvite"("token");
CREATE UNIQUE INDEX "EventInvite_eventId_email_key" ON "EventInvite"("eventId", "email");
CREATE INDEX "EventInvite_eventId_idx" ON "EventInvite"("eventId");
CREATE INDEX "EventInvite_status_idx" ON "EventInvite"("status");
CREATE INDEX "AppErrorLog_createdAt_idx" ON "AppErrorLog"("createdAt");
CREATE INDEX "AppErrorLog_statusCode_idx" ON "AppErrorLog"("statusCode");

ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
