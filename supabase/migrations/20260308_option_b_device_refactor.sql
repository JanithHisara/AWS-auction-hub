-- Option B refactor: device owns auction assignment, NFC card is user-only identifier

-- Add auction_id to devices table so each device knows which auction it serves
ALTER TABLE public.devices ADD COLUMN auction_id UUID REFERENCES public.auctions(id) ON DELETE SET NULL;
CREATE INDEX idx_devices_auction_id ON public.devices(auction_id);

-- Simplify nfc_cards: drop the composite unique constraint and add a simple one on nfc_uid
-- First, remove duplicate nfc_uid rows (keep most recently created)
DELETE FROM public.nfc_cards a USING public.nfc_cards b
WHERE a.nfc_uid = b.nfc_uid AND a.created_at < b.created_at;

-- Drop the old composite unique constraint
ALTER TABLE public.nfc_cards DROP CONSTRAINT IF EXISTS nfc_cards_nfc_uid_auction_id_key;

-- Add simple unique constraint on nfc_uid (one card = one user)
ALTER TABLE public.nfc_cards ADD CONSTRAINT nfc_cards_nfc_uid_key UNIQUE (nfc_uid);
