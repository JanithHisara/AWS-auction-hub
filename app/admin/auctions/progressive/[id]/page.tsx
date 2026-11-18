import ProgressiveAdminPage from '@/components/auctions/progressive/ProgressiveAdminPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ProgressiveAdminPage params={params} />
}
