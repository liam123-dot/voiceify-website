'use client'

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { IconPlus, IconLoader2, IconInfoCircle } from "@tabler/icons-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SiteMapSelector } from "./SiteMapSelector"

const urlSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
})

const textSchema = z.object({
  name: z.string().min(1, "Name is required"),
  text_content: z.string().min(1, "Text content is required"),
})

const fileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  file: z.instanceof(File, { message: "File is required" }),
})

const rightmoveAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  rentUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  saleUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  syncSchedule: z.enum(["daily", "weekly"]).default("daily"),
}).refine((data) => data.rentUrl !== "" || data.saleUrl !== "", {
  message: "At least one URL (rental or sale) is required",
  path: ["rentUrl"],
})

interface KnowledgeBaseItem {
  id: string
  name: string
  type: string
  status: string
  url?: string
  text_content?: string
  file_location?: string
  parent_item_id?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  sync_error?: string | null
}

interface AddItemDialogProps {
  slug: string
  knowledgeBaseId: string
  onItemAdded: () => void
  editItem?: KnowledgeBaseItem | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddItemDialog({ 
  slug, 
  knowledgeBaseId, 
  onItemAdded,
  editItem = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: AddItemDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoadingSiteMap, setIsLoadingSiteMap] = useState(false)
  const [scrapedUrls, setScrapedUrls] = useState<string[]>([])
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])

  // Use controlled or uncontrolled state for dialog open
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  const isEditMode = !!editItem

  const urlForm = useForm({
    resolver: zodResolver(urlSchema),
    defaultValues: { name: "", url: "" },
  })

  const textForm = useForm({
    resolver: zodResolver(textSchema),
    defaultValues: { name: "", text_content: "" },
  })

  const fileForm = useForm({
    resolver: zodResolver(fileSchema),
    defaultValues: { name: "", file: undefined },
  })

  const rightmoveAgentForm = useForm({
    resolver: zodResolver(rightmoveAgentSchema),
    defaultValues: { name: "", rentUrl: "", saleUrl: "", syncSchedule: "daily" as const },
  })

  type UrlFormValues = z.infer<typeof urlSchema>
  type TextFormValues = z.infer<typeof textSchema>
  type FileFormValues = z.infer<typeof fileSchema>
  type RightmoveAgentFormValues = z.infer<typeof rightmoveAgentSchema>

  // Populate form when editItem changes
  React.useEffect(() => {
    if (editItem && editItem.type === 'rightmove_agent') {
      const metadata = editItem.metadata as { rentUrl?: string; saleUrl?: string; syncSchedule?: 'daily' | 'weekly' } | undefined
      rightmoveAgentForm.reset({
        name: editItem.name,
        rentUrl: metadata?.rentUrl || "",
        saleUrl: metadata?.saleUrl || "",
        syncSchedule: metadata?.syncSchedule || "daily",
      })
    }
  }, [editItem, rightmoveAgentForm])

  const handleSubmit = async (
    type: 'url' | 'text' | 'file' | 'rightmove_agent', 
    values: UrlFormValues | TextFormValues | FileFormValues | RightmoveAgentFormValues
  ) => {
    try {
      setIsSubmitting(true)
      
      // Handle rightmove_agent differently (JSON payload)
      if (type === 'rightmove_agent' && 'rentUrl' in values) {
        // Build metadata with only non-empty URLs
        const metadata: Record<string, string> = {
          syncSchedule: values.syncSchedule,
        }
        if (values.rentUrl) metadata.rentUrl = values.rentUrl
        if (values.saleUrl) metadata.saleUrl = values.saleUrl

        const url = isEditMode && editItem
          ? `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/${editItem.id}`
          : `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items`
        
        const method = isEditMode ? 'PATCH' : 'POST'

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'rightmove_agent',
            name: values.name,
            metadata,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} Rightmove Agent`)
        }

        toast.success(isEditMode 
          ? 'Rightmove Agent updated successfully.'
          : 'Rightmove Agent created successfully. Processing properties...'
        )
        rightmoveAgentForm.reset()
        setOpen(false)
        onItemAdded()
        return
      }

      // Handle other types with FormData
      const formData = new FormData()
      formData.append('type', type)
      formData.append('name', values.name)

      if (type === 'url' && 'url' in values) {
        formData.append('url', values.url)
      } else if (type === 'text' && 'text_content' in values) {
        formData.append('text_content', values.text_content)
      } else if (type === 'file' && selectedFile) {
        formData.append('file', selectedFile)
      }

      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items`,
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add item')
      }

      toast.success('Item added successfully')
      urlForm.reset()
      textForm.reset()
      fileForm.reset()
      setSelectedFile(null)
      setOpen(false)
      onItemAdded()
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScrapeWebsite = async (url: string) => {
    if (!url) {
      toast.error('Please enter a URL')
      return
    }

    try {
      setIsLoadingSiteMap(true)
      const response = await fetch('/api/website/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          knowledgeBaseId // Pass knowledge base ID to filter existing URLs
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to scrape website')
      }

      const data = await response.json()
      
      // Handle new response format with filtered URLs
      const newUrls = data.urls || data // Backward compatible
      const total = data.total || newUrls.length
      const existing = data.existing || 0
      const newCount = data.new || newUrls.length
      
      setScrapedUrls(newUrls)
      setSelectedUrls(newUrls) // Select all by default
      
      // Show informative message about what was found
      if (newCount === 0) {
        toast.info(
          `All ${total} page${total !== 1 ? 's' : ''} on this website are already in your knowledge base`,
          { duration: 5000 }
        )
      } else if (existing > 0) {
        toast.success(
          `Found ${total} pages: ${newCount} new, ${existing} already in knowledge base (filtered out)`,
          { duration: 5000 }
        )
      } else {
        toast.success(`Found ${newCount} new page${newCount !== 1 ? 's' : ''} on the website`)
      }
    } catch (error) {
      console.error('Error scraping website:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to scrape website')
    } finally {
      setIsLoadingSiteMap(false)
    }
  }

  const handleAddUrls = async (urls: string[]) => {
    if (urls.length === 0) {
      toast.error('Please select at least one URL')
      return
    }

    try {
      setIsSubmitting(true)
      
      // Create items from selected URLs
      const items = urls.map(url => {
        // Extract a name from the URL
        const urlObj = new URL(url)
        const pathname = urlObj.pathname === '/' ? '' : urlObj.pathname
        const name = `${urlObj.hostname}${pathname}`.replace(/\/$/, '') || url
        
        return {
          name,
          url,
          type: 'url',
        }
      })

      const response = await fetch(
        `/api/${slug}/knowledge-bases/${knowledgeBaseId}/items/bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add URLs')
      }

      const result = await response.json()
      
      const successCount = result.results.successful.length
      const skippedCount = result.results.skipped?.length || 0
      const failedCount = result.results.failed.length
      
      if (failedCount > 0 || skippedCount > 0) {
        const parts = []
        if (successCount > 0) parts.push(`${successCount} added`)
        if (skippedCount > 0) parts.push(`${skippedCount} skipped (already exist)`)
        if (failedCount > 0) parts.push(`${failedCount} failed`)
        
        toast.warning(`URLs processed: ${parts.join(', ')}`)
      } else {
        toast.success(`Successfully added ${successCount} URL${successCount !== 1 ? 's' : ''}`)
      }
      
      // Reset state
      urlForm.reset()
      setScrapedUrls([])
      setSelectedUrls([])
      setOpen(false)
      onItemAdded()
    } catch (error) {
      console.error('Error adding URLs:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add URLs')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <DialogTrigger asChild>
          <Button>
            <IconPlus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Property Agent' : 'Add Item to Knowledge Base'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the configuration for this property agent.'
              : 'Add a URL, text content, or file to your knowledge base. It will be indexed for search.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
        <Tabs defaultValue={isEditMode ? "property-agent" : "website"} className="w-full">
          {!isEditMode && (
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="website">Website</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="file">File</TabsTrigger>
              <TabsTrigger value="property-agent">Property Agent</TabsTrigger>
            </TabsList>
          )}

          {!isEditMode && (
            <>
            <TabsContent value="website" className="space-y-4">
            <Form {...urlForm}>
              <form onSubmit={urlForm.handleSubmit((v) => handleSubmit('url', v))} className="space-y-4">
                <FormField
                  control={urlForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            placeholder="https://example.com" 
                            {...field}
                            disabled={isLoadingSiteMap || scrapedUrls.length > 0}
                          />
                        </FormControl>
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={() => handleScrapeWebsite(field.value)}
                          disabled={isLoadingSiteMap || !field.value || scrapedUrls.length > 0}
                        >
                          {isLoadingSiteMap ? (
                            <>
                              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                              Scraping...
                            </>
                          ) : (
                            'Scrape Website'
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        Enter a single page URL or scrape entire website to select multiple pages. Duplicate URLs are automatically filtered out.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {scrapedUrls.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Select the pages you want to add to your knowledge base
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setScrapedUrls([])
                            setSelectedUrls([])
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                      <SiteMapSelector
                        urls={scrapedUrls}
                        selectedUrls={selectedUrls}
                        onSelectionChange={setSelectedUrls}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        type="button"
                        onClick={() => handleAddUrls(selectedUrls)}
                        disabled={isSubmitting || selectedUrls.length === 0}
                      >
                        {isSubmitting 
                          ? `Adding ${selectedUrls.length} URLs...` 
                          : `Add ${selectedUrls.length} Selected URL${selectedUrls.length !== 1 ? 's' : ''}`}
                      </Button>
                    </div>
                  </>
                ) : (
                  <FormField
                    control={urlForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Document name" {...field} />
                        </FormControl>
                        <FormDescription>A descriptive name for this page</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {scrapedUrls.length === 0 && (
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Adding...' : 'Add Single URL'}
                    </Button>
                  </div>
                )}
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <Form {...textForm}>
              <form onSubmit={textForm.handleSubmit((v) => handleSubmit('text', v))} className="space-y-4">
                <FormField
                  control={textForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Document name" {...field} />
                      </FormControl>
                      <FormDescription>A descriptive name for this text</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={textForm.control}
                  name="text_content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your text content here..."
                          className="resize-none min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>The text content to index</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add Text'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="file" className="space-y-4">
            <Form {...fileForm}>
              <form onSubmit={fileForm.handleSubmit((v) => handleSubmit('file', v))} className="space-y-4">
                <FormField
                  control={fileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Document name" {...field} />
                      </FormControl>
                      <FormDescription>A descriptive name for this file</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={fileForm.control}
                  name="file"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setSelectedFile(file)
                              onChange(file)
                            }
                          }}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload a file (PDF, DOCX, XLSX, CSV, TXT, MD)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting || !selectedFile}>
                    {isSubmitting ? 'Uploading...' : 'Upload File'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          </>
          )}

          <TabsContent value="property-agent" className="space-y-4">
            <Alert>
              <IconInfoCircle className="h-4 w-4" />
              <AlertDescription>
                This will scrape all properties from the provided URL(s) and create searchable items in your knowledge base. At least one URL is required.
              </AlertDescription>
            </Alert>
            <Form {...rightmoveAgentForm}>
              <form onSubmit={rightmoveAgentForm.handleSubmit((v) => handleSubmit('rightmove_agent', v))} className="space-y-4">
                <FormField
                  control={rightmoveAgentForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Aston Gray Properties" {...field} />
                      </FormControl>
                      <FormDescription>A descriptive name for this property agent</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={rightmoveAgentForm.control}
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
                  control={rightmoveAgentForm.control}
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
                  control={rightmoveAgentForm.control}
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

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting 
                      ? (isEditMode ? 'Updating Agent...' : 'Creating Agent...') 
                      : (isEditMode ? 'Update Property Agent' : 'Create Property Agent')
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

