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
    // Fetch all metrics events for this call
    const { data: metricsEvents, error: metricsError } = await supabase
      .from('agent_events')
      .select('data')
      .eq('call_id', callId)
      .in('event_type', ['metrics_collected', 'total_latency'])

    if (metricsError) {
      console.error('Error fetching metrics events:', metricsError)
      return null
    }

    if (!metricsEvents || metricsEvents.length === 0) {
      return null
    }

    // Collect latency values by type
    const eouValues: number[] = []
    const llmValues: number[] = []
    const ttsValues: number[] = []
    const totalValues: number[] = []

    metricsEvents.forEach((event) => {
      const data = event.data as Record<string, unknown>
      const metricType = data.metricType as string | undefined

      if (metricType === 'eou' && typeof data.endOfUtteranceDelay === 'number') {
        eouValues.push(data.endOfUtteranceDelay)
      } else if (metricType === 'llm' && typeof data.ttft === 'number') {
        llmValues.push(data.ttft)
      } else if (metricType === 'tts' && typeof data.ttfb === 'number') {
        ttsValues.push(data.ttfb)
      } else if (metricType === 'total_latency' && typeof data.totalLatency === 'number') {
        totalValues.push(data.totalLatency)
      }
    })

    // Calculate statistics for each metric type
    return {
      eou: calculateStats(eouValues),
      llm: calculateStats(llmValues),
      tts: calculateStats(ttsValues),
      total: calculateStats(totalValues),
    }
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

    const { user, organizationId } = await getAuthSession(slug)

    if (!user || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the call belongs to the user's organization
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, organization_id')
      .eq('id', callId)
      .eq('organization_id', organizationId)
      .single()

    if (callError || !call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (call.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Calculate latency statistics
    const stats = await calculateLatencyStats(callId, supabase)

    if (!stats) {
      return NextResponse.json(
        { error: 'No metrics data available for this call' },
        { status: 404 }
      )
    }

    // Check if we have any data at all
    if (!stats.eou && !stats.llm && !stats.tts && !stats.total) {
      return NextResponse.json(
        { error: 'Insufficient metrics data to calculate statistics' },
        { status: 404 }
      )
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error in GET /api/[slug]/calls/[callId]/latency-stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

