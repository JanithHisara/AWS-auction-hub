import IncrementalRegistrationsPage from '@/components/auctions/incremental/IncrementalRegistrationsPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  return <IncrementalRegistrationsPage params={params} searchParams={searchParams} />
}
