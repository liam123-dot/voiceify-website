'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { IconPlus, IconLoader2 } from "@tabler/icons-react"
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

interface AddItemDialogProps {
  slug: string
  knowledgeBaseId: string
  onItemAdded: () => void
}

export function AddItemDialog({ slug, knowledgeBaseId, onItemAdded }: AddItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoadingSiteMap, setIsLoadingSiteMap] = useState(false)
  const [scrapedUrls, setScrapedUrls] = useState<string[]>([])
  const [selectedUrls, setSelectedUrls] = useState<string[]>([])

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

  type UrlFormValues = z.infer<typeof urlSchema>
  type TextFormValues = z.infer<typeof textSchema>
  type FileFormValues = z.infer<typeof fileSchema>

  const handleSubmit = async (type: 'url' | 'text' | 'file', values: UrlFormValues | TextFormValues | FileFormValues) => {
    try {
      setIsSubmitting(true)
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
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to scrape website')
      }

      const urls = await response.json()
      setScrapedUrls(urls)
      setSelectedUrls(urls) // Select all by default
      toast.success(`Found ${urls.length} pages on the website`)
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
      
      if (result.results.failed.length > 0) {
        toast.warning(`Added ${result.results.successful.length} URLs, ${result.results.failed.length} failed`)
      } else {
        toast.success(`Successfully added ${result.results.successful.length} URLs`)
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
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Item to Knowledge Base</DialogTitle>
          <DialogDescription>
            Add a URL, text content, or file to your knowledge base. It will be indexed for search.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
        <Tabs defaultValue="website" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="website">Website</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
          </TabsList>

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
                        Enter a single page URL or scrape entire website to select multiple pages
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
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

