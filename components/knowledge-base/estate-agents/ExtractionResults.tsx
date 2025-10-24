'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IconLoader2, IconCopy, IconCheck, IconTrash, IconDownload, IconClock } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import type { CustomExtraction, ExtractionResult, AggregatedResults } from '@/types/extractions'

interface ExtractionResultsProps {
  slug: string
  knowledgeBaseId: string
  extraction: CustomExtraction
  onDelete: () => void
}

export function ExtractionResults({
  slug,
  knowledgeBaseId,
  extraction,
  onDelete,
}: ExtractionResultsProps) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Fetch results
  const { data, isLoading } = useQuery({
    queryKey: ['extraction-results', slug, knowledgeBaseId, extraction.id, extraction.status],
    queryFn: async () => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/extractions/${extraction.id}/results`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch results')
      }
      return response.json() as Promise<{
        results: ExtractionResult[]
        aggregated: AggregatedResults
      }>
    },
    // Always enabled to show partial results
    refetchInterval: extraction.status === 'processing' || extraction.status === 'pending' ? 3000 : false,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/extractions/${extraction.id}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete extraction')
      }
    },
    onSuccess: () => {
      toast.success('Extraction deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['extractions', slug, knowledgeBaseId] })
      onDelete()
    },
    onError: (error) => {
      console.error('Error deleting extraction:', error)
      toast.error('Failed to delete extraction')
    },
  })

  const handleCopyAll = async () => {
    if (!data?.aggregated.uniqueValues) return

    const uniqueValuesList = Object.entries(data.aggregated.uniqueValues)
      .sort(([, a], [, b]) => b - a)
      .map(([value]) => value)
      .join('\n')

    try {
      await navigator.clipboard.writeText(uniqueValuesList)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleDownloadCSV = () => {
    if (!data?.aggregated.byProperty) return

    const headers = ['Property Name', 'Property ID', 'Extracted Data']
    const rows = data.aggregated.byProperty.map((item) => [
      item.propertyName,
      item.propertyId,
      Array.isArray(item.extractedData) ? item.extractedData.join('; ') : JSON.stringify(item.extractedData),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${extraction.name.replace(/[^a-z0-9]/gi, '_')}_results.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Downloaded CSV')
  }

  const progress =
    extraction.total_items > 0
      ? ((extraction.processed_items + extraction.failed_items) / extraction.total_items) * 100
      : 0

  const isProcessing = extraction.status === 'processing' || extraction.status === 'pending'
  
  // Check if extraction has been running for more than 1 minute
  const extractionAge = new Date().getTime() - new Date(extraction.created_at).getTime()
  const isStale = isProcessing && extractionAge > 60_000 && extraction.processed_items === 0
  
  // Retry mutation for stale extractions
  const retryMutation = useMutation({
    mutationFn: async () => {
      // Delete the old extraction and trigger a new one
      await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/extractions/${extraction.id}`,
        { method: 'DELETE' }
      )
      // The parent component will handle creating a new extraction
    },
    onSuccess: () => {
      toast.success('Extraction cancelled. Please start a new one.')
      queryClient.invalidateQueries({ queryKey: ['extractions', slug, knowledgeBaseId] })
      onDelete()
    },
    onError: (error) => {
      console.error('Error cancelling extraction:', error)
      toast.error('Failed to cancel extraction')
    },
  })

  return (
    <div className="space-y-6">
      {/* Extraction Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {extraction.model.split('/')[1]}
              </Badge>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {extraction.processed_items + extraction.failed_items}/{extraction.total_items} properties
              </span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {new Date(extraction.created_at).toLocaleDateString()}
              </span>
            </div>
            {isProcessing && (
              <Progress value={progress} className="h-2 w-[300px]" />
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <IconTrash className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        {extraction.failed_items > 0 && (
          <Badge variant="destructive">{extraction.failed_items} failed</Badge>
        )}
      </div>

      {/* Stale Extraction Warning */}
      {isStale && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <IconClock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Extraction Taking Longer Than Expected
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                This extraction has been running for over 1 minute with no results. This might indicate an issue.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="w-full"
          >
            {retryMutation.isPending ? 'Cancelling...' : 'Cancel & Retry'}
          </Button>
        </div>
      )}

      {/* Initial Loading State (only show if no data yet) */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Processing Banner (show while processing but also show results below) */}
      {isProcessing && data && data.results.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <IconLoader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Extraction in progress...
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Showing {data.results.length} of {extraction.total_items} properties processed so far
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results - Show as soon as we have any data */}
      {data && data.results.length > 0 && (
        <>
          {/* Aggregated Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Aggregated Results</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyAll} disabled={copied}>
                  {copied ? (
                    <>
                      <IconCheck className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <IconCopy className="h-4 w-4 mr-2" />
                      Copy All
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </div>

            {Object.keys(data.aggregated.uniqueValues).length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No unique values extracted
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Value</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(data.aggregated.uniqueValues)
                      .sort(([, a], [, b]) => b - a)
                      .map(([value, count]) => {
                        const percentage = ((count / extraction.total_items) * 100).toFixed(1)
                        return (
                          <TableRow key={value}>
                            <TableCell className="font-medium">{value}</TableCell>
                            <TableCell className="text-right">{count}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {percentage}%
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Individual Property Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Individual Property Results</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Extracted Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.aggregated.byProperty.map((item) => (
                    <TableRow key={item.propertyId}>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        {item.propertyName}
                      </TableCell>
                      <TableCell>
                        {Array.isArray(item.extractedData) ? (
                          <div className="flex flex-wrap gap-1">
                            {item.extractedData.map((value, idx) => (
                              <Badge key={idx} variant="secondary">
                                {String(value)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <code className="text-xs">{JSON.stringify(item.extractedData)}</code>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                          Completed
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Extraction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{extraction.name}&quot; and all its results. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

