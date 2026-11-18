import IncrementalUserPage from '@/components/auctions/incremental/IncrementalUserPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncrementalUserPage params={params} />
}
