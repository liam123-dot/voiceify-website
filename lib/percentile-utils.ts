export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export interface LatencyMetrics {
  count: number
  min: number
  p50: number
  p95: number
  p99: number
  avg: number
  max: number
}

export function calculateLatencyMetrics(latencies: number[]): LatencyMetrics | null {
  if (latencies.length === 0) return null
  
  return {
    count: latencies.length,
    min: Math.min(...latencies),
    p50: calculatePercentile(latencies, 50),
    p95: calculatePercentile(latencies, 95),
    p99: calculatePercentile(latencies, 99),
    avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    max: Math.max(...latencies)
  }
}

export interface KnowledgeEvent {
  id: string
  time: string
  data: {
    data?: {
      latency_ms?: number
      embedding_latency_ms?: number
      supabase_query_latency_ms?: number
    }
  }
}

export interface ConversationEvent {
  id: string
  time: string
  data: {
    totalLatency?: number
    eouDelay?: number
    llmTtft?: number
    ttsTtfb?: number
  }
}

export const BUCKET_SIZES: Record<string, { minutes: number; label: string }> = {
  '5min': { minutes: 5, label: '5 minutes' },
  '15min': { minutes: 15, label: '15 minutes' },
  '1h': { minutes: 60, label: '1 hour' },
  '6h': { minutes: 360, label: '6 hours' },
  '1d': { minutes: 1440, label: '1 day' }
}

export const LOOKBACK_PERIODS: Record<string, { hours: number; label: string }> = {
  '1h': { hours: 1, label: 'Last hour' },
  '12h': { hours: 12, label: 'Last 12 hours' },
  '1d': { hours: 24, label: 'Last 24 hours' },
  '3d': { hours: 72, label: 'Last 3 days' },
  '7d': { hours: 168, label: 'Last 7 days' }
}

export function groupLatenciesByWindow(
  events: KnowledgeEvent[],
  bucketSize: string,
  lookbackPeriod: string,
  latencyField: 'latency_ms' | 'embedding_latency_ms' | 'supabase_query_latency_ms'
): Map<string, number[]> {
  const bucket = BUCKET_SIZES[bucketSize] || BUCKET_SIZES['5min']
  const period = LOOKBACK_PERIODS[lookbackPeriod] || LOOKBACK_PERIODS['12h']
  const now = new Date()
  const startTime = new Date(now.getTime() - period.hours * 60 * 60 * 1000)
  
  // Create buckets
  const buckets = new Map<string, number[]>()
  const bucketMs = bucket.minutes * 60 * 1000
  
  // Filter events within time window
  const filteredEvents = events.filter(event => {
    const eventTime = new Date(event.time)
    return eventTime >= startTime && eventTime <= now
  })
  
  // Group events into buckets
  filteredEvents.forEach(event => {
    const eventTime = new Date(event.time)
    const bucketTime = new Date(Math.floor(eventTime.getTime() / bucketMs) * bucketMs)
    const bucketKey = bucketTime.toISOString()
    
    const latency = event.data?.data?.[latencyField]
    if (latency !== undefined && latency > 0) {
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, [])
      }
      buckets.get(bucketKey)!.push(latency)
    }
  })
  
  return buckets
}

export function groupConversationLatenciesByWindow(
  events: ConversationEvent[],
  bucketSize: string,
  lookbackPeriod: string,
  latencyField: 'totalLatency' | 'eouDelay' | 'llmTtft' | 'ttsTtfb'
): Map<string, number[]> {
  const bucket = BUCKET_SIZES[bucketSize] || BUCKET_SIZES['5min']
  const period = LOOKBACK_PERIODS[lookbackPeriod] || LOOKBACK_PERIODS['12h']
  const now = new Date()
  const startTime = new Date(now.getTime() - period.hours * 60 * 60 * 1000)
  
  // Create buckets
  const buckets = new Map<string, number[]>()
  const bucketMs = bucket.minutes * 60 * 1000
  
  // Filter events within time window
  const filteredEvents = events.filter(event => {
    const eventTime = new Date(event.time)
    return eventTime >= startTime && eventTime <= now
  })
  
  // Group events into buckets
  filteredEvents.forEach(event => {
    const eventTime = new Date(event.time)
    const bucketTime = new Date(Math.floor(eventTime.getTime() / bucketMs) * bucketMs)
    const bucketKey = bucketTime.toISOString()
    
    const latency = event.data?.[latencyField]
    // Convert from seconds to milliseconds for consistency with knowledge latency
    if (latency !== undefined && latency > 0) {
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, [])
      }
      // Store as milliseconds for display consistency
      buckets.get(bucketKey)!.push(latency * 1000)
    }
  })
  
  return buckets
}

