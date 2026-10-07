-- Server-wide daily counters (the free AI tier's total across all libraries).
CREATE TABLE "server_daily_usage" (
    "day" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "server_daily_usage_pkey" PRIMARY KEY ("day","kind")
);
