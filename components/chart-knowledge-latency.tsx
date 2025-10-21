"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Legend } from "recharts"
import { format, startOfHour, startOfDay, subDays, subHours, isAfter } from "date-fns"
import {
  Card,
  CardAction,
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
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export const description = "Knowledge retrieval latency chart"

const chartConfig = {
  latency: {
    label: "Total Latency",
    color: "var(--primary)",
  },
  embedding: {
    label: "Embedding Latency",
    color: "hsl(var(--chart-1))",
  },
  supabase: {
    label: "Supabase Query",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

interface KnowledgeEvent {
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

interface ChartKnowledgeLatencyProps {
  events: KnowledgeEvent[]
  timeRange: string
  groupBy: 'day' | 'hour'
  onTimeRangeChange: (range: string) => void
  onGroupByChange: (groupBy: 'day' | 'hour') => void
}

export function ChartKnowledgeLatency({
  events,
  timeRange,
  groupBy,
  onTimeRangeChange,
  onGroupByChange,
}: ChartKnowledgeLatencyProps) {
  const [showBreakdown, setShowBreakdown] = React.useState(false)

  const processChartData = React.useMemo(() => {
    // Filter events by time range
    const now = new Date()
    let startDate: Date
    
    if (timeRange === "24h") {
      startDate = subHours(now, 24)
    } else if (timeRange === "7d") {
      startDate = subDays(now, 7)
    } else if (timeRange === "30d") {
      startDate = subDays(now, 30)
    } else {
      startDate = subDays(now, 90)
    }

    // Normalize start and end dates to the beginning of their period
    const normalizedStart = groupBy === 'hour' ? startOfHour(startDate) : startOfDay(startDate)
    const normalizedEnd = groupBy === 'hour' ? startOfHour(now) : startOfDay(now)

    const filteredEvents = events.filter(event => 
      isAfter(new Date(event.time), startDate)
    )

    // Group events by day or hour and calculate average latency
    const grouped = new Map<string, { 
      totalLatency: number
      embeddingLatency: number
      supabaseLatency: number
      count: number
      embeddingCount: number
      supabaseCount: number
    }>()

    filteredEvents.forEach(event => {
      const eventDate = new Date(event.time)
      let key: string
      
      if (groupBy === 'hour') {
        key = startOfHour(eventDate).toISOString()
      } else {
        key = startOfDay(eventDate).toISOString()
      }
      
      const existing = grouped.get(key) || { 
        totalLatency: 0, 
        embeddingLatency: 0, 
        supabaseLatency: 0, 
        count: 0,
        embeddingCount: 0,
        supabaseCount: 0
      }
      
      // Extract latency values, handling cases where they might not exist
      const eventData = event.data?.data || {}
      const latency = eventData.latency_ms || 0
      const embeddingLatency = eventData.embedding_latency_ms
      const supabaseLatency = eventData.supabase_query_latency_ms
      
      // Debug log
      if (eventData.latency_ms) {
        console.log('Event data:', {
          latency: eventData.latency_ms,
          embedding: eventData.embedding_latency_ms,
          supabase: eventData.supabase_query_latency_ms
        })
      }
      
      grouped.set(key, {
        totalLatency: existing.totalLatency + latency,
        embeddingLatency: existing.embeddingLatency + (embeddingLatency || 0),
        supabaseLatency: existing.supabaseLatency + (supabaseLatency || 0),
        count: existing.count + (latency > 0 ? 1 : 0),
        embeddingCount: existing.embeddingCount + (embeddingLatency ? 1 : 0),
        supabaseCount: existing.supabaseCount + (supabaseLatency ? 1 : 0),
      })
    })

    // Fill in all periods with data (0 if no events for better chart rendering)
    const filledData: Array<{ 
      date: string
      latency: number
      embedding: number
      supabase: number
    }> = []
    let currentDate = new Date(normalizedStart)

    while (currentDate <= normalizedEnd) {
      const key = currentDate.toISOString()
      const data = grouped.get(key)
      
      if (data && data.count > 0) {
        const avgLatency = Math.round(data.totalLatency / data.count)
        const avgEmbedding = data.embeddingCount > 0 ? Math.round(data.embeddingLatency / data.embeddingCount) : 0
        const avgSupabase = data.supabaseCount > 0 ? Math.round(data.supabaseLatency / data.supabaseCount) : 0
        
        console.log('Data point:', { 
          date: key, 
          avgLatency, 
          avgEmbedding, 
          avgSupabase,
          embeddingCount: data.embeddingCount,
          supabaseCount: data.supabaseCount
        })
        
        filledData.push({
          date: key,
          latency: avgLatency,
          embedding: avgEmbedding,
          supabase: avgSupabase,
        })
      } else {
        filledData.push({
          date: key,
          latency: 0,
          embedding: 0,
          supabase: 0,
        })
      }

      if (groupBy === 'hour') {
        currentDate = new Date(currentDate.getTime() + 60 * 60 * 1000)
      } else {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }

    console.log('Chart data:', filledData.filter(d => d.latency > 0))
    return filledData
  }, [events, timeRange, groupBy])

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case "24h": return "Last 24 hours"
      case "7d": return "Last 7 days"
      case "30d": return "Last 30 days"
      case "90d": return "Last 3 months"
      default: return "Last 7 days"
    }
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Knowledge Retrieval Latency</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {getTimeRangeLabel()} grouped by {groupBy === 'hour' ? 'hour' : 'day'}
          </span>
          <span className="@[540px]/card:hidden">{getTimeRangeLabel()}</span>
        </CardDescription>
        <CardAction>
          <div className="flex gap-2">
            <ToggleGroup
              type="single"
              value={groupBy}
              onValueChange={(value) => value && onGroupByChange(value as 'day' | 'hour')}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-3 @[540px]/card:flex"
            >
              <ToggleGroupItem value="hour">Hours</ToggleGroupItem>
              <ToggleGroupItem value="day">Days</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={(value) => value && onTimeRangeChange(value)}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-3 @[767px]/card:flex"
            >
              <ToggleGroupItem value="24h">24h</ToggleGroupItem>
              <ToggleGroupItem value="7d">7d</ToggleGroupItem>
              <ToggleGroupItem value="30d">30d</ToggleGroupItem>
              <ToggleGroupItem value="90d">90d</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger
                className="flex w-36 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                size="sm"
                aria-label="Select time range"
              >
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="24h" className="rounded-lg">
                  Last 24 hours
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="90d" className="rounded-lg">
                  Last 3 months
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4 flex items-center gap-3">
          {/* <Switch
            id="breakdown-toggle"
            checked={showBreakdown}
            onCheckedChange={setShowBreakdown}
          />
          <Label htmlFor="breakdown-toggle" className="text-sm font-medium cursor-pointer">
            Show latency breakdown
          </Label> */}
        </div>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          {showBreakdown ? (
            <LineChart data={processChartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  if (groupBy === 'hour') {
                    return format(date, 'HH:mm')
                  }
                  return format(date, 'MMM d')
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${value}ms`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      const date = new Date(value)
                      if (groupBy === 'hour') {
                        return format(date, 'MMM d, HH:mm')
                      }
                      return format(date, 'MMM d, yyyy')
                    }}
                    indicator="line"
                  />
                }
              />
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="line"
              />
              <Line
                dataKey="embedding"
                type="monotone"
                stroke="var(--color-embedding)"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Embedding Latency"
              />
              <Line
                dataKey="supabase"
                type="monotone"
                stroke="var(--color-supabase)"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Supabase Query"
              />
            </LineChart>
          ) : (
            <AreaChart data={processChartData}>
              <defs>
                <linearGradient id="fillLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-latency)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-latency)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  if (groupBy === 'hour') {
                    return format(date, 'HH:mm')
                  }
                  return format(date, 'MMM d')
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      const date = new Date(value)
                      if (groupBy === 'hour') {
                        return format(date, 'MMM d, HH:mm')
                      }
                      return format(date, 'MMM d, yyyy')
                    }}
                    indicator="dot"
                    formatter={(value) => {
                      if (value === null) return 'No data'
                      return `${value}ms`
                    }}
                  />
                }
              />
              <Area
                dataKey="latency"
                type="monotone"
                fill="url(#fillLatency)"
                stroke="var(--color-latency)"
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

