"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts"
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

export const description = "A segmented bar chart showing call duration by organization"

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

interface CallWithOrg {
  id: string
  created_at: string
  duration_seconds: number | null
  status: string
  organization_id: string
  organization_slug: string
}

interface ChartBarDurationSegmentedProps {
  calls: CallWithOrg[]
  timeRange: string
  groupBy: 'day' | 'hour'
  onTimeRangeChange: (range: string) => void
  onGroupByChange: (groupBy: 'day' | 'hour') => void
}

// Generate colors for organizations
const generateColor = (index: number, total: number) => {
  const hue = (index * 360) / total
  return `hsl(${hue}, 70%, 50%)`
}

export function ChartBarDurationSegmented({
  calls,
  timeRange,
  groupBy,
  onTimeRangeChange,
  onGroupByChange,
}: ChartBarDurationSegmentedProps) {
  const { processChartData, chartConfig, organizations } = React.useMemo(() => {
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

    // Get unique organizations
    const uniqueOrgs = Array.from(new Set(filteredCalls.map(call => call.organization_slug)))
    
    // Create chart config with colors for each org
    const config: ChartConfig = {}
    uniqueOrgs.forEach((org, index) => {
      config[org] = {
        label: org,
        color: generateColor(index, uniqueOrgs.length),
      }
    })

    // Group calls by date and organization, summing durations
    const grouped = new Map<string, Record<string, number>>()

    filteredCalls.forEach(call => {
      const callDate = new Date(call.created_at)
      let key: string
      
      if (groupBy === 'hour') {
        key = startOfHour(callDate).toISOString()
      } else {
        key = startOfDay(callDate).toISOString()
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, {})
      }
      
      const dateData = grouped.get(key)!
      // Sum duration in minutes, only if duration_seconds is available
      const durationMinutes = call.duration_seconds ? call.duration_seconds / 60 : 0
      dateData[call.organization_slug] = (dateData[call.organization_slug] || 0) + durationMinutes
    })

    // Fill in all periods with data (0 if no calls)
    const filledData: Array<{ date: string; [key: string]: number | string }> = []
    let currentDate = new Date(normalizedStart)

    while (currentDate <= normalizedEnd) {
      const key = currentDate.toISOString()
      const dataPoint: { date: string; [key: string]: number | string } = { date: key }
      
      // Add data for each organization
      uniqueOrgs.forEach(org => {
        dataPoint[org] = grouped.get(key)?.[org] || 0
      })
      
      filledData.push(dataPoint)

      if (groupBy === 'hour') {
        currentDate = new Date(currentDate.getTime() + 60 * 60 * 1000)
      } else {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }

    return { processChartData: filledData, chartConfig: config, organizations: uniqueOrgs }
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
        <CardTitle>Call Duration by Organization</CardTitle>
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
          <BarChart data={processChartData}>
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
              tickFormatter={(value) => `${Math.round(Number(value))}m`}
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
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {formatDurationFromMinutes(Number(value))}
                      </span>
                    </div>
                  )}
                  indicator="dot"
                />
              }
            />
            <Legend />
            {organizations.map((org) => (
              <Bar
                key={org}
                dataKey={org}
                stackId="a"
                fill={`var(--color-${org})`}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

