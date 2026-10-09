-- Add auction type enum
CREATE TYPE auction_type AS ENUM ('fixed_increment', 'variable_increment');

-- Add auction_type column to auctions table
ALTER TABLE public.auctions 
ADD COLUMN auction_type auction_type NOT NULL DEFAULT 'fixed_increment';

-- Add comment for clarity
COMMENT ON COLUMN public.auctions.auction_type IS 'fixed_increment: price increases at intervals, variable_increment: free-form bidding with min increment';
