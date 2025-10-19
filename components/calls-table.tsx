'use client'

import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Call, CallStatus } from '@/types/call-events'
import { PhoneIcon, ClockIcon } from 'lucide-react'
import { CallDetailSheet } from './call-detail-sheet'

interface CallsTableProps {
  calls: (Call & { agents?: { name: string } })[]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getStatusColor(status: CallStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 text-green-700 border-green-500/20'
    case 'connected_to_agent':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
    case 'transferred_to_team':
      return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20'
    case 'incoming':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    case 'failed':
      return 'bg-red-500/10 text-red-700 border-red-500/20'
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
  }
}

function getStatusLabel(status: CallStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'connected_to_agent':
      return 'In Progress'
    case 'transferred_to_team':
      return 'Transferred'
    case 'incoming':
      return 'Incoming'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

export function CallsTable({ calls }: CallsTableProps) {
  const [selectedCall, setSelectedCall] = useState<(Call & { agents?: { name: string } }) | null>(null)

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No calls yet. Your calls will appear here.
                </TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow
                  key={call.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedCall(call)}
                >
                  <TableCell className="font-medium">
                    {call.agents?.name || 'Unknown Agent'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="size-3.5 text-muted-foreground" />
                      {call.caller_phone_number}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(call.status)}>
                      {getStatusLabel(call.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ClockIcon className="size-3.5 text-muted-foreground" />
                      {formatDuration(call.duration_seconds)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(call.created_at), 'd MMM, HH:mm')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CallDetailSheet
        call={selectedCall}
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
      />
    </>
  )
}

