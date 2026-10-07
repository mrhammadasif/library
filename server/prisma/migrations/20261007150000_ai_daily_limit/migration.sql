-- Each library chooses how many AI requests a day its own key may make (null = no limit).
ALTER TABLE "libraries" ADD COLUMN "ai_daily_limit" INTEGER;
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_ai_daily_limit_check" CHECK ("ai_daily_limit" IS NULL OR "ai_daily_limit" > 0);
