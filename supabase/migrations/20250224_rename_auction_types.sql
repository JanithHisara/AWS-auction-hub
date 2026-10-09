-- Rename auction type enum values to match new terminology
-- Fixed -> Progressive Elimination Auction
-- Free-Form -> Tender Base / Fixed Bid

ALTER TYPE auction_type RENAME VALUE 'fixed_increment' TO 'progressive_elimination_auction';
ALTER TYPE auction_type RENAME VALUE 'variable_increment' TO 'tender_base_fixed_bid';

-- Update column default
ALTER TABLE public.auctions ALTER COLUMN auction_type SET DEFAULT 'progressive_elimination_auction'::auction_type;

-- Update comment for clarity
COMMENT ON COLUMN public.auctions.auction_type IS 'progressive_elimination_auction: price increases at intervals, bidders accept or drop out; tender_base_fixed_bid: closed bids above minimum, highest bid wins';
