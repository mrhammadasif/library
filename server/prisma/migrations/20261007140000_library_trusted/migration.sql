-- Home AI (the server's own AI key) was removed: AI keys now come only from each library's own settings.
-- The admin flag stays, meaning "trusted: no daily allowances".
ALTER TABLE "libraries" RENAME COLUMN "home_ai_allowed" TO "trusted";
