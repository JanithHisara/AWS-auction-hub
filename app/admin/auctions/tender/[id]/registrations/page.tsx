import TenderRegistrationsPage from '@/components/auctions/tender/TenderRegistrationsPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string }>
}) {
  return <TenderRegistrationsPage params={params} searchParams={searchParams} />
}
