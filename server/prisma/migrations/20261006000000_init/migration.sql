-- Hand-written: extensions Prisma can't declare.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "library_role" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "library_permission" AS ENUM ('books.add', 'books.edit', 'books.move', 'loans.manage', 'books.archive', 'books.delete', 'shelves.manage', 'audits.run', 'members.manage', 'ai.manage');

-- CreateEnum
CREATE TYPE "book_status" AS ENUM ('on_shelf', 'borrowed', 'missing', 'archived');

-- CreateEnum
CREATE TYPE "audit_mode" AS ENUM ('random', 'shelf');

-- CreateEnum
CREATE TYPE "audit_result" AS ENUM ('pending', 'found', 'missing', 'misplaced', 'unexpected');

-- CreateEnum
CREATE TYPE "ai_provider" AS ENUM ('openai', 'gemini', 'openai_compatible');

-- CreateEnum
CREATE TYPE "color_name" AS ENUM ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'grey', 'multi');

-- CreateEnum
CREATE TYPE "book_event_type" AS ENUM ('created', 'moved', 'lent', 'returned', 'archived', 'restored', 'audited', 'marked_missing');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "public_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL,
    "transports" TEXT,
    "aaguid" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libraries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_by" UUID,
    "enrich_provider" "ai_provider",
    "vision_provider" "ai_provider",
    "home_ai_allowed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_members" (
    "library_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "library_role" NOT NULL DEFAULT 'member',
    "permissions" "library_permission"[] DEFAULT ARRAY[]::"library_permission"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_members_pkey" PRIMARY KEY ("library_id","user_id")
);

-- CreateTable
CREATE TABLE "library_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "permissions" "library_permission"[] DEFAULT ARRAY[]::"library_permission"[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "racks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "racks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "rack_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "isbn13" TEXT,
    "isbn10" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authors_text" TEXT NOT NULL DEFAULT '',
    "publisher" TEXT,
    "published_year" INTEGER,
    "pages" INTEGER,
    "language" TEXT,
    "description" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cover_path" TEXT,
    "cover_url" TEXT,
    "dominant_color" TEXT,
    "color_name" "color_name",
    "condition" TEXT,
    "notes" TEXT,
    "status" "book_status" NOT NULL DEFAULT 'on_shelf',
    "shelf_id" UUID,
    "archived_at" TIMESTAMP(3),
    "archive_reason" TEXT,
    "donated_to" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "borrower_user_id" UUID,
    "borrower_name" TEXT NOT NULL,
    "borrower_contact" TEXT,
    "notes" TEXT,
    "lent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "return_shelf_id" UUID,
    "lent_by" UUID,
    "returned_by" UUID,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_events" (
    "id" BIGSERIAL NOT NULL,
    "library_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "type" "book_event_type" NOT NULL,
    "from_shelf_id" UUID,
    "to_shelf_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "mode" "audit_mode" NOT NULL,
    "shelf_id" UUID,
    "sample_size" INTEGER,
    "started_by" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "book_id" UUID,
    "expected_shelf_id" UUID,
    "found_shelf_id" UUID,
    "scanned_isbn" TEXT,
    "result" "audit_result" NOT NULL DEFAULT 'pending',
    "checked_at" TIMESTAMP(3),
    "checked_by" UUID,

    CONSTRAINT "audit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_ai_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "library_id" UUID NOT NULL,
    "provider" "ai_provider" NOT NULL,
    "model" TEXT NOT NULL,
    "base_url" TEXT,
    "key_ciphertext" TEXT NOT NULL,
    "key_iv" TEXT NOT NULL,
    "key_tag" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "supports_vision" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "rate_limit"("key");

-- CreateIndex
CREATE INDEX "passkey_user_id_idx" ON "passkey"("user_id");

-- CreateIndex
CREATE INDEX "passkey_credential_id_idx" ON "passkey"("credential_id");

-- CreateIndex
CREATE INDEX "library_members_user_id_idx" ON "library_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_invites_code_key" ON "library_invites"("code");

-- CreateIndex
CREATE INDEX "library_invites_library_id_idx" ON "library_invites"("library_id");

-- CreateIndex
CREATE INDEX "racks_library_id_position_idx" ON "racks"("library_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "racks_id_library_id_key" ON "racks"("id", "library_id");

-- CreateIndex
CREATE INDEX "shelves_rack_id_position_idx" ON "shelves"("rack_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "shelves_id_library_id_key" ON "shelves"("id", "library_id");

-- CreateIndex
CREATE INDEX "books_library_id_status_idx" ON "books"("library_id", "status");

-- CreateIndex
CREATE INDEX "books_shelf_id_idx" ON "books"("shelf_id");

-- CreateIndex
CREATE INDEX "books_library_id_isbn13_idx" ON "books"("library_id", "isbn13");

-- CreateIndex
CREATE INDEX "books_tags_idx" ON "books" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "books_title_trgm_idx" ON "books" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "books_authors_trgm_idx" ON "books" USING GIN ("authors_text" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "books_id_library_id_key" ON "books"("id", "library_id");

-- CreateIndex
CREATE INDEX "loans_library_open_idx" ON "loans"("library_id") WHERE (returned_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "loans_one_open_per_book" ON "loans"("book_id") WHERE (returned_at IS NULL);

-- CreateIndex
CREATE INDEX "book_events_book_id_at_idx" ON "book_events"("book_id", "at" DESC);

-- CreateIndex
CREATE INDEX "book_events_library_id_at_idx" ON "book_events"("library_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audits_library_id_started_at_idx" ON "audits"("library_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "audits_id_library_id_key" ON "audits"("id", "library_id");

-- CreateIndex
CREATE INDEX "audit_items_audit_id_idx" ON "audit_items"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_items_book_once" ON "audit_items"("audit_id", "book_id") WHERE (book_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "library_ai_providers_library_id_provider_key" ON "library_ai_providers"("library_id", "provider");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_invites" ADD CONSTRAINT "library_invites_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "racks" ADD CONSTRAINT "racks_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_rack_id_library_id_fkey" FOREIGN KEY ("rack_id", "library_id") REFERENCES "racks"("id", "library_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_shelf_id_library_id_fkey" FOREIGN KEY ("shelf_id", "library_id") REFERENCES "shelves"("id", "library_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_book_id_library_id_fkey" FOREIGN KEY ("book_id", "library_id") REFERENCES "books"("id", "library_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_events" ADD CONSTRAINT "book_events_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_events" ADD CONSTRAINT "book_events_book_id_library_id_fkey" FOREIGN KEY ("book_id", "library_id") REFERENCES "books"("id", "library_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_items" ADD CONSTRAINT "audit_items_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_items" ADD CONSTRAINT "audit_items_audit_id_library_id_fkey" FOREIGN KEY ("audit_id", "library_id") REFERENCES "audits"("id", "library_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_items" ADD CONSTRAINT "audit_items_book_id_library_id_fkey" FOREIGN KEY ("book_id", "library_id") REFERENCES "books"("id", "library_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_ai_providers" ADD CONSTRAINT "library_ai_providers_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: CHECK constraints (Prisma doesn't model them; it leaves them alone in later diffs).
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_name_check" CHECK (length(trim(name)) BETWEEN 1 AND 80);
ALTER TABLE "racks" ADD CONSTRAINT "racks_name_check" CHECK (length(trim(name)) BETWEEN 1 AND 60);
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_name_check" CHECK (length(trim(name)) BETWEEN 1 AND 60);
ALTER TABLE "library_invites" ADD CONSTRAINT "library_invites_max_uses_check" CHECK (max_uses BETWEEN 1 AND 100);
ALTER TABLE "books" ADD CONSTRAINT "books_isbn13_check" CHECK (isbn13 ~ '^97[89][0-9]{10}$');
ALTER TABLE "books" ADD CONSTRAINT "books_isbn10_check" CHECK (isbn10 ~ '^[0-9]{9}[0-9X]$');
ALTER TABLE "books" ADD CONSTRAINT "books_title_check" CHECK (length(trim(title)) BETWEEN 1 AND 500);
ALTER TABLE "books" ADD CONSTRAINT "books_published_year_check" CHECK (published_year BETWEEN 0 AND 2200);
ALTER TABLE "books" ADD CONSTRAINT "books_pages_check" CHECK (pages > 0);
ALTER TABLE "books" ADD CONSTRAINT "books_dominant_color_check" CHECK (dominant_color ~ '^#[0-9A-Fa-f]{6}$');
-- Archived books have no shelf; every other status keeps its home shelf.
ALTER TABLE "books" ADD CONSTRAINT "books_status_shelf_check" CHECK ((status = 'archived') = (shelf_id IS NULL));
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_name_check" CHECK (length(trim(borrower_name)) BETWEEN 1 AND 120);
ALTER TABLE "library_ai_providers" ADD CONSTRAINT "library_ai_providers_model_check" CHECK (length(trim(model)) BETWEEN 1 AND 200);
ALTER TABLE "library_ai_providers" ADD CONSTRAINT "library_ai_providers_base_url_check"
  CHECK (base_url IS NULL OR base_url ~ '^https?://');
ALTER TABLE "library_ai_providers" ADD CONSTRAINT "library_ai_providers_compatible_url_check"
  CHECK (provider <> 'openai_compatible' OR base_url IS NOT NULL);
