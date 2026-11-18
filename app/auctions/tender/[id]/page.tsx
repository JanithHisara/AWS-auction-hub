import TenderUserPage from '@/components/auctions/tender/TenderUserPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TenderUserPage params={params} />
}
