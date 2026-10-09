-- ============================================
-- Physical Device & NFC Card System
-- ============================================

-- Devices table: tracks registered ESP32 devices
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL UNIQUE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'maintenance')),
  firmware_version TEXT,
  hardware_version TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFC cards table: maps NFC card -> User -> Auction
CREATE TABLE public.nfc_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nfc_uid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nfc_uid, auction_id)
);

-- Device sessions table: audit trail for device usage
CREATE TABLE public.device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
  nfc_uid TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired'))
);

-- Indexes
CREATE INDEX idx_devices_status ON public.devices(status);
CREATE INDEX idx_devices_device_id ON public.devices(device_id);
CREATE INDEX idx_nfc_cards_nfc_uid ON public.nfc_cards(nfc_uid);
CREATE INDEX idx_nfc_cards_user_id ON public.nfc_cards(user_id);
CREATE INDEX idx_nfc_cards_auction_id ON public.nfc_cards(auction_id);
CREATE INDEX idx_device_sessions_device_id ON public.device_sessions(device_id);
CREATE INDEX idx_device_sessions_auction_id ON public.device_sessions(auction_id);
CREATE INDEX idx_device_sessions_status ON public.device_sessions(status);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for devices
CREATE POLICY "Admin roles can view devices"
  ON public.devices FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can insert devices"
  ON public.devices FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin roles can update devices"
  ON public.devices FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can delete devices"
  ON public.devices FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- RLS Policies for nfc_cards
CREATE POLICY "Admin roles can view nfc_cards"
  ON public.nfc_cards FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can insert nfc_cards"
  ON public.nfc_cards FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin roles can update nfc_cards"
  ON public.nfc_cards FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can delete nfc_cards"
  ON public.nfc_cards FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- RLS Policies for device_sessions
CREATE POLICY "Admin roles can view device_sessions"
  ON public.device_sessions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin roles can manage device_sessions"
  ON public.device_sessions FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

-- Seed manage_devices permission
INSERT INTO public.permissions (key, name, description, group_name) VALUES
  ('manage_devices', 'Manage Devices', 'Manage physical devices and NFC card mappings', 'Devices')
ON CONFLICT (key) DO NOTHING;

-- Grant manage_devices to moderator and admin roles
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'moderator'::user_role, p.id FROM public.permissions p WHERE p.key = 'manage_devices'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::user_role, p.id FROM public.permissions p WHERE p.key = 'manage_devices'
ON CONFLICT (role, permission_id) DO NOTHING;
