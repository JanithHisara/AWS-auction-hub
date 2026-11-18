import ProgressiveUserPage from '@/components/auctions/progressive/ProgressiveUserPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProgressiveUserPage params={params} />
}
