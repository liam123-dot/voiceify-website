export interface TimeBasedRule {
  enabled: boolean
  schedules: Schedule[]
}

export interface Schedule {
  id: string
  days: DayOfWeek[] // e.g., ["monday", "tuesday", "wednesday", "thursday", "friday"]
  startTime: string // e.g., "09:00"
  endTime: string // e.g., "17:00"
  transferTo: string // Phone number to transfer to during these hours
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface AgentFallbackRule {
  enabled: boolean
  timeoutSeconds: number // How long to wait before falling back to agent
}

export interface AgentRules {
  timeBasedRouting: TimeBasedRule
  agentFallback: AgentFallbackRule
}

// Default rules
export const defaultAgentRules: AgentRules = {
  timeBasedRouting: {
    enabled: false,
    schedules: [],
  },
  agentFallback: {
    enabled: false,
    timeoutSeconds: 30,
  },
}

