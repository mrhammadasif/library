-- CreateTable
CREATE TABLE "google_books_usage" (
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "google_books_usage_pkey" PRIMARY KEY ("day")
);
