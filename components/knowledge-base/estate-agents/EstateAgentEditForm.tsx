'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { IconLoader2 } from '@tabler/icons-react'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RightmoveAgentConfig } from '@/types/knowledge-base'

const estateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rentUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  saleUrl: z.string().url('Must be a valid URL').or(z.literal('')),
  syncSchedule: z.enum(['daily', 'weekly']),
}).refine((data) => data.rentUrl !== '' || data.saleUrl !== '', {
  message: 'At least one URL (rental or sale) is required',
  path: ['rentUrl'],
})

type EstateAgentFormValues = z.infer<typeof estateAgentSchema>

interface EstateAgentEditFormProps {
  slug: string
  knowledgeBaseId: string
  estateAgentId: string
  initialData: {
    name: string
    metadata?: RightmoveAgentConfig
  }
  onSuccess: () => void
}

export function EstateAgentEditForm({
  slug,
  knowledgeBaseId,
  estateAgentId,
  initialData,
  onSuccess,
}: EstateAgentEditFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const form = useForm<EstateAgentFormValues>({
    resolver: zodResolver(estateAgentSchema),
    defaultValues: {
      name: initialData.name,
      rentUrl: initialData.metadata?.rentUrl || '',
      saleUrl: initialData.metadata?.saleUrl || '',
      syncSchedule: initialData.metadata?.syncSchedule || 'daily',
    },
  })

  const handleSubmit = async (values: EstateAgentFormValues) => {
    try {
      setIsSubmitting(true)

      const metadata: Record<string, string> = {
        syncSchedule: values.syncSchedule,
      }
      if (values.rentUrl) metadata.rentUrl = values.rentUrl
      if (values.saleUrl) metadata.saleUrl = values.saleUrl

      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${estateAgentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: values.name,
            metadata,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update estate agent')
      }

      toast.success('Estate agent updated successfully')
      setIsEditing(false)
      onSuccess()
    } catch (error) {
      console.error('Error updating estate agent:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update estate agent')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estate Agent Configuration</span>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Name</p>
            <p className="text-sm">{initialData.name}</p>
          </div>
          {initialData.metadata?.rentUrl && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Rental Properties URL</p>
              <a
                href={initialData.metadata.rentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {initialData.metadata.rentUrl}
              </a>
            </div>
          )}
          {initialData.metadata?.saleUrl && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sale Properties URL</p>
              <a
                href={initialData.metadata.saleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {initialData.metadata.saleUrl}
              </a>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Sync Schedule</p>
            <p className="text-sm capitalize">{initialData.metadata?.syncSchedule || 'daily'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Estate Agent Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estate Agent Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Aston Gray Properties" {...field} />
                  </FormControl>
                  <FormDescription>A descriptive name for this estate agent</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rentUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rental Properties URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.rightmove.co.uk/property-to-rent/..." {...field} />
                  </FormControl>
                  <FormDescription>Rightmove URL for rental properties</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="saleUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Properties URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.rightmove.co.uk/property-for-sale/..." {...field} />
                  </FormControl>
                  <FormDescription>Rightmove URL for sale properties</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="syncSchedule"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sync Schedule</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sync frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Scheduling coming soon - this setting is saved for future use
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  form.reset()
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

