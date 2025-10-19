import { PhoneNumbersContainer } from '@/components/phone-numbers/phone-numbers-container'

interface PhoneNumbersPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function PhoneNumbersPage({ params }: PhoneNumbersPageProps) {
  const { slug } = await params
  
  return <PhoneNumbersContainer organizationSlug={slug} />
}

