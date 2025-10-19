import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'
import { ToolConfig } from '@/types/tools'
import {
  buildFunctionSchema,
  buildStaticConfig,
  generateToolName,
  validateToolConfig,
} from '@/lib/tools/schema-builder'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json(
        { error: 'Not authenticated or unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Parse request body
    const body = await request.json()
    const config = body as ToolConfig

    // Validate tool configuration
    const validation = validateToolConfig(config)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Generate unique tool name
    const baseName = config.name || generateToolName(config.label)
    let toolName = baseName
    let increment = 2

    while (true) {
      const { data: existing } = await supabase
        .from('tools')
        .select('id')
        .eq('name', toolName)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (!existing) break

      toolName = `${baseName}_${increment}`
      increment++
    }

    // Build function schema and static config
    const functionSchema = buildFunctionSchema({ ...config, name: toolName })
    const staticConfig = buildStaticConfig(config)

    console.log('Creating tool:', {
      name: toolName,
      type: config.type,
      label: config.label,
      functionSchema: JSON.stringify(functionSchema, null, 2),
    })

    // Create the tool
    const { data: tool, error: createError } = await supabase
      .from('tools')
      .insert({
        name: toolName,
        label: config.label,
        description: config.description,
        type: config.type,
        function_schema: functionSchema,
        static_config: staticConfig,
        config_metadata: config,
        async: config.async || false,
        organization_id: organizationId,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating tool:', createError)
      return NextResponse.json(
        { error: 'Failed to create tool' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tool }, { status: 201 })
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug: slugFromUrl } = await context.params
    const { user, organizationId } = await getAuthSession(slugFromUrl)

    if (!user || !organizationId) {
      return NextResponse.json({ tools: [] })
    }

    const supabase = await createClient()

    // Get all tools for the user's organization
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    console.log('Tools:', tools)

    if (toolsError) {
      console.error('Error fetching tools:', toolsError)
      return NextResponse.json(
        { error: 'Failed to fetch tools' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, tools: tools || [] })
  } catch (error) {
    console.error('Error in /api/[organizationId]/tools GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

