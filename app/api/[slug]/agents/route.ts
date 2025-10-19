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

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    const { data: agents, error: _error } = await supabase
      .from('agents')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name')

    return NextResponse.json({ agents: agents || [] })
  } catch (error) {
    console.error('Error in GET /api/[slug]/agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const supabase = await createServiceClient()

    const { data: agent, error: createError } = await supabase
      .from('agents')
      .insert({
        name: body.name,
        organization_id: organizationId,
      })
      .select('id, name')
      .single()

    if (createError) {
      console.error('Error creating agent:', createError)
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 400 })
    }

    return NextResponse.json({ agent })
  } catch (error) {
    console.error('Error in POST /api/[slug]/agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
