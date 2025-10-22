import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthSession } from '@/lib/auth'

interface LatencyStats {
  min: number
  p50: number
  p95: number
  p99: number
  avg: number
  max: number
  count: number
}

interface CallLatencyStatsData {
  eou: LatencyStats | null
  llm: LatencyStats | null
  tts: LatencyStats | null
  total: LatencyStats | null
}

// Helper function to calculate percentile
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

// Helper function to calculate stats from array
function calculateStats(values: number[]): LatencyStats | null {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    min: Math.min(...values),
    p50: calculatePercentile(values, 50),
    p95: calculatePercentile(values, 95),
    p99: calculatePercentile(values, 99),
    avg: sum / values.length,
    max: Math.max(...values),
    count: values.length,
  }
}

export async function calculateLatencyStats(
  callId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CallLatencyStatsData | null> {
  try {
    console.log(`[calculateLatencyStats] Starting latency stats calculation for call: ${callId}`)
    
    // Fetch all metrics events for this call
    const { data: metricsEvents, error: metricsError } = await supabase
      .from('agent_events')
      .select('data, event_type')
      .eq('call_id', callId)
      .in('event_type', ['metrics_collected', 'total_latency'])

    if (metricsError) {
      console.error('[calculateLatencyStats] Error fetching metrics events:', metricsError)
      return null
    }

    if (!metricsEvents || metricsEvents.length === 0) {
      console.log('[calculateLatencyStats] No metrics events found for this call')
      return null
    }

    console.log(`[calculateLatencyStats] Fetched ${metricsEvents.length} metrics events`)

    // Collect latency values by type
    const eouValues: number[] = []
    const llmValues: number[] = []
    const ttsValues: number[] = []
    const totalValues: number[] = []

    metricsEvents.forEach((event) => {
      const data = event.data as Record<string, unknown>
      console.log(`[calculateLatencyStats] event data: ${JSON.stringify(data, null, 2)}`)
      const metricType = data.metricType as string | undefined
      console.log(`[calculateLatencyStats] event type: ${event.event_type}`)

      if (event.event_type === 'metrics_collected') {
        // temporary if to print relevant data
        if (metricType === 'eou' || metricType === 'llm' || metricType === 'tts') {
          console.log(`[calculateLatencyStats] event data: ${JSON.stringify(data, null, 2)}`)
        }
        if (metricType === 'eou' && typeof data.endOfUtteranceDelay === 'number') {
          eouValues.push(data.endOfUtteranceDelay)
        } else if (metricType === 'llm' && typeof data.ttft === 'number') {
          llmValues.push(data.ttft)
        } else if (metricType === 'tts' && typeof data.ttfb === 'number') {
          ttsValues.push(data.ttfb)
        }
      }
      if (event.event_type === 'total_latency') {
        // temporary if to print relevant data
        if (metricType === 'total_latency') {
          console.log(`[calculateLatencyStats] event data: ${JSON.stringify(data, null, 2)}`)
        }
        if (metricType === 'total_latency' && typeof data.totalLatency === 'number') {
          totalValues.push(data.totalLatency)
        }
      }
    })

    console.log(`[calculateLatencyStats] Collected values - EOU: ${eouValues.length}, LLM: ${llmValues.length}, TTS: ${ttsValues.length}, Total: ${totalValues.length}`)

    // Calculate statistics for each metric type
    const stats = {
      eou: calculateStats(eouValues),
      llm: calculateStats(llmValues),
      tts: calculateStats(ttsValues),
      total: calculateStats(totalValues),
    }

    console.log('[calculateLatencyStats] Calculated stats:', JSON.stringify(stats, null, 2))
    
    return stats
  } catch (error) {
    console.error('Error calculating latency statistics:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; callId: string }> }
) {
  try {
    const supabase = await createClient()
    const { slug, callId } = await context.params

    console.log(`[GET /latency-stats] Request received - slug: ${slug}, callId: ${callId}`)

    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      console.log('[GET /latency-stats] Unauthorized - no user or organization')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`[GET /latency-stats] Authenticated - userId: ${user.id}, organizationId: ${organizationId}`)

    // Verify the call belongs to the user's organization
    console.log(`[GET /latency-stats] Verifying call access for callId: ${callId}`)
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      console.log('[GET /latency-stats] Call not found:', callError)
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    console.log(`[GET /latency-stats] Call found - id: ${call.id}, organization_id: ${call.organization_id}`)

    if (call.organization_id !== organizationId) {
      console.log('[GET /latency-stats] Unauthorized - organization mismatch')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Calculate latency statistics
    console.log(`[GET /latency-stats] Calculating latency statistics...`)
    const stats = await calculateLatencyStats(callId, supabase)

    if (!stats) {
      console.log('[GET /latency-stats] No metrics data available for this call')
      return NextResponse.json(
        { error: 'No metrics data available for this call' },
        { status: 404 }
      )
    }

    // Check if we have any data at all
    const hasData = stats.eou || stats.llm || stats.tts || stats.total
    const dataSummary = {
      hasEOU: !!stats.eou,
      hasLLM: !!stats.llm,
      hasTTS: !!stats.tts,
      hasTotal: !!stats.total,
      counts: {
        eou: stats.eou?.count || 0,
        llm: stats.llm?.count || 0,
        tts: stats.tts?.count || 0,
        total: stats.total?.count || 0,
      }
    }
    
    console.log('[GET /latency-stats] Stats summary:', JSON.stringify(dataSummary, null, 2))

    if (!hasData) {
      console.log('[GET /latency-stats] Insufficient metrics data to calculate statistics')
      return NextResponse.json(
        { error: 'Insufficient metrics data to calculate statistics' },
        { status: 404 }
      )
    }

    console.log(`[GET /latency-stats] Returning stats successfully`)
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error in GET /api/[slug]/calls/[callId]/latency-stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

