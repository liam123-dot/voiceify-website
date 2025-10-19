'use client'

import { useMemo } from 'react'
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { subDays, subHours, isAfter } from "date-fns"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Call } from "@/types/call-events"

interface SectionCardsProps {
  calls: Call[]
  timeRange: string
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (mins > 0) parts.push(`${mins}m`)
  if (secs > 0) parts.push(`${secs}s`)
  
  return parts.length > 0 ? parts.join(' ') : '0s'
}

export function SectionCards({ calls, timeRange }: SectionCardsProps) {
  const metrics = useMemo(() => {
    // Filter calls by time range
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date
    
    if (timeRange === "24h") {
      startDate = subHours(now, 24)
      previousStartDate = subHours(now, 48)
    } else if (timeRange === "7d") {
      startDate = subDays(now, 7)
      previousStartDate = subDays(now, 14)
    } else if (timeRange === "30d") {
      startDate = subDays(now, 30)
      previousStartDate = subDays(now, 60)
    } else {
      startDate = subDays(now, 90)
      previousStartDate = subDays(now, 180)
    }

    const currentCalls = calls.filter(call => 
      isAfter(new Date(call.created_at), startDate)
    )
    
    const previousCalls = calls.filter(call => {
      const callDate = new Date(call.created_at)
      return isAfter(callDate, previousStartDate) && !isAfter(callDate, startDate)
    })

    // Total calls
    const totalCalls = currentCalls.length
    const previousTotalCalls = previousCalls.length
    const callsChange = previousTotalCalls > 0 
      ? ((totalCalls - previousTotalCalls) / previousTotalCalls) * 100 
      : (totalCalls > 0 ? 100 : 0)

    // Average call duration
    const callsWithDuration = currentCalls.filter(call => call.duration_seconds !== null && call.duration_seconds > 0)
    const avgDuration = callsWithDuration.length > 0
      ? callsWithDuration.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / callsWithDuration.length
      : 0
    
    const prevCallsWithDuration = previousCalls.filter(call => call.duration_seconds !== null && call.duration_seconds > 0)
    const prevAvgDuration = prevCallsWithDuration.length > 0
      ? prevCallsWithDuration.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) / prevCallsWithDuration.length
      : 0
    
    const avgDurationChange = prevAvgDuration > 0
      ? ((avgDuration - prevAvgDuration) / prevAvgDuration) * 100
      : (avgDuration > 0 ? 100 : 0)

    // Total call duration
    const totalDuration = callsWithDuration.reduce((sum, call) => sum + (call.duration_seconds || 0), 0)
    const prevTotalDuration = prevCallsWithDuration.reduce((sum, call) => sum + (call.duration_seconds || 0), 0)
    const totalDurationChange = prevTotalDuration > 0
      ? ((totalDuration - prevTotalDuration) / prevTotalDuration) * 100
      : (totalDuration > 0 ? 100 : 0)

    return {
      totalCalls,
      callsChange,
      avgDuration,
      avgDurationChange,
      totalDuration,
      totalDurationChange,
    }
  }, [calls, timeRange])

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Calls</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {metrics.totalCalls}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Average Call Length</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatDuration(Math.round(metrics.avgDuration))}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Call Time</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatDuration(Math.round(metrics.totalDuration))}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
