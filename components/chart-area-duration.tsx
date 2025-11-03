"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
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
import type { Call } from "@/types/call-events"

export const description = "An interactive call duration chart"

// Format duration from minutes to readable format
function formatDurationFromMinutes(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  
  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
  
  return parts.join(' ')
}

const chartConfig = {
  duration: {
    label: "Duration",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

interface ChartAreaDurationProps {
  calls: Call[]
  timeRange: string
  groupBy: 'day' | 'hour'
  onTimeRangeChange: (range: string) => void
  onGroupByChange: (groupBy: 'day' | 'hour') => void
}

export function ChartAreaDuration({
  calls,
  timeRange,
  groupBy,
  onTimeRangeChange,
  onGroupByChange,
}: ChartAreaDurationProps) {
  const processChartData = React.useMemo(() => {
    // Filter calls by time range
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

    const filteredCalls = calls.filter(call => 
      isAfter(new Date(call.created_at), startDate)
    )

    // Group calls by day or hour and sum durations
    const grouped = new Map<string, number>()

    filteredCalls.forEach(call => {
      const callDate = new Date(call.created_at)
      let key: string
      
      if (groupBy === 'hour') {
        key = startOfHour(callDate).toISOString()
      } else {
        key = startOfDay(callDate).toISOString()
      }
      
      // Sum duration in minutes, only if duration_seconds is available
      const durationMinutes = call.duration_seconds ? call.duration_seconds / 60 : 0
      grouped.set(key, (grouped.get(key) || 0) + durationMinutes)
    })

    // Fill in all periods with data (0 if no calls)
    const filledData: Array<{ date: string; duration: number }> = []
    let currentDate = new Date(normalizedStart)

    while (currentDate <= normalizedEnd) {
      const key = currentDate.toISOString()
      
      filledData.push({
        date: key,
        duration: grouped.get(key) || 0,
      })

      if (groupBy === 'hour') {
        currentDate = new Date(currentDate.getTime() + 60 * 60 * 1000)
      } else {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }

    return filledData
  }, [calls, timeRange, groupBy])

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
        <CardTitle>Call Duration</CardTitle>
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
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={processChartData}>
            <defs>
              <linearGradient id="fillDuration" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-duration)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-duration)"
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
                  formatter={(value) => formatDurationFromMinutes(Number(value))}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="duration"
              type="monotone"
              fill="url(#fillDuration)"
              stroke="var(--color-duration)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

