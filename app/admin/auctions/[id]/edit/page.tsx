'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ImageUploader from '@/components/gems/ImageUploader'
import { ArrowLeft, Loader2, Calendar, Image, Users, DollarSign, Gavel, TrendingUp, Target } from 'lucide-react'
import DateTimePicker from '@/components/ui/DateTimePicker'

function toLocalDatetime(isoStr: string) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

// Convert a `datetime-local` value (interpreted in the admin's local timezone)
// into a UTC ISO string so timestamptz columns store the correct instant.
function toUTCISO(localDatetime: string) {
  if (!localDatetime) return localDatetime
  return new Date(localDatetime).toISOString()
}

export default function EditAuctionPage() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moderators, setModerators] = useState<any[]>([])

  useEffect(() => {
    async function fetchModerators() {
      const res = await fetch('/api/admin/moderators')
      if (res.ok) {
        const { moderators } = await res.json()
        setModerators(moderators)
      }
    }
    fetchModerators()
  }, [])
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    banner_image_url: '',
    password: '',
    auction_type: 'tender_base_fixed_bid' as 'progressive_elimination_auction' | 'tender_base_fixed_bid' | 'incremental_approval_auction',
    registration_start: '',
    registration_end: '',
    auction_start: '',
    auction_end: '',
    max_participants: '',
    entry_fee: '0',
      moderator_id: '',
  })
  const [originalData, setOriginalData] = useState<{
    registration_start: string
    registration_end: string
    auction_start: string
    auction_end: string
  } | null>(null)

  useEffect(() => {
    async function fetchAuction() {
      try {
        const res = await fetch(`/api/admin/auctions/${id}`)
        if (!res.ok) throw new Error('Failed to fetch auction')
        const auction = await res.json()

        setFormData({
          name: auction.name || '',
          description: auction.description || '',
          banner_image_url: auction.banner_image_url || '',
          password: auction.password || '',
          auction_type: auction.auction_type || 'tender_base_fixed_bid',
          registration_start: toLocalDatetime(auction.registration_start),
          registration_end: toLocalDatetime(auction.registration_end),
          auction_start: toLocalDatetime(auction.auction_start),
          auction_end: toLocalDatetime(auction.auction_end),
          max_participants: auction.max_participants?.toString() || '',
          entry_fee: auction.entry_fee?.toString() || '0',
      moderator_id: auction.moderator_id || '',
        })
        setOriginalData({
          registration_start: auction.registration_start || '',
          registration_end: auction.registration_end || '',
          auction_start: auction.auction_start || '',
          auction_end: auction.auction_end || '',
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load auction'
        setError(message)
      } finally {
        setFetching(false)
      }
    }
    fetchAuction()
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let val = e.target.value
    if (e.target.type === 'number') {
      val = val.replace(/^0+(?=\d)/, '')
    }
    setFormData(prev => ({ ...prev, [e.target.name]: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const regStart = new Date(formData.registration_start)
      const regEnd = new Date(formData.registration_end)
      const aucStart = new Date(formData.auction_start)
      const aucEnd = new Date(formData.auction_end)

      const now = new Date()
              const checkFuture = (val: string, origVal: string | undefined, label: string) => {
          if (!val) return
          const dateVal = new Date(val)
          
          if (origVal && val === toLocalDatetime(origVal)) {
            return
          }
          
          if (dateVal < now) {
            throw new Error(`${label} must be in the future`)
          }
        }

      if (originalData) {
        checkFuture(formData.registration_start, originalData.registration_start, 'Registration start time')
        checkFuture(formData.registration_end, originalData.registration_end, 'Registration end time')
        checkFuture(formData.auction_start, originalData.auction_start, 'Auction start time')
    
      }

              if (formData.auction_type === 'tender_base_fixed_bid') {
          if (aucStart <= regStart) {
            throw new Error('Bid start time must be after registration opens')
          }
          if (aucEnd <= aucStart) {
            throw new Error('End bidding time must be after bid start time')
          }
        } else {
          if (regEnd <= regStart) {
            throw new Error('Registration end time must be after registration start time')
          }
          if (aucStart <= regEnd) {
            throw new Error('Auction start time must be after registration end time')
          }
        }

        const res = await fetch(`/api/admin/auctions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            published_at: null, // Removed from edit form
            registration_start: toUTCISO(formData.registration_start),
            registration_end: formData.auction_type === 'tender_base_fixed_bid' ? toUTCISO(formData.auction_end) : toUTCISO(formData.registration_end),
            auction_start: toUTCISO(formData.auction_start),
            auction_end: formData.auction_type === 'tender_base_fixed_bid' ? toUTCISO(formData.auction_end) : new Date('2099-12-31T23:59:59Z').toISOString(),
          }),
        })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update auction')
      }

      router.push(`/admin/auctions/${id}`)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update auction'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link 
        href={`/admin/auctions/${id}`}
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Auction
      </Link>

      <div className="card-glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Edit Auction</h1>
        <p className="text-[var(--text-secondary)] mb-8">Update auction details</p>

        {error && (
          <div className="error-message mb-6 flex items-center gap-2">
            <span></span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <fieldset disabled={loading} className="border-0 p-0 m-0 min-w-0 space-y-8">
          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center text-sm">1</span>
              Basic Information
            </h2>
            
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                Auction Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Spring Gemstone Collection 2024"
                className="w-full"
              />
            </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  Assign Moderator (Optional)
                </label>
                <select
                  name="moderator_id"
                  value={formData.moderator_id}
                  onChange={handleChange}
                  className="w-full"
                >
                  <option value="">No Moderator</option>
                  {moderators.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.display_name || m.email}
                    </option>
                  ))}
                </select>
              </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe what makes this auction special..."
                className="w-full resize-none"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Banner Image/Media
              </label>
              <ImageUploader 
                images={[formData.banner_image_url || '']}
                maxImages={1}
                onChange={(images) => setFormData({ ...formData, banner_image_url: images[0] || '' })}
              />
            </div>
          </section>

          

          {/* Schedule */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center text-sm">2</span>
              Schedule
            </h2>
            


            {formData.auction_type === 'tender_base_fixed_bid' ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Registration Opens *
                    </label>
                    <DateTimePicker
                      value={formData.registration_start}
                      onChange={(val) => setFormData(prev => ({ ...prev, registration_start: val }))}
                      required
                      placeholder="Select registration open time"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Bid Start Time *
                    </label>
                    <DateTimePicker
                      value={formData.auction_start}
                      onChange={(val) => setFormData(prev => ({ ...prev, auction_start: val }))}
                      required
                      placeholder="Select bid start time"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      End Bidding Time *
                    </label>
                    <DateTimePicker
                      value={formData.registration_end} // using registration_end here but we will also set auction_end
                      onChange={(val) => setFormData(prev => ({ ...prev, registration_end: val }))}
                      required
                      placeholder="Select end bidding time"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Registration Opens *
                    </label>
                    <DateTimePicker
                      value={formData.registration_start}
                      onChange={(val) => setFormData(prev => ({ ...prev, registration_start: val }))}
                      required
                      placeholder="Select registration open time"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Registration Closes *
                    </label>
                    <DateTimePicker
                      value={formData.registration_end}
                      onChange={(val) => setFormData(prev => ({ ...prev, registration_end: val }))}
                      required
                      placeholder="Select registration close time"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Auction Starts *
                    </label>
                    <DateTimePicker
                      value={formData.auction_start}
                      onChange={(val) => setFormData(prev => ({ ...prev, auction_start: val }))}
                      required
                      placeholder="Select auction start time"
                    />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Settings */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center text-sm">4</span>
              Settings
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Max Participants
                </label>
                <input
                  type="number"
                  name="max_participants"
                  value={formData.max_participants}
                  onChange={handleChange}
                  min="1"
                  placeholder="Unlimited"
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">Leave empty for unlimited</p>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                  <span className="font-bold">#</span>
                  Auction Password *
                </label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="e.g. 1234"
                  className="w-full"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">4-digit numeric password</p>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Entry Fee (LKR)
                </label>
                <input
                  type="number"
                  name="entry_fee"
                  value={formData.entry_fee}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          <div className="flex items-center gap-4 pt-6 border-t border-[var(--border)]">
            <button
              type="submit"
              disabled={loading}
              className="btn-gold flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
            <Link href={`/admin/auctions/${id}`} className="btn-outline">
              Cancel
            </Link>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  )
}

