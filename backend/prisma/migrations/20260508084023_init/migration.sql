-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "newsletterSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishState" TEXT NOT NULL DEFAULT 'draft',
    "entry" TEXT NOT NULL DEFAULT 'application',
    "formId" TEXT,
    "date" TIMESTAMP(3),
    "location" TEXT,
    "mapAddress" TEXT,
    "mapLat" DOUBLE PRECISION,
    "mapLng" DOUBLE PRECISION,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventForm" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventTitle" TEXT,
    "formId" TEXT,
    "formTitle" TEXT,
    "answers" JSONB NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "organization" TEXT,
    "entryType" TEXT,
    "subscribedToNewsletter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeLeadApplication" (
    "id" TEXT NOT NULL,
    "formId" TEXT,
    "formTitle" TEXT,
    "answers" JSONB NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeLeadApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostApplication" (
    "id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "countryCode" TEXT,
    "phone" TEXT,
    "subject" TEXT,
    "venue" TEXT,
    "venueCapacity" INTEGER,
    "estimatedAudience" INTEGER,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "description" TEXT,
    "useCase" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "filePath" TEXT,
    "fileUrl" TEXT,
    "markdownContent" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'pending',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Update" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" JSONB,
    "bodyHtml" TEXT,
    "category" TEXT NOT NULL DEFAULT 'update',
    "commentMode" TEXT NOT NULL DEFAULT 'moderated',
    "publishState" TEXT NOT NULL DEFAULT 'draft',
    "authorName" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'general',
    "eventId" TEXT,
    "eventTitle" TEXT,
    "attachments" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "updateSlug" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceLabel" TEXT,
    "excerpt" TEXT,
    "body" JSONB,
    "bodyHtml" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "image" JSONB,
    "publishState" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "NewsletterCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',

    CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "Event_publishState_idx" ON "Event"("publishState");

-- CreateIndex
CREATE INDEX "EventForm_kind_isDefault_idx" ON "EventForm"("kind", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_registrationId_key" ON "EventRegistration"("registrationId");

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");

-- CreateIndex
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");

-- CreateIndex
CREATE INDEX "EventRegistration_reviewStatus_idx" ON "EventRegistration"("reviewStatus");

-- CreateIndex
CREATE INDEX "NodeLeadApplication_reviewStatus_idx" ON "NodeLeadApplication"("reviewStatus");

-- CreateIndex
CREATE INDEX "Skill_publishState_idx" ON "Skill"("publishState");

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Update_slug_key" ON "Update"("slug");

-- CreateIndex
CREATE INDEX "Update_publishState_idx" ON "Update"("publishState");

-- CreateIndex
CREATE INDEX "Update_slug_idx" ON "Update"("slug");

-- CreateIndex
CREATE INDEX "Comment_updateId_status_idx" ON "Comment"("updateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_slug_key" ON "Resource"("slug");

-- CreateIndex
CREATE INDEX "Resource_publishState_idx" ON "Resource"("publishState");

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("uid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("uid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "Update"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("uid") ON DELETE SET NULL ON UPDATE CASCADE;
