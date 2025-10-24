'use client'

import { useQuery } from '@tanstack/react-query'
import { IconDeviceMobile } from '@tabler/icons-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { AddPhoneNumberButton } from './add-phone-number-button'
import { DeletePhoneNumberButton } from './delete-phone-number-button'

type PhoneNumber = {
  id: string
  phone_number: string
  provider: string
  friendly_name: string | null
  status: string
  created_at: string
  agent: {
    id: string
    name: string
  } | null
}

interface PhoneNumbersResponse {
  phoneNumbers: PhoneNumber[]
}

interface PhoneNumbersContainerProps {
  organizationSlug: string
}

export function PhoneNumbersContainer({ organizationSlug }: PhoneNumbersContainerProps) {
  // Fetch phone numbers with React Query
  const { data, isLoading, refetch } = useQuery<PhoneNumbersResponse>({
    queryKey: ['phone-numbers', organizationSlug],
    queryFn: async () => {
      const response = await fetch(`/api/${organizationSlug}/phone-numbers`)
      if (!response.ok) {
        throw new Error('Failed to fetch phone numbers')
      }
      return response.json()
    },
  })

  const phoneNumbers = data?.phoneNumbers || []

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">Phone Number</TableHead>
                  <TableHead className="font-semibold">Provider</TableHead>
                  <TableHead className="font-semibold">Friendly Name</TableHead>
                  <TableHead className="font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Added</TableHead>
                  <TableHead className="text-right font-semibold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-8 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    )
  }

  if (phoneNumbers.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconDeviceMobile />
            </EmptyMedia>
            <EmptyTitle>No Phone Numbers Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t added any phone numbers yet. Get started by adding
              your first phone number from a provider like Twilio.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddPhoneNumberButton slug={organizationSlug} onSuccess={() => refetch()} />
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {phoneNumbers.length} {phoneNumbers.length === 1 ? 'number' : 'numbers'}
          </p>
          <AddPhoneNumberButton slug={organizationSlug} onSuccess={() => refetch()} />
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Phone Number</TableHead>
                <TableHead className="font-semibold">Provider</TableHead>
                <TableHead className="font-semibold">Friendly Name</TableHead>
                <TableHead className="font-semibold">Agent</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Added</TableHead>
                <TableHead className="text-right font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.map((number) => (
                <TableRow key={number.id} className="hover:bg-muted/30 group">
                  <TableCell className="font-medium text-sm">
                    {number.phone_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {number.provider}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {number.friendly_name || '—'}
                  </TableCell>
                  <TableCell>
                    {number.agent ? (
                      <Badge variant="secondary" className="text-xs">
                        {number.agent.name}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground opacity-50">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={number.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {number.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(number.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeletePhoneNumberButton 
                      phoneNumberId={number.id}
                      phoneNumber={number.phone_number}
                      slug={organizationSlug}
                      onSuccess={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

