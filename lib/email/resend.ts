import { Resend } from 'resend'

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Validate that a string looks like a real email before using it
function isValidEmail(val: string | undefined): val is string {
  if (!val) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.replace(/^.*<(.+)>$/, '$1'))
}

export interface AuctionAccessEmailParams {
  to: string
  auctionName: string
  auctionDate: string
  auctionDescription?: string | null
  accessToken: string
  userName?: string
}

export async function sendAuctionAccessEmail({
  to,
  auctionName,
  auctionDate,
  auctionDescription,
  accessToken,
  userName,
}: AuctionAccessEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const auctionUrl = `${appUrl}/auction-room/${accessToken}`

  // If Resend is not configured, log and return
  if (!resend) {
    console.log(' Email would be sent to:', to)
    console.log(' Auction URL:', auctionUrl)
    console.log('  Resend API key not configured - email not sent')
    return { id: 'mock-email-id' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Auctionhub <onboarding@resend.dev>'
  const replyTo = process.env.RESEND_REPLY_TO

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    ...(isValidEmail(replyTo) ? { replyTo } : {}),
    subject: `Registration Confirmed: ${auctionName}`,
    html: generateAuctionEmailHtml({
      auctionName,
      auctionDate,
      auctionUrl,
      auctionDescription,
      userName,
    }),
    text: `Your Auction Access Pass\n\n${userName ? `Hi ${userName},` : 'Hello,'}\n\nYou've been approved for ${auctionName}.\nDate: ${auctionDate}\n\nEnter your auction room: ${auctionUrl}\n\nThis link is unique to you. Do not share it with others.\n\nImportant:\n- You must be logged into your account to enter\n- This link is personal and non-transferable\n- Join on time - late entry may limit bidding\n\nAuctionhub - Premium gem auctions`,
  })

  if (error) {
    console.error('Failed to send email:', error)
    throw error
  }

  return data
}

function generateAuctionEmailHtml({
  auctionName,
  auctionDate,
  auctionUrl,
  auctionDescription,
  userName,
}: {
  auctionName: string
  auctionDate: string
  auctionUrl: string
  auctionDescription?: string | null
  userName?: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Auction Access Pass</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(145deg, #1a1a24 0%, #12121a 100%); border-radius: 24px; border: 1px solid rgba(212, 175, 55, 0.2); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="font-size: 48px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #f5f5f7; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                You're In!
              </h1>
              <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 16px;">
                Your exclusive auction access is confirmed
              </p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 0;">
              <p style="margin: 0; color: #f5f5f7; font-size: 16px; line-height: 1.6;">
                ${userName ? `Hi ${userName},` : 'Hello,'}
              </p>
              <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
                You've successfully registered for an exclusive auction. Here's your personal access pass:
              </p>
            </td>
          </tr>
          
          <!-- Auction Card -->
          <tr>
            <td style="padding: 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 8px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                      Auction Event
                    </p>
                    <h2 style="margin: 0 0 16px; color: #d4af37; font-size: 24px; font-weight: 700;">
                      ${auctionName}
                    </h2>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #f5f5f7; font-size: 14px;"> ${auctionDate}</span>
                    </div>
</td>
                </tr>
              </table>
            </td>
          </tr>
          
${auctionDescription ? `
          <tr>
            <td style="padding: 16px 40px 24px;">
              <h3 style="margin: 0 0 12px; color: #d4af37; font-size: 16px; font-weight: 600;">Auction Details</h3>
              <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">${auctionDescription}</p>
            </td>
          </tr>
` : ''}

          <!-- CTA Button -->

          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${auctionUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #c9a961 0%, #a0823d 100%); color: #0a0a0f; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);">
                      Enter Auction Room 
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; color: #71717a; font-size: 13px; text-align: center;">
                This link is unique to you. Do not share it with others.
              </p>
            </td>
          </tr>
          
          <!-- Important Notice -->
          <tr>
            <td style="padding: 24px 40px; background: rgba(255, 255, 255, 0.03); border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <h3 style="margin: 0 0 12px; color: #f5f5f7; font-size: 14px; font-weight: 600;">
                 Important
              </h3>
              <ul style="margin: 0; padding: 0 0 0 20px; color: #a1a1aa; font-size: 14px; line-height: 1.8;">
                <li>You must be logged into your account to enter</li>
                <li>This link is personal and non-transferable</li>
                <li>Join on time - late entry may limit bidding</li>
              </ul>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="margin: 0; color: #71717a; font-size: 13px;">
                Auctionhub
              </p>
              <p style="margin: 8px 0 0; color: #52525b; font-size: 12px;">
                Premium gem auctions for discerning collectors
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer Links -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; color: #52525b; font-size: 12px;">
                If the button doesn't work, copy this link:<br>
                <a href="${auctionUrl}" style="color: #d4af37; word-break: break-all;">${auctionUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// Winner notification email
export interface WinnerEmailParams {
  to: string
  userName?: string
  gemName: string
  gemImageUrl?: string
  winningAmount: number
  auctionName: string
  paymentUrl?: string
}

export async function sendWinnerEmail({
  to,
  userName,
  gemName,
  gemImageUrl,
  winningAmount,
  auctionName,
  paymentUrl,
}: WinnerEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const profileUrl = `${appUrl}/profile`
  const finalPaymentUrl = paymentUrl || profileUrl

  // Format currency
  const formattedAmount = 'LKR ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
  }).format(winningAmount)

  // If Resend is not configured, log and return
  if (!resend) {
    console.log(' Winner email would be sent to:', to)
    console.log(' Winner of:', gemName, 'for', formattedAmount)
    console.log('  Resend API key not configured - email not sent')
    return { id: 'mock-email-id' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Auctionhub <onboarding@resend.dev>'
  const replyTo = process.env.RESEND_REPLY_TO

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    ...(isValidEmail(replyTo) ? { replyTo } : {}),
    subject: `Congratulations! You Won: ${gemName}`,
    html: generateWinnerEmailHtml({
      userName,
      gemName,
      gemImageUrl,
      winningAmount: formattedAmount,
      auctionName,
      paymentUrl: finalPaymentUrl,
      profileUrl,
    }),
    text: `Congratulations! You Won: ${gemName}\n\n${userName ? `Dear ${userName},` : 'Hello,'}\n\nYou've won ${gemName} in the ${auctionName} auction!\n\nWinning Bid: ${formattedAmount}\n\nNext Steps:\n1. Complete payment within 48 hours: ${finalPaymentUrl}\n2. We'll contact you for delivery arrangements\n3. Securely packaged and insured delivery\n\nView your profile: ${profileUrl}\n\nThank you for participating!\nAuctionhub - Premium gem auctions`,
  })

  if (error) {
    console.error('Failed to send winner email:', error)
    throw error
  }

  return data
}

function generateWinnerEmailHtml({
  userName,
  gemName,
  gemImageUrl,
  winningAmount,
  auctionName,
  paymentUrl,
  profileUrl,
}: {
  userName?: string
  gemName: string
  gemImageUrl?: string
  winningAmount: string
  auctionName: string
  paymentUrl: string
  profileUrl: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You Won!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(145deg, #1a1a24 0%, #12121a 100%); border-radius: 24px; border: 1px solid rgba(212, 175, 55, 0.3); overflow: hidden;">
          
          <!-- Trophy Banner -->
          <tr>
            <td style="padding: 48px 40px 24px; text-align: center; background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(160, 130, 61, 0.08) 100%);">
              <div style="font-size: 72px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #d4af37; font-size: 36px; font-weight: 800; letter-spacing: -0.5px;">
                Congratulations!
              </h1>
              <p style="margin: 12px 0 0; color: #f5f5f7; font-size: 20px; font-weight: 600;">
                You are the winning bidder!
              </p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <p style="margin: 0; color: #f5f5f7; font-size: 16px; line-height: 1.6;">
                ${userName ? `Dear ${userName},` : 'Hello,'}
              </p>
              <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
                Great news! You've won an item in the <strong style="color: #f5f5f7;">${auctionName}</strong> auction. Here are the details:
              </p>
            </td>
          </tr>
          
          <!-- Won Item Card -->
          <tr>
            <td style="padding: 16px 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 20px; overflow: hidden;">
                ${gemImageUrl ? `
                <tr>
                  <td style="padding: 0;">
                    <img src="${gemImageUrl}" alt="${gemName}" style="width: 100%; height: 200px; object-fit: cover;">
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 8px; color: #10b981; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                       You Won
                    </p>
                    <h2 style="margin: 0 0 20px; color: #f5f5f7; font-size: 26px; font-weight: 700;">
                      ${gemName}
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(0, 0, 0, 0.2); border-radius: 12px;">
                      <tr>
                        <td style="padding: 16px 20px;">
                          <p style="margin: 0 0 4px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                            Winning Bid
                          </p>
                          <p style="margin: 0; color: #10b981; font-size: 32px; font-weight: 800;">
                            ${winningAmount}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Next Steps -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <h3 style="margin: 0 0 16px; color: #f5f5f7; font-size: 18px; font-weight: 600;">
                 Next Steps
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 16px; background: rgba(255, 255, 255, 0.03); border-radius: 12px 12px 0 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(212, 175, 55, 0.2); color: #d4af37; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">1</span>
                        </td>
                        <td style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                          <strong style="color: #f5f5f7;">Complete Payment</strong><br>
                          Pay within 48 hours to secure your item
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(212, 175, 55, 0.2); color: #d4af37; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">2</span>
                        </td>
                        <td style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                          <strong style="color: #f5f5f7;">Shipping Details</strong><br>
                          We'll contact you for delivery arrangements
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; background: rgba(255, 255, 255, 0.03); border-radius: 0 0 12px 12px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background: rgba(212, 175, 55, 0.2); color: #d4af37; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">3</span>
                        </td>
                        <td style="color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                          <strong style="color: #f5f5f7;">Receive Your Item</strong><br>
                          Securely packaged and insured delivery
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${paymentUrl}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);">
                      Complete Payment 
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; text-align: center;">
                <a href="${profileUrl}" style="color: #d4af37; font-size: 14px; text-decoration: none;">
                  View in My Profile
                </a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background: rgba(255, 255, 255, 0.02); border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="margin: 0; color: #71717a; font-size: 13px;">
                Thank you for participating in our auction!
              </p>
              <p style="margin: 12px 0 0; color: #52525b; font-size: 12px;">
                Auctionhub  Premium gem auctions
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Help Text -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; color: #52525b; font-size: 12px;">
                Questions about your purchase? Reply to this email.
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// Auction going live notification email
export interface AuctionLiveEmailParams {
  to: string
  auctionName: string
  accessToken: string
  userName?: string
}

export async function sendAuctionLiveEmail({
  to,
  auctionName,
  accessToken,
  userName,
}: AuctionLiveEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const auctionUrl = `${appUrl}/auction-room/${accessToken}`

  if (!resend) {
    console.log('[Email] Auction live notification would be sent to:', to)
    console.log('[Email] Auction URL:', auctionUrl)
    console.log('[Email] Resend API key not configured - email not sent')
    return { id: 'mock-email-id' }
  }

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Auctionhub <onboarding@resend.dev>',
    to,
    subject: `${auctionName} is now LIVE - Join Now`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction is Live</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(145deg, #1a1a24 0%, #12121a 100%); border-radius: 24px; border: 1px solid rgba(239, 68, 68, 0.3); overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px 24px; text-align: center; background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%);">
              <div style="display: inline-block; width: 16px; height: 16px; background-color: #ef4444; border-radius: 50%; margin-bottom: 16px; animation: pulse 2s infinite;"></div>
              <h1 style="margin: 0; color: #ef4444; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">
                AUCTION IS LIVE
              </h1>
              <p style="margin: 12px 0 0; color: #f5f5f7; font-size: 18px; font-weight: 600;">
                ${auctionName}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 16px;">
              <p style="margin: 0; color: #f5f5f7; font-size: 16px; line-height: 1.6;">
                ${userName ? `Hi ${userName},` : 'Hello,'}
              </p>
              <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 16px; line-height: 1.6;">
                The auction you registered for is now live! Join now to start bidding.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${auctionUrl}" style="display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; font-size: 18px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);">
                      Join Auction Now
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; color: #71717a; font-size: 13px; text-align: center;">
                This link is unique to you. Do not share it with others.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="margin: 0; color: #71717a; font-size: 13px;">Auctionhub</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; color: #52525b; font-size: 12px;">
                If the button doesn't work, copy this link:<br>
                <a href="${auctionUrl}" style="color: #d4af37; word-break: break-all;">${auctionUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `${auctionName} is now LIVE!\n\n${userName ? `Hi ${userName},` : 'Hello,'}\n\nThe auction you registered for is now live! Join now to start bidding.\n\nJoin here: ${auctionUrl}\n\nThis link is unique to you. Do not share it with others.\n\nAuctionhub`,
  })

  if (error) {
    console.error('Failed to send auction live email:', error)
    throw error
  }

  return data
}

// Auction summary email at completion
export interface AuctionSummaryEmailParams {
  to: string
  userName?: string
  auctionName: string
  items: {
    name: string
    description: string | null
    winningPrice: number | null
  }[]
}

export async function sendAuctionSummaryEmail({
  to,
  userName,
  auctionName,
  items,
}: AuctionSummaryEmailParams) {
  if (!resend) {
    console.log('[Email] Auction summary notification would be sent to:', to)
    console.log('[Email] Items:', items)
    console.log('[Email] Resend API key not configured - email not sent')
    return { id: 'mock-email-id' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Auctionhub <onboarding@resend.dev>'
  const replyTo = process.env.RESEND_REPLY_TO

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    ...(isValidEmail(replyTo) ? { replyTo } : {}),
    subject: `Auction Summary: ${auctionName}`,
    html: generateAuctionSummaryEmailHtml({
      userName,
      auctionName,
      items,
    }),
    text: `Auction Summary: ${auctionName}\n\n${userName ? `Hi ${userName},` : 'Hello,'}\n\nHere is a summary of the items from ${auctionName}:\n\n` + 
      items.map(item => `- ${item.name}: ${item.winningPrice ? `LKR ${item.winningPrice.toLocaleString()}` : 'No bids'}\n  Description: ${item.description || 'No description'}`).join('\n\n') +
      `\n\nThank you for participating!\nAuctionhub`,
  })

  if (error) {
    console.error('Failed to send auction summary email:', error)
    throw error
  }

  return data
}

function generateAuctionSummaryEmailHtml({
  userName,
  auctionName,
  items,
}: {
  userName?: string
  auctionName: string
  items: {
    name: string
    description: string | null
    winningPrice: number | null
  }[]
}) {
  const itemsHtml = items.map(item => {
    const formattedPrice = item.winningPrice !== null && item.winningPrice !== undefined
      ? ('LKR ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(item.winningPrice))
      : 'Not Sold'
    
    return `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <td style="padding: 16px 0; vertical-align: top;">
          <h4 style="margin: 0 0 4px; color: #f5f5f7; font-size: 16px; font-weight: 700;">${item.name}</h4>
          <p style="margin: 0; color: #a1a1aa; font-size: 13px; line-height: 1.4;">${item.description || 'No description available'}</p>
        </td>
        <td style="padding: 16px 0; text-align: right; vertical-align: top; width: 120px;">
          <span style="color: ${item.winningPrice !== null && item.winningPrice !== undefined ? '#d4af37' : '#71717a'}; font-size: 16px; font-weight: 800; font-family: monospace;">
            ${formattedPrice}
          </span>
        </td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Summary</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(145deg, #1a1a24 0%, #12121a 100%); border-radius: 24px; border: 1px solid rgba(212, 175, 55, 0.2); overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(160, 130, 61, 0.05) 100%);">
              <div style="font-size: 48px; margin-bottom: 16px;"></div>
              <h1 style="margin: 0; color: #f5f5f7; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                Auction Summary
              </h1>
              <p style="margin: 8px 0 0; color: #a1a1aa; font-size: 16px;">
                ${auctionName} has ended
              </p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <p style="margin: 0; color: #f5f5f7; font-size: 16px; line-height: 1.6;">
                ${userName ? `Hi ${userName},` : 'Hello,'}
              </p>
              <p style="margin: 12px 0 0; color: #a1a1aa; font-size: 15px; line-height: 1.6;">
                The auction has finished and all results are finalized. Here is the summary of the items and their winning prices:
              </p>
            </td>
          </tr>
          
          <!-- Items Table -->
          <tr>
            <td style="padding: 16px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid rgba(255, 255, 255, 0.08);">
                    <th align="left" style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 8px;">Item Details</th>
                    <th align="right" style="color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 8px; width: 120px;">Winning Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; text-align: center; background: rgba(255, 255, 255, 0.02); border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="margin: 0; color: #71717a; font-size: 13px;">
                Thank you for participating!
              </p>
              <p style="margin: 8px 0 0; color: #52525b; font-size: 12px;">
                Auctionhub  Premium gem auctions
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}


// Password reset email
export interface PasswordResetEmailParams {
  to: string
  resetLink: string
}

export async function sendPasswordResetEmail({
  to,
  resetLink,
}: PasswordResetEmailParams) {
  if (!resend) {
    console.log('[Email] Password reset would be sent to:', to)
    console.log('[Email] Link:', resetLink)
    return { id: 'mock-email-id' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Auctionhub <onboarding@resend.dev>'
  
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(145deg, #1a1a24 0%, #12121a 100%); border-radius: 24px; border: 1px solid rgba(212, 175, 55, 0.2); overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(160, 130, 61, 0.05) 100%);">
              <h1 style="margin: 0; color: #f5f5f7; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                Reset Password
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 32px;">
              <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 16px; line-height: 1.6; text-align: center;">
                We received a request to reset the password for your Auctionhub account. Click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; background-color: #d4af37; color: #000000; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 32px; border-radius: 12px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; color: #71717a; font-size: 13px; text-align: center;">
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; text-align: center; background: rgba(255, 255, 255, 0.02); border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="margin: 0; color: #71717a; font-size: 13px;">Auctionhub</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject: 'Reset your Auctionhub password',
    html: htmlContent,
    text: `Reset your password by clicking this link: ${resetLink}`,
  })

  if (error) {
    console.error('Failed to send password reset email:', error)
    throw error
  }

  return data
}

export { resend }



