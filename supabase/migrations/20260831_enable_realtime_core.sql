-- Enable realtime for gems and bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.gems;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
