'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SchemaBuilder } from "./SchemaBuilder"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const MODEL_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'custom-llm', label: 'Custom LLM' },
]

const MODEL_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  'custom-llm': [],
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
  prompt: z.string().min(1, "Prompt is required"),
  model_provider: z.string().min(1, "Model provider is required"),
  model_name: z.string().min(1, "Model name is required"),
  output_schema: z.any(),
})

type FormValues = z.infer<typeof formSchema>

interface CreateEvaluationFormProps {
  slug: string
}

export function CreateEvaluationForm({ slug }: CreateEvaluationFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      prompt: "",
      model_provider: "",
      model_name: "",
      output_schema: {
        type: "object",
        properties: {
          score: {
            type: "number",
            description: "Score from 0-10"
          }
        },
        required: ["score"]
      },
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true)

      // Validate output schema has properties
      if (!values.output_schema?.properties || Object.keys(values.output_schema.properties).length === 0) {
        toast.error('Output schema must have at least one property')
        return
      }

      const response = await fetch(`/api/${slug}/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create evaluation')
      }

      const data = await response.json()
      toast.success('Evaluation created successfully')
      
      // Redirect to the evaluation detail page
      router.push(`/${slug}/evaluations/${data.evaluation.id}`)
    } catch (error) {
      console.error('Error creating evaluation:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create evaluation')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6 space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Call Quality Evaluation" {...field} />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your evaluation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter a description..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    What does this evaluation assess?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Evaluation Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Analyze the following call transcript and evaluate..."
                      className="resize-none font-mono text-sm"
                      rows={8}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The prompt used to process call transcripts. The transcript will be provided as context.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="model_provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Provider</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value)
                        setSelectedProvider(value)
                        form.setValue('model_name', '')
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MODEL_PROVIDERS.map((provider) => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedProvider || selectedProvider === 'custom-llm'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedProvider && MODEL_OPTIONS[selectedProvider]?.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProvider === 'custom-llm' && (
                      <FormControl>
                        <Input
                          placeholder="Enter custom model name"
                          {...field}
                          className="mt-2"
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Output Schema
              </label>
              <p className="text-sm text-muted-foreground mb-4">
                Define the structure of data that will be extracted from call transcripts
              </p>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuration</CardTitle>
                  <CardDescription>
                    Add properties to define what information should be extracted
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SchemaBuilder
                    value={form.watch('output_schema')}
                    onChange={(schema) => form.setValue('output_schema', schema)}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Evaluation"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/${slug}/evaluations`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

