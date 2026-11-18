import ProgressiveRegistrationsPage from '@/components/auctions/progressive/ProgressiveRegistrationsPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  return <ProgressiveRegistrationsPage params={params} searchParams={searchParams} />
}
