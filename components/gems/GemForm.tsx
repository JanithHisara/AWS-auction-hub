'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Gem, GemImage, GemCertificate, Auction, MediaType } from '@/types/database'
import { Loader2, Plus, X, FileText, DollarSign, Clock } from 'lucide-react'
import ImageUploader from './ImageUploader'
import DateTimePicker from '@/components/ui/DateTimePicker'

interface GemFormProps {
  gem?: Gem & { images?: GemImage[]; certificates?: GemCertificate[] }
  auctions?: Pick<Auction, 'id' | 'name' | 'status' | 'auction_start' | 'auction_end' | 'auction_type'>[]
  defaultAuctionId?: string
}

// Convert a date into local YYYY-MM-DDTHH:MM for datetime-local inputs
function toLocalDatetimeString(dateInput: string | Date | undefined) {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

// Convert local datetime-local string to UTC ISO string
function toUTCISO(localDatetime: string) {
  if (!localDatetime) return localDatetime
  return new Date(localDatetime).toISOString()
}

export default function GemForm({ gem, auctions = [], defaultAuctionId }: GemFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: gem?.name || '',
    description: gem?.description || '',
    auction_id: gem?.auction_id || defaultAuctionId || '',
    starting_price: gem?.starting_price?.toString() || '0',
    min_bid_increment: gem?.min_bid_increment?.toString() || '1000',
    increment_interval: gem?.increment_interval?.toString() || '60',
    start_time: gem?.start_time ? toLocalDatetimeString(gem.start_time) : '',
    end_time: gem?.end_time ? toLocalDatetimeString(gem.end_time) : '',
    carat_weight: gem?.carat_weight?.toString() || '',
    color: gem?.color || '',
    provenance: gem?.provenance || '',
    images: gem?.images?.map(img => img.image_url) || [''],
    media_types: (gem?.images?.map(img => img.media_type) || ['image']) as MediaType[],
    certificates: gem?.certificates?.map(cert => ({ url: cert.certificate_url, type: cert.certificate_type || '' })) || [{ url: '', type: '' }],
  })

  const selectedAuction = auctions.find(a => a.id === formData.auction_id)
  const isSealed = selectedAuction?.auction_type === 'tender_base_fixed_bid'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const now = new Date()
      if (formData.start_time) {
        const start = new Date(formData.start_time)
        const originalStart = gem?.start_time ? new Date(gem.start_time) : null
        if (start < now && (!originalStart || start.getTime() !== originalStart.getTime())) {
          throw new Error('Start time must be in the future')
        }
      }
      


      if (formData.auction_id) {
        if (selectedAuction) {
          const aucStart = new Date(selectedAuction.auction_start)
          const aucEnd = new Date(selectedAuction.auction_end)
          
          
          
        }
      }

      const url = gem ? `/api/gems/${gem.id}` : '/api/gems'
      const method = gem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          start_time: (isSealed && selectedAuction) ? new Date(selectedAuction.auction_start).toISOString() : toUTCISO(formData.start_time),
          end_time: new Date('2099-12-31T23:59:59Z').toISOString(),
          auction_id: formData.auction_id || null,
          images: formData.images.filter(url => url.trim() !== ''),
          media_types: formData.media_types.filter((_, i) => formData.images[i]?.trim() !== ''),
          certificates: formData.certificates.filter(cert => cert.url.trim() !== ''),
          carat_weight: formData.carat_weight ? parseFloat(formData.carat_weight.toString()) : null,
          starting_price: parseFloat(formData.starting_price.toString()) || 0,
          min_bid_increment: parseFloat(formData.min_bid_increment.toString()) || 0,
          increment_interval: parseInt(formData.increment_interval.toString()) || 0,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save item')
      }

      const responseData = await response.json();
      const finalId = responseData?.id || gem?.id;
      if (finalId) {
        window.location.href = '/admin/gems/' + finalId
      } else {
        window.location.href = '/admin/gems'
      } 
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const addCertificateField = () => setFormData({ ...formData, certificates: [...formData.certificates, { url: '', type: '' }] })
  const updateCertificate = (index: number, field: 'url' | 'type', value: string) => {
    const newCerts = [...formData.certificates]
    newCerts[index] = { ...newCerts[index], [field]: value }
    setFormData({ ...formData, certificates: newCerts })
  }
  const removeCertificate = (index: number) => {
    const newCerts = formData.certificates.filter((_, i) => i !== index)
    setFormData({ ...formData, certificates: newCerts.length > 0 ? newCerts : [{ url: '', type: '' }] })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <fieldset disabled={loading} className="border-0 p-0 m-0 min-w-0 space-y-8">
        {error && (
          <div className="error-message flex items-center gap-2">
            <span></span> {error}
          </div>
        )}

        {/* Auction Selection */}
        {auctions.length > 0 && (
          <Section title="Auction" icon="" number="1">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">
                Assign to Auction
              </label>
              <select
                value={formData.auction_id}
                onChange={(e) => setFormData({ ...formData, auction_id: e.target.value })}
                className="w-full"
              >
                <option value="">No auction (standalone)</option>
                {auctions.map(auction => (
                  <option key={auction.id} value={auction.id}>
                    {auction.name} ({auction.status})
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Items assigned to an auction will be available for bidding during the auction
              </p>
            </div>
          </Section>
        )}

        {/* Basic Info */}
        <Section title="Basic Information" icon="" number={auctions.length > 0 ? "2" : "1"}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Blue Sapphire 5.2ct"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Description *</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the item in detail..."
                className="w-full resize-none"
              />
            </div>
          </div>
        </Section>

        {/* Pricing */}
        {!isSealed && (
        <Section title="Pricing & Timing" icon="" number={auctions.length > 0 ? "3" : "2"}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Starting Price *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.starting_price}
                onChange={(e) => setFormData({ ...formData, starting_price: e.target.value.replace(/^0+(?=\d)/, '') })}
                onWheel={(e) => e.currentTarget.blur()}
                  className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Min Bid Increment *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={formData.min_bid_increment}
                onChange={(e) => setFormData({ ...formData, min_bid_increment: e.target.value.replace(/^0+(?=\d)/, '') })}
                onWheel={(e) => e.currentTarget.blur()}
                  className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Start Time *
              </label>
              <DateTimePicker
                value={formData.start_time}
                onChange={(val) => setFormData({ ...formData, start_time: val })}
                required
                placeholder="Select start time"
              />
            </div>
            </div>
        </Section>
        )}

        {/* Specifications */}
        <Section title="Specifications" icon="" number={auctions.length > 0 ? (isSealed ? "3" : "4") : (isSealed ? "2" : "3")}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Carat Weight</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.carat_weight}
                onChange={(e) => setFormData({ ...formData, carat_weight: e.target.value.replace(/^0+(?=\d)/, '') })}
                placeholder="e.g., 5.2"
                onWheel={(e) => e.currentTarget.blur()}
                  className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Color</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Blue, Red, Green"
                className="w-full"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-[var(--text-secondary)] mb-2">Provenance</label>
            <textarea
              rows={3}
              value={formData.provenance}
              onChange={(e) => setFormData({ ...formData, provenance: e.target.value })}
              placeholder="Origin and history of the item..."
              className="w-full resize-none"
            />
          </div>
        </Section>

      {/* Images */}
      <Section title="Images & Videos" icon="" number={auctions.length > 0 ? (isSealed ? "4" : "5") : (isSealed ? "3" : "4")}>
        <ImageUploader
          images={formData.images}
          mediaTypes={formData.media_types}
          onChange={(images, mediaTypes) => setFormData({ ...formData, images, media_types: mediaTypes })}
        />
      </Section>

      {/* Certificates */}
      <Section title="Certificates" icon="" number={auctions.length > 0 ? (isSealed ? "5" : "6") : (isSealed ? "4" : "5")}>
        <div className="space-y-3">
          {formData.certificates.map((cert, index) => (
            <div key={index} className="flex gap-2">
              <div className="relative flex-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="url"
                  value={cert.url}
                  onChange={(e) => updateCertificate(index, 'url', e.target.value)}
                  placeholder="Certificate URL"
                  className="w-full pl-10"
                />
              </div>
              <input
                type="text"
                value={cert.type}
                onChange={(e) => updateCertificate(index, 'type', e.target.value)}
                placeholder="Type"
                className="w-32"
              />
              {formData.certificates.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCertificate(index)}
                  className="p-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addCertificateField}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:border-[var(--gold)]/50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Certificate
          </button>
        </div>
      </Section>

        {/* Actions */}
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
              <span>{gem ? 'Update Item' : 'Create Item'}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-outline"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  )
}

function Section({
  title,
  icon,
  number,
  children
}: {
  title: string
  icon: string
  number: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center text-sm text-[var(--gold)]">
          {number}
        </span>
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  )
}

