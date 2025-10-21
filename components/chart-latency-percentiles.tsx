"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { format } from "date-fns"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
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

const chartConfig = {
  p50: {
    label: "p50",
    color: "hsl(var(--chart-1))",
  },
  p95: {
    label: "p95",
    color: "hsl(var(--chart-2))",
  },
  p99: {
    label: "p99",
    color: "hsl(var(--chart-3))",
  },
  avg: {
    label: "Average",
    color: "hsl(var(--chart-4))",
  },
  max: {
    label: "Max",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

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
    
    // Calculate metrics for each bucket
    const chartData: Array<{
      date: string
      p50: number
      p95: number
      p99: number
      avg: number
      max: number
    }> = []
    
    // Only include periods with actual data (no gaps with nulls)
    const sortedBuckets = Array.from(buckets.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    
    sortedBuckets.forEach(([bucketKey, latencies]) => {
      const metrics = calculateLatencyMetrics(latencies)
      
      if (metrics) {
        chartData.push({
          date: bucketKey,
          p50: metrics.p50,
          p95: metrics.p95,
          p99: metrics.p99,
          avg: metrics.avg,
          max: metrics.max,
        })
      }
    })
    
    return chartData
  }, [events, bucketSize, lookbackPeriod, selectedTab])

  const formatXAxis = (value: string) => {
    const date = new Date(value)
    const bucket = BUCKET_SIZES[bucketSize] || BUCKET_SIZES['5min']
    
    if (bucket.minutes < 60) {
      return format(date, 'HH:mm')
    } else if (bucket.minutes < 1440) {
      return format(date, 'MMM d HH:mm')
    } else {
      return format(date, 'MMM d')
    }
  }

  const formatTooltipLabel = (value: string) => {
    const date = new Date(value)
    const bucket = BUCKET_SIZES[bucketSize] || BUCKET_SIZES['5min']
    
    if (bucket.minutes < 60) {
      return format(date, 'MMM d, HH:mm')
    } else if (bucket.minutes < 1440) {
      return format(date, 'MMM d, HH:mm')
    } else {
      return format(date, 'MMM d, yyyy')
    }
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Knowledge Retrieval Latency Percentiles</CardTitle>
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
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[300px] w-full"
            >
              <AreaChart
                accessibilityLayer
                data={processChartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={formatXAxis}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={formatTooltipLabel}
                      indicator="dot"
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  dataKey="max"
                  type="natural"
                  fill="var(--color-max)"
                  fillOpacity={0.1}
                  stroke="var(--color-max)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <Area
                  dataKey="p99"
                  type="natural"
                  fill="var(--color-p99)"
                  fillOpacity={0.2}
                  stroke="var(--color-p99)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="p95"
                  type="natural"
                  fill="var(--color-p95)"
                  fillOpacity={0.3}
                  stroke="var(--color-p95)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="avg"
                  type="natural"
                  fill="var(--color-avg)"
                  fillOpacity={0.2}
                  stroke="var(--color-avg)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
                <Area
                  dataKey="p50"
                  type="natural"
                  fill="var(--color-p50)"
                  fillOpacity={0.4}
                  stroke="var(--color-p50)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

