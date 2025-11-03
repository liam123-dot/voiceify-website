"use client"

import * as React from "react"
import { format } from "date-fns"
import { LineChart } from "@/components/ui/LineChart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  KnowledgeEvent,
  groupLatenciesByWindow,
  calculateLatencyMetrics,
  BUCKET_SIZES,
  LOOKBACK_PERIODS,
  LatencyMetrics
} from "@/lib/percentile-utils"

export const description = "Latency percentiles chart"

interface ChartLatencyPercentilesProps {
  events: KnowledgeEvent[]
  bucketSize: string
  lookbackPeriod: string
  selectedTab: 'overall' | 'supabase' | 'embedding'
  onBucketSizeChange: (size: string) => void
  onLookbackPeriodChange: (period: string) => void
  onTabChange: (tab: 'overall' | 'supabase' | 'embedding') => void
}

type LatencyType = 'overall' | 'supabase' | 'embedding'

const LATENCY_FIELD_MAP: Record<LatencyType, 'latency_ms' | 'embedding_latency_ms' | 'supabase_query_latency_ms'> = {
  overall: 'latency_ms',
  supabase: 'supabase_query_latency_ms',
  embedding: 'embedding_latency_ms'
}

const LATENCY_LABELS: Record<LatencyType, string> = {
  overall: 'Overall Latency',
  supabase: 'Supabase Query Latency',
  embedding: 'Embedding Latency'
}

export function ChartLatencyPercentiles({
  events,
  bucketSize,
  lookbackPeriod,
  selectedTab,
  onBucketSizeChange,
  onLookbackPeriodChange,
  onTabChange,
}: ChartLatencyPercentilesProps) {
  const processChartData = React.useMemo(() => {
    const bucket = BUCKET_SIZES[bucketSize] || BUCKET_SIZES['5min']
    const period = LOOKBACK_PERIODS[lookbackPeriod] || LOOKBACK_PERIODS['12h']
    const latencyField = LATENCY_FIELD_MAP[selectedTab]
    
    // Group latencies by time buckets
    const buckets = groupLatenciesByWindow(events, bucketSize, lookbackPeriod, latencyField)
    
    // Create a full range of time buckets
    const now = new Date()
    const startTime = new Date(now.getTime() - period.hours * 60 * 60 * 1000)
    const bucketMs = bucket.minutes * 60 * 1000
    
    // Round start time down to nearest bucket
    const startBucket = new Date(Math.floor(startTime.getTime() / bucketMs) * bucketMs)
    
    // Calculate metrics for each bucket
    const chartData: Array<{
      date: string
      Min: number
      p50: number
      p95: number
      p99: number
      Average: number
      Max: number
    }> = []
    
    // Generate all time buckets in range
    let currentBucket = new Date(startBucket)
    while (currentBucket <= now) {
      const bucketKey = currentBucket.toISOString()
      const latencies = buckets.get(bucketKey)
      const metrics = latencies ? calculateLatencyMetrics(latencies) : null
      
      let formattedDate: string
      if (bucket.minutes < 60) {
        formattedDate = format(currentBucket, 'MMM d, HH:mm')
      } else if (bucket.minutes < 1440) {
        formattedDate = format(currentBucket, 'MMM d, HH:mm')
      } else {
        formattedDate = format(currentBucket, 'MMM d')
      }
      
      chartData.push({
        date: formattedDate,
        Min: metrics?.min || 0,
        p50: metrics?.p50 || 0,
        p95: metrics?.p95 || 0,
        p99: metrics?.p99 || 0,
        Average: metrics?.avg || 0,
        Max: metrics?.max || 0,
      })
      
      currentBucket = new Date(currentBucket.getTime() + bucketMs)
    }
    
    return chartData
  }, [events, bucketSize, lookbackPeriod, selectedTab])

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Knowledge Latency</CardTitle>
              <CardDescription>
                {LATENCY_LABELS[selectedTab]} - {BUCKET_SIZES[bucketSize]?.label} buckets over {LOOKBACK_PERIODS[lookbackPeriod]?.label.toLowerCase()}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Bucket:</span>
              <Select value={bucketSize} onValueChange={onBucketSizeChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5min">5 minutes</SelectItem>
                  <SelectItem value="15min">15 minutes</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="1d">1 day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Period:</span>
              <Select value={lookbackPeriod} onValueChange={onLookbackPeriodChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last hour</SelectItem>
                  <SelectItem value="12h">Last 12 hours</SelectItem>
                  <SelectItem value="1d">Last 24 hours</SelectItem>
                  <SelectItem value="3d">Last 3 days</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <Tabs value={selectedTab} onValueChange={(value) => onTabChange(value as LatencyType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="embedding">Embedding</TabsTrigger>
            <TabsTrigger value="supabase">Supabase</TabsTrigger>
          </TabsList>
          
          <TabsContent value={selectedTab} className="mt-0">
            <LineChart
              className="h-[300px]"
              data={processChartData}
              index="date"
              categories={["Min", "p50", "p95", "p99", "Average", "Max"]}
              colors={["cyan", "blue", "violet", "fuchsia", "amber", "pink"]}
              valueFormatter={(value: number) => `${value.toFixed(2)}ms`}
              yAxisWidth={80}
              showLegend={true}
              showGridLines={true}
              autoMinValue={true}
              connectNulls={false}
              showXAxis={true}
              showYAxis={true}
              tickGap={32}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

