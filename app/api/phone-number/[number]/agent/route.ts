import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getAgentTools } from "@/lib/agent-tools";

type AgentWithTools = {
  id: string;
  organization_id: string;
  name: string;
  configuration: unknown;
  rules: unknown;
  created_at: string;
  updated_at: string;
  knowledgeBaseIds: string[];
  tools: Array<{
    id: string;
    name: string;
    label: string | null;
    type: string;
    async: boolean;
    description: string;
    parameters: unknown;
    staticConfig: Record<string, unknown>;
    configMetadata: Record<string, unknown>;
    pipedreamMetadata: Record<string, unknown> | null;
  }>;
};

/**
 * Fetches all agents in a batch with their tools and knowledge base status.
 * Optimized to fetch data in parallel where possible.
 * 
 * @param agentIds - Array of agent IDs to fetch
 * @param supabase - Supabase client
 * @returns Map of agent IDs to AgentWithTools
 */
async function fetchAgentsBatch(
  agentIds: string[],
  supabase: Awaited<ReturnType<typeof createServiceClient>>
): Promise<Map<string, AgentWithTools>> {
  if (agentIds.length === 0) {
    return new Map();
  }

  // Fetch all agents, their tools, and knowledge base assignments in parallel
  const [agentsResult, knowledgeBaseAssignments] = await Promise.all([
    // Fetch all agents at once
    supabase
      .from('agents')
      .select('*')
      .in('id', agentIds),
    
    // Fetch all knowledge base assignments for these agents
    supabase
      .from('agent_knowledge_bases')
      .select('agent_id, knowledge_base_id')
      .in('agent_id', agentIds)
  ]);

  if (agentsResult.error) {
    throw new Error(agentsResult.error.message);
  }

  // Create a map of agent IDs to their knowledge base IDs
  const agentKnowledgeBasesMap = new Map<string, string[]>();
  (knowledgeBaseAssignments.data || []).forEach(akb => {
    if (!agentKnowledgeBasesMap.has(akb.agent_id)) {
      agentKnowledgeBasesMap.set(akb.agent_id, []);
    }
    agentKnowledgeBasesMap.get(akb.agent_id)!.push(akb.knowledge_base_id);
  });

  // Fetch tools for all agents in parallel
  const toolsResults = await Promise.all(
    (agentsResult.data || []).map(agent => getAgentTools(agent.id))
  );

  // Build the map of agents with tools and knowledge base status
  const agentsMap = new Map<string, AgentWithTools>();
  
  (agentsResult.data || []).forEach((agent, index) => {
    const toolsResult = toolsResults[index];
    
    if (toolsResult.success) {
      agentsMap.set(agent.id, {
        ...agent,
        knowledgeBaseIds: agentKnowledgeBasesMap.get(agent.id) || [],
        tools: toolsResult.tools || []
      });
    }
  });

  return agentsMap;
}

/**
 * Extracts agent IDs from transfer_call tools for a given agent.
 * 
 * @param agent - The agent to extract transfer target IDs from
 * @returns Array of agent IDs that this agent can transfer to
 */
function getTransferTargetAgentIds(agent: AgentWithTools): string[] {
  const transferToAgentTools = agent.tools.filter(
    (tool) => 
      tool.type === 'transfer_call' && 
      tool.staticConfig?.target &&
      typeof tool.staticConfig.target === 'object' &&
      'type' in tool.staticConfig.target &&
      tool.staticConfig.target.type === 'agent' &&
      'agentId' in tool.staticConfig.target
  );

  return transferToAgentTools.map(
    tool => (tool.staticConfig.target as { agentId: string }).agentId
  );
}

/**
 * Fetches an agent and all agents referenced in its transfer_call tools.
 * Optimized to fetch all agents in batches rather than sequentially.
 * 
 * @param agentId - The ID of the agent to fetch
 * @returns The agent with tools and all related agents
 */
async function fetchAgentWithRelatedAgents(
  agentId: string
): Promise<{ agent: AgentWithTools | null; relatedAgents: Map<string, AgentWithTools>; error?: string }> {
  const supabase = await createServiceClient();

  try {
    // Fetch the initial agent
    const agentsMap = await fetchAgentsBatch([agentId], supabase);
    
    if (!agentsMap.has(agentId)) {
      return { agent: null, relatedAgents: new Map(), error: 'Agent not found' };
    }

    // Track which agents we've already processed to find their transfer targets
    const processedAgentIds = new Set<string>();
    
    // Keep discovering and fetching related agents until no new ones are found
    let hasNewAgents = true;
    while (hasNewAgents) {
      hasNewAgents = false;
      
      // Find all agent IDs we need to process
      const agentIdsToProcess = Array.from(agentsMap.keys()).filter(
        id => !processedAgentIds.has(id)
      );
      
      if (agentIdsToProcess.length === 0) {
        break; // No more agents to process
      }
      
      // Collect transfer target IDs from all unprocessed agents
      const newTargetIds = new Set<string>();
      for (const id of agentIdsToProcess) {
        processedAgentIds.add(id);
        const agent = agentsMap.get(id)!;
        const targetIds = getTransferTargetAgentIds(agent);
        targetIds.forEach(targetId => {
          if (!agentsMap.has(targetId)) {
            newTargetIds.add(targetId);
          }
        });
      }
      
      // Fetch any new agents we discovered
      if (newTargetIds.size > 0) {
        const newAgentsMap = await fetchAgentsBatch(Array.from(newTargetIds), supabase);
        newAgentsMap.forEach((agent, id) => {
          agentsMap.set(id, agent);
        });
        hasNewAgents = true;
      }
    }

    const mainAgent = agentsMap.get(agentId)!;
    
    return { 
      agent: mainAgent, 
      relatedAgents: agentsMap 
    };
  } catch (error) {
    return { 
      agent: null, 
      relatedAgents: new Map(), 
      error: error instanceof Error ? error.message : 'Failed to fetch agents' 
    };
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ number: string }> }) {

  const { number } = await params;
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('agent_id')
    .eq('phone_number', number)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
  }

  // Fetch the agent and all related agents recursively
  const result = await fetchAgentWithRelatedAgents(data.agent_id);

  if (result.error || !result.agent) {
    return NextResponse.json({ error: result.error || 'Failed to fetch agent' }, { status: 500 });
  }

  // Convert the Map to a dictionary object, excluding the main agent
  const relatedAgentsDict: Record<string, AgentWithTools> = {};
  result.relatedAgents.forEach((agent, agentId) => {
    if (agentId !== data.agent_id) {
      relatedAgentsDict[agentId] = agent;
    }
  });

  return NextResponse.json({
    ...result.agent,
    relatedAgents: Object.keys(relatedAgentsDict).length > 0 ? relatedAgentsDict : undefined
  });
}