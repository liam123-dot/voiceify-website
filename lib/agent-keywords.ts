import { createServiceClient } from './supabase/server';
import { AgentConfiguration } from '@/types/agent-config';

/**
 * Add keywords to an agent's STT configuration
 * 
 * @param agentId - The agent ID
 * @param organizationId - The organization ID
 * @param keywords - Array of keywords to add
 * @returns The updated configuration or null if failed
 */
export async function addKeywordsToAgent(
  agentId: string,
  organizationId: string,
  keywords: string[]
): Promise<AgentConfiguration | null> {
  try {
    const supabase = await createServiceClient();

    // Fetch current agent configuration
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('configuration')
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !agent) {
      console.error('Error fetching agent:', fetchError);
      return null;
    }

    const configuration = agent.configuration as AgentConfiguration;

    // Ensure pipeline and stt objects exist
    if (!configuration.pipeline) {
      configuration.pipeline = {};
    }

    if (!configuration.pipeline.stt) {
      console.error('No STT configuration found for agent');
      return null;
    }

    // Merge new keywords with existing ones (remove duplicates)
    const existingKeywords = configuration.pipeline.stt.keywords || [];
    const uniqueKeywords = Array.from(new Set([...existingKeywords, ...keywords]));
    
    configuration.pipeline.stt.keywords = uniqueKeywords;

    // Update agent in database
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update({
        configuration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .select('configuration')
      .single();

    if (updateError || !updatedAgent) {
      console.error('Error updating agent:', updateError);
      return null;
    }

    return updatedAgent.configuration as AgentConfiguration;
  } catch (error) {
    console.error('Error in addKeywordsToAgent:', error);
    return null;
  }
}

/**
 * Update keywords for an agent's STT configuration (replaces existing keywords)
 * 
 * @param agentId - The agent ID
 * @param organizationId - The organization ID
 * @param keywords - Array of keywords to set
 * @returns The updated configuration or null if failed
 */
export async function updateAgentKeywords(
  agentId: string,
  organizationId: string,
  keywords: string[]
): Promise<AgentConfiguration | null> {
  try {
    const supabase = await createServiceClient();

    // Fetch current agent configuration
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('configuration')
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !agent) {
      console.error('Error fetching agent:', fetchError);
      return null;
    }

    const configuration = agent.configuration as AgentConfiguration;

    // Ensure pipeline and stt objects exist
    if (!configuration.pipeline) {
      configuration.pipeline = {};
    }

    if (!configuration.pipeline.stt) {
      console.error('No STT configuration found for agent');
      return null;
    }

    // Replace keywords (remove duplicates)
    configuration.pipeline.stt.keywords = Array.from(new Set(keywords));

    // Update agent in database
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update({
        configuration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .select('configuration')
      .single();

    if (updateError || !updatedAgent) {
      console.error('Error updating agent:', updateError);
      return null;
    }

    return updatedAgent.configuration as AgentConfiguration;
  } catch (error) {
    console.error('Error in updateAgentKeywords:', error);
    return null;
  }
}

