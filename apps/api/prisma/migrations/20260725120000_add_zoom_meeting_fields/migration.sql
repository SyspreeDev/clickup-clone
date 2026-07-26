-- Add Zoom auto-created meeting fields
ALTER TABLE "Meeting" ADD COLUMN "zoomMeetingId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "zoomJoinUrl" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "zoomStartUrl" TEXT;
