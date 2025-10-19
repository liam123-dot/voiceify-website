import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    // Fetch phone numbers for the organization
    const { data: phoneNumbers, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching phone numbers:', error)
      return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
    }

    return NextResponse.json({ phoneNumbers: phoneNumbers || [] })
  } catch (error) {
    console.error('Error in GET /api/[slug]/phone-numbers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

