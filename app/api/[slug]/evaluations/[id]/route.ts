import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - Get a single evaluation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug, id } = await params

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Fetch the evaluation
    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .select('id, name, description, prompt, model_provider, model_name, output_schema, created_at, updated_at')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (error || !evaluation) {
      console.error('Error fetching evaluation:', error)
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    return NextResponse.json({ evaluation })
  } catch (error) {
    console.error('Error in GET /api/[slug]/evaluations/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update an evaluation
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { user, organizationId } = await getAuthSession()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug, id } = await params
    const body = await request.json()
    const { name, description, prompt, model_provider, model_name, output_schema } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!model_provider) {
      return NextResponse.json({ error: 'Model provider is required' }, { status: 400 })
    }

    if (!model_name) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 })
    }

    if (!output_schema) {
      return NextResponse.json({ error: 'Output schema is required' }, { status: 400 })
    }

    // Ensure output_schema is an object
    const parsedSchema = typeof output_schema === 'string' ? JSON.parse(output_schema) : output_schema

    const supabase = await createServiceClient()

    // Verify the organization slug matches the user's organization
    const { data: org } = await supabase
      .from('organisations')
      .select('id')
      .eq('slug', slug)
      .eq('id', organizationId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Update the evaluation
    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        prompt: prompt.trim(),
        model_provider,
        model_name,
        output_schema: parsedSchema,
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select('id, name, description, prompt, model_provider, model_name, output_schema, created_at, updated_at')
      .single()

    if (error || !evaluation) {
      console.error('Error updating evaluation:', error)
      return NextResponse.json({ error: 'Failed to update evaluation' }, { status: 500 })
    }

    return NextResponse.json({ evaluation })
  } catch (error) {
    console.error('Error in PUT /api/[slug]/evaluations/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an evaluation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug } = await params
    const { user, organizationId } = await getAuthSession(slug)
    const { id } = await params

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServiceClient()

    // Verify the evaluation belongs to the user's organization
    const { data: evaluation, error: evalError } = await supabase
      .from('evaluations')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single()

    if (evalError || !evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 })
    }

    // Delete agent associations (CASCADE will handle this, but being explicit)
    await supabase
      .from('agent_evaluations')
      .delete()
      .eq('evaluation_id', id)

    // Delete the evaluation
    const { error: deleteError } = await supabase
      .from('evaluations')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Error deleting evaluation:', deleteError)
      return NextResponse.json({ error: 'Failed to delete evaluation' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error in DELETE /api/[slug]/evaluations/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

