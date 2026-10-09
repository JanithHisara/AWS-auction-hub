# Auction Platform

A premium auction platform built with Next.js, Supabase, and AWS SST. Features real-time bidding, admin management, and a luxury casino-inspired UI.

## Features

- **User Authentication**: Registration, login, and role-based access (user/admin)
- **Admin Dashboard**: Create, manage, and publish listings
- **Real-time Bidding**: Live bid updates using Supabase Realtime
- **Auction Management**: Time-limited auctions with countdown timers
- **Payment Processing**: Dummy payment gateway for winning bidders
- **Responsive Design**: Luxury/casino aesthetic with gold accents

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Deployment**: AWS via SST

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Supabase account
- AWS account (for deployment)

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the SQL schema from `supabase/schema.sql` in the Supabase SQL Editor
3. Get your Supabase URL and anon key from Project Settings > API

### 4. Configure Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Create Admin User

1. Register a new user account
2. In Supabase Dashboard, go to Authentication > Users
3. Edit the user and update the `users` table to set `role = 'admin'`

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── admin/             # Admin dashboard pages
│   ├── api/               # API routes
│   ├── gems/              # Public detail pages
│   └── ...
├── components/            # React components
│   ├── admin/             # Admin-specific components
│   ├── auctions/          # Auction-related components
│   ├── auth/              # Authentication components
│   └── ...
├── lib/                   # Utility functions
│   ├── supabase/          # Supabase client setup
│   └── ...
├── types/                 # TypeScript type definitions
└── supabase/              # Database schema
```

## Key Features Implementation

### Real-time Updates

The platform uses Supabase Realtime to provide live bid updates. When a user places a bid, all viewers see the update instantly without page refresh.

### Auction Status Management

- **Draft**: Gem created but not published
- **Active**: Published and accepting bids
- **Ended**: Auction time expired, awaiting winner selection
- **Completed**: Winner selected and payment processed

### Admin Workflow

1. Create listing with all details
2. Publish to make it active
3. Monitor bids in real-time
4. After auction ends, manually select winner
5. Winner completes payment

## Deployment

### Deploy to AWS with SST

1. Install SST CLI:
```bash
npm install -g sst
```

2. Configure AWS credentials

3. Deploy:
```bash
npm run deploy
```

### Environment Variables for Production

Set these in your SST config or AWS environment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## API Endpoints

- `GET /api/gems` - List gems (with optional status filter)
- `POST /api/gems` - Create new gem (admin only)
- `GET /api/gems/[id]` - Get gem details
- `PUT /api/gems/[id]` - Update gem (admin only)
- `PATCH /api/gems/[id]` - Update gem status (admin only)
- `POST /api/gems/[id]/bids` - Place a bid
- `GET /api/gems/[id]/bids` - Get bid history
- `POST /api/admin/auctions/[id]/select-winner` - Select auction winner (admin only)
- `POST /api/payments` - Process payment (dummy gateway)

## Database Schema

See `supabase/schema.sql` for the complete database schema including:
- Users (extends Supabase auth)
- Gems
- Bids
- Payments
- Auction Winners
- Gem Images & Certificates

## Security

- Row Level Security (RLS) policies on all tables
- Role-based access control for admin routes
- Protected API routes with authentication middleware
- Bid validation (amount, timing, authentication)

## License

MIT
