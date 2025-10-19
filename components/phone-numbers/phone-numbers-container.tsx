'use client'

import { useQuery } from '@tanstack/react-query'
import { IconDeviceMobile } from '@tabler/icons-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading phone numbers...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phoneNumbers.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="p-6">
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
                <AddPhoneNumberButton onSuccess={() => refetch()} />
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Phone Numbers</CardTitle>
              <CardDescription>
                {phoneNumbers.length} {phoneNumbers.length === 1 ? 'number' : 'numbers'} · Manage your phone numbers from various providers
              </CardDescription>
            </div>
            <AddPhoneNumberButton onSuccess={() => refetch()} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Friendly Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.map((number) => (
                <TableRow key={number.id}>
                  <TableCell className="font-medium">
                    {number.phone_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {number.provider}
                    </Badge>
                  </TableCell>
                  <TableCell>{number.friendly_name || '-'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={number.status === 'active' ? 'default' : 'secondary'}
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
                      onSuccess={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

