const fs = require('fs');
const file = 'app/admin/auctions/[id]/edit/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('if (regEnd <= regStart) {');
const fetchIdx = content.indexOf('const res = await fetch', startIdx);
const endIdx = content.indexOf('})', fetchIdx) + 2;

if (startIdx === -1 || fetchIdx === -1 || endIdx < fetchIdx) {
  console.log('Failed to find indices');
  process.exit(1);
}

const replace = \        if (formData.auction_type === 'tender_base_fixed_bid') {
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

        const res = await fetch(\\\/api/admin/auctions/\\\\\\, {
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
        })\;

content = content.substring(0, startIdx) + replace + content.substring(endIdx);
fs.writeFileSync(file, content);
console.log('Successfully replaced logic');