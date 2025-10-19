"use client"

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ToolConfig, ToolDatabaseRecord, SmsToolConfig, TransferCallToolConfig } from '@/types/tools'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { SmsToolForm } from '@/components/tools/sms-tool-form'
import { TransferCallToolForm } from '@/components/tools/transfer-call-tool-form'
import { PipedreamActionToolForm } from '@/components/tools/pipedream-action-tool-form'

interface CreateToolFormProps {
  slug: string
}

export function CreateToolForm({ slug }: CreateToolFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toolType = (searchParams.get('type') as ToolConfig['type']) || ''
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Tool metadata
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [async, setAsync] = useState(false)

  // Type-specific configuration
  const [toolConfig, setToolConfig] = useState<ToolConfig | null>(null)

  const handleToolConfigChange = useCallback((config: ToolConfig) => {
    // Merge with current label and description
    setToolConfig(config)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!toolType) {
      toast.error('Invalid tool type')
      router.push(`/${slug}/tools`)
      return
    }

    if (!label.trim()) {
      toast.error('Please enter a tool name')
      return
    }

    if (!description.trim()) {
      toast.error('Please enter a tool description')
      return
    }

    if (!toolConfig) {
      toast.error('Please configure the tool parameters')
      return
    }

    setIsSubmitting(true)

    try {
      // Final config with updated label, description, and async
      const finalConfig: ToolConfig = {
        ...toolConfig,
        label: label.trim(),
        description: description.trim(),
        async,
      }

      const response = await fetch(`/api/${slug}/tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalConfig),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tool')
      }

      toast.success('Tool created successfully!', {
        description: `${label} has been created and is ready to use.`,
      })

      // Redirect to tools list
      router.push(`/${slug}/tools`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while creating the tool.'

      toast.error('Failed to create tool', {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getToolTypeName = () => {
    switch (toolType) {
      case 'sms':
        return 'SMS / Text Message'
      case 'transfer_call':
        return 'Transfer Call'
      case 'pipedream_action':
        return 'External App'
      default:
        return 'Unknown'
    }
  }

  if (!toolType) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            Please select a tool type from the tools page.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tool Information</CardTitle>
              <CardDescription>
                {getToolTypeName()} tool configuration
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="label">Tool Name *</Label>
            <Input
              id="label"
              placeholder="e.g., Send Order Confirmation SMS"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Tool Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe when and how the AI agent should use this tool..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Explain to the agent when and how to use this tool
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="async" className="text-sm font-medium cursor-pointer">
                Don&apos;t Wait for Response
              </Label>
              <p className="text-xs text-muted-foreground">
                The agent will continue the conversation immediately without waiting for this tool to finish
              </p>
            </div>
            <Switch
              id="async"
              checked={async}
              onCheckedChange={setAsync}
            />
          </div>

          {/* Type-Specific Configuration - Integrated */}
          <div className="pt-4 border-t">
            {toolType === 'sms' && (
              <SmsToolForm
                initialData={
                  toolConfig?.type === 'sms'
                    ? { ...toolConfig, label, description }
                    : undefined
                }
                onChange={handleToolConfigChange}
                slug={slug}
              />
            )}

            {toolType === 'transfer_call' && (
              <TransferCallToolForm
                initialData={
                  toolConfig?.type === 'transfer_call'
                    ? { ...toolConfig, label, description }
                    : undefined
                }
                onChange={handleToolConfigChange}
                slug={slug}
              />
            )}

            {toolType === 'pipedream_action' && (
              <PipedreamActionToolForm
                slug={slug}
                initialData={
                  toolConfig?.type === 'pipedream_action'
                    ? { ...toolConfig, label, description }
                    : undefined
                }
                onChange={handleToolConfigChange}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      {toolType && (
        <div className="flex gap-3 pt-4 border-t">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Creating Tool...' : 'Create Tool'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.push(`/${slug}/tools`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      )}
    </form>
  )
}

