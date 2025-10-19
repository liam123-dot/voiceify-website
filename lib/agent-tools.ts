import { createServiceClient } from '@/lib/supabase/server'

type Tool = {
  id: string
  name: string
  label: string | null
  type: string
  async?: boolean
  description: string | null
  function_schema: Record<string, unknown> | null
  static_config: Record<string, unknown> | null
  config_metadata: Record<string, unknown> | null
  pipedream_metadata: Record<string, unknown> | null
}

type LiveKitTool = {
  id: string
  name: string
  label: string | null
  type: string
  async: boolean
  description: string
  parameters: unknown
  staticConfig: Record<string, unknown>
  configMetadata: Record<string, unknown>
  pipedreamMetadata: Record<string, unknown> | null
}

/**
 * Fetches all tools associated with an agent and returns them in LiveKit agent format.
 * Returns the tool definitions (name, description, parameters) without the execute function.
 * The agent implementation will provide the execute function based on the tool type.
 */
export async function getAgentTools(agentId: string): Promise<{ 
  success: boolean
  tools?: LiveKitTool[]
  error?: string 
}> {
  const supabase = await createServiceClient()

  try {
    // Get tools assigned to this agent via the agent_tools linking table
    const { data: agentTools, error: agentToolsError } = await supabase
      .from('agent_tools')
      .select(`
        tool_id,
        tools (*)
      `)
      .eq('agent_id', agentId)

    if (agentToolsError) {
      console.error('Error fetching agent tools:', agentToolsError)
      return {
        success: false,
        error: 'Failed to fetch agent tools'
      }
    }

    // Extract tools from the join result
    const tools = (agentTools || [])
      .map((at: { tools: unknown }) => at.tools)
      .filter((tool): tool is Tool => tool !== null) as Tool[]

    // Transform tools to LiveKit agent format
    const livekitTools: LiveKitTool[] = tools.map((tool) => {
      const functionSchema = tool.function_schema || {}
      
      return {
        // Internal metadata
        id: tool.id,
        name: tool.name, // Function name (e.g., send_sms_abc123)
        label: tool.label, // Human-readable name
        type: tool.type, // Tool type (sms, transfer_call, pipedream_action)
        async: tool.async || false, // Whether to wait for response
        
        // LiveKit agent tool definition
        description: (functionSchema as { description?: string }).description || tool.description || '',
        parameters: (functionSchema as { parameters?: unknown }).parameters || {
          type: 'object',
          properties: {},
          required: [],
        },
        
        // Static configuration (pre-filled values hidden from LLM)
        staticConfig: tool.static_config || {},
        
        // Full config metadata for reconstruction
        configMetadata: tool.config_metadata || {},
        
        // Pipedream-specific metadata
        pipedreamMetadata: tool.pipedream_metadata || null,
      }
    })

    return {
      success: true,
      tools: livekitTools
    }
  } catch (error) {
    console.error('Error in getAgentTools:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }
  }
}

