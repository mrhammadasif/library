-- CreateTable
CREATE TABLE "library_daily_usage" (
    "library_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "library_daily_usage_pkey" PRIMARY KEY ("library_id","day","kind")
);

-- AddForeignKey
ALTER TABLE "library_daily_usage" ADD CONSTRAINT "library_daily_usage_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
