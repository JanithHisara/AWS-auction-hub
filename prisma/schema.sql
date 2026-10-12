-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "anonymous_name" TEXT,
    "display_name" TEXT,
    "phone" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auctions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "moderator_id" UUID,
    "name" TEXT NOT NULL,
    "auction_code" TEXT,
    "description" TEXT,
    "banner_image_url" TEXT,
    "password" TEXT,
    "registration_start" TIMESTAMP(3) NOT NULL,
    "registration_end" TIMESTAMP(3) NOT NULL,
    "auction_start" TIMESTAMP(3) NOT NULL,
    "auction_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "auction_type" TEXT NOT NULL DEFAULT 'tender_base_fixed_bid',
    "max_participants" INTEGER,
    "entry_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_registrations" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_sent_at" TIMESTAMP(3),
    "first_access_at" TIMESTAMP(3),
    "last_access_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,

    CONSTRAINT "auction_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gems" (
    "id" UUID NOT NULL,
    "auction_id" UUID,
    "admin_id" UUID NOT NULL,
    "moderator_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starting_price" DECIMAL(12,2) NOT NULL,
    "min_bid_increment" DECIMAL(12,2) NOT NULL,
    "current_price" DECIMAL(12,2),
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "round_end_time" TIMESTAMP(3),
    "increment_interval" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "carat_weight" DECIMAL(8,2),
    "cut" TEXT,
    "color" TEXT,
    "clarity" TEXT,
    "provenance" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "gems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gem_images" (
    "id" UUID NOT NULL,
    "gem_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "media_type" TEXT NOT NULL DEFAULT 'image',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gem_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gem_certificates" (
    "id" UUID NOT NULL,
    "gem_id" UUID NOT NULL,
    "certificate_url" TEXT NOT NULL,
    "certificate_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gem_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "gem_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bid_amount" DECIMAL(12,2) NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "gem_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bid_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_method" TEXT,
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_winners" (
    "id" UUID NOT NULL,
    "gem_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "winning_bid_id" UUID NOT NULL,
    "selected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_id" UUID NOT NULL,
    "moderator_id" UUID,

    CONSTRAINT "auction_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidder_holds" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "moderator_id" UUID,
    "reason" TEXT,
    "held_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bidder_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gem_eliminations" (
    "id" UUID NOT NULL,
    "gem_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "eliminated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminated_at_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "gem_eliminations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rewards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "badges" JSONB DEFAULT '[]',
    "auctions_participated" INTEGER NOT NULL DEFAULT 0,
    "total_bids_placed" INTEGER NOT NULL DEFAULT 0,
    "auctions_won" INTEGER NOT NULL DEFAULT 0,
    "last_bid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_admin_id" UUID,
    "moderator_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread_by_user" INTEGER NOT NULL DEFAULT 0,
    "unread_by_admin" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "group_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "firmware_version" TEXT,
    "hardware_version" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfc_cards" (
    "id" UUID NOT NULL,
    "nfc_uid" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "auction_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfc_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "nfc_uid" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "auction_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_anonymous_name_key" ON "users"("anonymous_name");

-- CreateIndex
CREATE UNIQUE INDEX "auction_registrations_auction_id_user_id_key" ON "auction_registrations"("auction_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auction_winners_gem_id_key" ON "auction_winners"("gem_id");

-- CreateIndex
CREATE UNIQUE INDEX "auction_winners_winning_bid_id_key" ON "auction_winners"("winning_bid_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_rewards_user_id_key" ON "user_rewards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_id_key" ON "devices"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfc_cards_nfc_uid_auction_id_key" ON "nfc_cards"("nfc_uid", "auction_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_registrations" ADD CONSTRAINT "auction_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gems" ADD CONSTRAINT "gems_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gems" ADD CONSTRAINT "gems_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gem_images" ADD CONSTRAINT "gem_images_gem_id_fkey" FOREIGN KEY ("gem_id") REFERENCES "gems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gem_certificates" ADD CONSTRAINT "gem_certificates_gem_id_fkey" FOREIGN KEY ("gem_id") REFERENCES "gems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_gem_id_fkey" FOREIGN KEY ("gem_id") REFERENCES "gems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_gem_id_fkey" FOREIGN KEY ("gem_id") REFERENCES "gems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_winners" ADD CONSTRAINT "auction_winners_gem_id_fkey" FOREIGN KEY ("gem_id") REFERENCES "gems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_winners" ADD CONSTRAINT "auction_winners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_winners" ADD CONSTRAINT "auction_winners_winning_bid_id_fkey" FOREIGN KEY ("winning_bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_holds" ADD CONSTRAINT "bidder_holds_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_holds" ADD CONSTRAINT "bidder_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bidder_holds" ADD CONSTRAINT "bidder_holds_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gem_eliminations" ADD CONSTRAINT "gem_eliminations_gem_id_fkey" FOREIGN KEY ("gem_id") REFERENCES "gems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gem_eliminations" ADD CONSTRAINT "gem_eliminations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfc_cards" ADD CONSTRAINT "nfc_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfc_cards" ADD CONSTRAINT "nfc_cards_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed permissions
INSERT INTO "permissions" ("id", "key", "name", "description", "group_name") VALUES
  (gen_random_uuid(), 'view_dashboard', 'View Dashboard', 'Access admin dashboard and view statistics', 'Dashboard'),
  (gen_random_uuid(), 'manage_auctions', 'Manage Auctions', 'Create, edit, and control auction status', 'Auctions'),
  (gen_random_uuid(), 'manage_items', 'Manage Items', 'Create, edit, and publish items/gems', 'Items'),
  (gen_random_uuid(), 'manage_registrations', 'Manage Registrations', 'View and approve/reject auction registrations', 'Registrations'),
  (gen_random_uuid(), 'control_bidding', 'Control Bidding', 'Start/end bidding rounds, select winners, hold bidders', 'Bidding'),
  (gen_random_uuid(), 'manage_users', 'Manage Users', 'View user list and profiles', 'Users'),
  (gen_random_uuid(), 'assign_roles', 'Assign Roles', 'Assign roles (Moderator, Admin) to users', 'Users'),
  (gen_random_uuid(), 'manage_permissions', 'Manage Permissions', 'Edit role permissions for any role', 'Access Control'),
  (gen_random_uuid(), 'manage_chat', 'Manage Chat', 'View and respond to all chat conversations', 'Chat'),
  (gen_random_uuid(), 'upload_files', 'Upload Files', 'Upload images and files', 'Files'),
  (gen_random_uuid(), 'manage_devices', 'Manage Devices', 'Manage physical devices and NFC card mappings', 'Devices')
ON CONFLICT ("key") DO NOTHING;

-- Seed default role-permission assignments
INSERT INTO "role_permissions" ("id", "role", "permission_id")
SELECT gen_random_uuid(), 'admin', p."id" FROM "permissions" p
WHERE p."key" IN ('view_dashboard', 'manage_auctions', 'manage_items', 'manage_registrations', 'control_bidding', 'manage_users', 'manage_chat', 'upload_files', 'manage_devices')
ON CONFLICT ("role", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role", "permission_id")
SELECT gen_random_uuid(), 'moderator', p."id" FROM "permissions" p
WHERE p."key" IN ('view_dashboard', 'manage_registrations', 'manage_chat', 'manage_devices')
ON CONFLICT ("role", "permission_id") DO NOTHING;

