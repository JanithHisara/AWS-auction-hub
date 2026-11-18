import TenderAdminPage from '@/components/auctions/tender/TenderAdminPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TenderAdminPage params={params} />
}
