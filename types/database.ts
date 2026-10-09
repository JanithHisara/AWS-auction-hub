export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin'
export type GemStatus = 'draft' | 'pending' | 'active' | 'ended' | 'completed'
export type AuctionStatus = 'draft' | 'upcoming' | 'registration_open' | 'registration_closed' | 'live' | 'ended' | 'completed'
export type AuctionType = 'progressive_elimination_auction' | 'tender_base_fixed_bid' | 'incremental_approval_auction'
export type PaymentStatus = 'pending' | 'completed' | 'failed'
export type RegistrationApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
  anonymous_name?: string; display_name?: string | null;
  phone?: string | null

}

// New: Auction (parent container)
export interface Auction {
  id: string
  admin_id: string
  moderator_id?: string | null
  name: string
  description: string | null
  banner_image_url: string | null
    password: string | null
  
  // Timing
  registration_start: string
  registration_end: string
  auction_start: string
  auction_end: string
  
  // Settings
  status: AuctionStatus
  auction_type: AuctionType
  max_participants: number | null
  entry_fee: number
  
  // Metadata
  created_at: string
  published_at: string | null
  
  // Computed/joined fields
  items_count?: number
  registered_count?: number
  is_registered?: boolean
}

// New: Auction Registration with secure token
export interface AuctionRegistration {
  id: string
  auction_id: string
  user_id: string
  access_token: string
  registered_at: string
  email_sent_at: string | null
  first_access_at: string | null
  last_access_at: string | null
  access_count: number
  is_active: boolean
  approval_status: RegistrationApprovalStatus
  approved_at: string | null
  approved_by: string | null
  
  // Joined
  auction?: Auction
  user?: User
}

// Gem (auction item) - now belongs to an auction
export interface Gem {
  id: string
  auction_id: string | null
  admin_id: string
  moderator_id?: string | null
  name: string
  description: string
  starting_price: number
  min_bid_increment: number
  start_time: string
  end_time: string
  status: GemStatus
  carat_weight: number | null
  cut: string | null
  color: string | null
  clarity: string | null
  provenance: string | null
  created_at: string
  published_at: string | null
  current_price: number
  round_end_time: string | null
  increment_interval: number
  
  // Computed
  current_bid?: number
  bid_count?: number
  images?: GemImage[]
}

export type MediaType = 'image' | 'gif' | 'video'

export interface GemImage {
  id: string
  gem_id: string
  image_url: string
  display_order: number
  media_type: MediaType
  created_at: string
}

export interface GemCertificate {
  id: string
  gem_id: string
  certificate_url: string
  certificate_type: string | null
  created_at: string
}

export interface Bid {
  id: string
  gem_id: string
  user_id: string
  bid_amount: number
  points_earned: number
  created_at: string
  user?: {
    email: string
    anonymous_name?: string; display_name?: string | null;
  }
}

export interface Payment {
  id: string
  gem_id: string
  user_id: string
  bid_id: string
  amount: number
  status: PaymentStatus
  payment_method: string | null
  transaction_id: string | null
  created_at: string
}

export interface AuctionWinner {
  id: string
  gem_id: string
  user_id: string
  winning_bid_id: string
  selected_at: string
  admin_id: string
  moderator_id?: string | null
}

// New: User Rewards/Engagement
export interface UserRewards {
  id: string
  user_id: string
  total_points: number
  current_streak: number
  longest_streak: number
  badges: Badge[]
  auctions_participated: number
  total_bids_placed: number
  auctions_won: number
  last_bid_at: string | null
  created_at: string
  updated_at: string
}

export interface Badge {
  id: string
  name: string
  icon: string
  description: string
  earned_at: string
}

export interface BidderHold {
  id: string
  auction_id: string
  user_id: string
  admin_id: string
  moderator_id?: string | null
  reason: string | null
  held_at: string
  released_at: string | null
  is_active: boolean
  user?: User
  admin?: User
}

export interface GemElimination {
  id: string
  gem_id: string
  user_id: string
  eliminated_at: string
  eliminated_at_price: number
}

// Chat
export type ChatConversationStatus = 'open' | 'active' | 'waiting' | 'resolved'

export interface ChatConversation {
  id: string
  auction_id: string
  user_id: string
  assigned_admin_id: string
  moderator_id?: string | null | null
  status: ChatConversationStatus
  created_at: string
  last_message_at: string
  unread_by_user: number
  unread_by_admin: number
  user?: User
  assigned_admin?: User
  last_message?: ChatMessage
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_role: 'user' | 'admin'
  content: string
  created_at: string
  sender?: User
}

// Utility types for API responses
export interface AuctionWithItems extends Auction {
  items: Gem[]
}

export interface AuctionAccessPayload {
  auction_id: string
  user_id: string
  access_token: string
}

// RBAC
export interface Permission {
  id: string
  key: string
  name: string
  description: string
  group_name: string
  created_at: string
}

export interface RolePermission {
  id: string
  role: UserRole
  permission_id: string
  created_at: string
  permission?: Permission
}





