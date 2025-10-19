'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { IconPlus } from "@tabler/icons-react"
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Item to Knowledge Base</DialogTitle>
          <DialogDescription>
            Add a URL, text content, or file to your knowledge base. It will be indexed for search.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="file">File</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <Form {...urlForm}>
              <form onSubmit={urlForm.handleSubmit((v) => handleSubmit('url', v))} className="space-y-4">
                <FormField
                  control={urlForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Document name" {...field} />
                      </FormControl>
                      <FormDescription>A descriptive name for this URL</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={urlForm.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/document" {...field} />
                      </FormControl>
                      <FormDescription>The URL to index</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Adding...' : 'Add URL'}
                  </Button>
                </div>
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
      </DialogContent>
    </Dialog>
  )
}

