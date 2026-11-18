import IncrementalAdminPage from '@/components/auctions/incremental/IncrementalAdminPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncrementalAdminPage params={params} />
}
