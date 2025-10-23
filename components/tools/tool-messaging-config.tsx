"use client"

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { ToolMessagingConfig } from '@/types/tools'

interface ToolMessagingConfigProps {
  value?: ToolMessagingConfig
  onChange: (config: ToolMessagingConfig) => void
}

export function ToolMessagingConfigComponent({ value, onChange }: ToolMessagingConfigProps) {
  const [config, setConfig] = useState<ToolMessagingConfig>(value || {})

  const updateConfig = (updates: Partial<ToolMessagingConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    onChange(newConfig)
  }

  const updateBeforeExecution = (updates: Partial<NonNullable<ToolMessagingConfig['beforeExecution']>>) => {
    const newBeforeConfig = {
      enabled: config.beforeExecution?.enabled || false,
      type: config.beforeExecution?.type || 'say',
      content: config.beforeExecution?.content || '',
      ...updates,
    }
    
    // Only include beforeExecution if enabled is true
    updateConfig({
      beforeExecution: newBeforeConfig.enabled ? newBeforeConfig : undefined,
    })
  }

  const updateDuringExecution = (updates: Partial<NonNullable<ToolMessagingConfig['duringExecution']>>) => {
    const newDuringConfig = {
      enabled: config.duringExecution?.enabled || false,
      type: config.duringExecution?.type || 'say',
      content: config.duringExecution?.content || '',
      delay: config.duringExecution?.delay || 500,
      ...updates,
    }
    
    // Only include duringExecution if enabled is true
    updateConfig({
      duringExecution: newDuringConfig.enabled ? newDuringConfig : undefined,
    })
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="messaging">
        <AccordionTrigger>
          <div className="flex flex-col items-start">
            <span className="font-medium">Messaging Settings</span>
            <span className="text-xs text-muted-foreground font-normal">
              Configure status updates during tool execution
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-6 pt-4">
          {/* Before Execution */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Before Execution</Label>
                <p className="text-xs text-muted-foreground">
                  Speak a message before the tool starts executing
                </p>
              </div>
              <Switch
                checked={config.beforeExecution?.enabled || false}
                onCheckedChange={(enabled) => updateBeforeExecution({ enabled })}
              />
            </div>

            {config.beforeExecution?.enabled && (
              <div className="pl-4 space-y-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="before-type">Message Type</Label>
                  <Select
                    value={config.beforeExecution.type}
                    onValueChange={(type: 'say' | 'generate') => updateBeforeExecution({ type })}
                  >
                    <SelectTrigger id="before-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="say">
                        <div className="flex flex-col">
                          <span className="font-medium">Say (Direct)</span>
                          <span className="text-xs text-muted-foreground">
                            Speak the exact text provided
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="generate">
                        <div className="flex flex-col">
                          <span className="font-medium">Generate (AI)</span>
                          <span className="text-xs text-muted-foreground">
                            AI generates message based on instructions
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="before-content">
                    {config.beforeExecution.type === 'say' ? 'Message Text' : 'Generation Instructions'}
                  </Label>
                  <Textarea
                    id="before-content"
                    placeholder={
                      config.beforeExecution.type === 'say'
                        ? 'e.g., "Let me search that for you..."'
                        : 'e.g., "Tell the user you are searching for their query"'
                    }
                    value={config.beforeExecution.content}
                    onChange={(e) => updateBeforeExecution({ content: e.target.value })}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {config.beforeExecution.type === 'say'
                      ? 'The exact text that will be spoken to the user'
                      : 'Instructions for the AI to generate an appropriate message'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* During Execution */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">During Execution</Label>
                <p className="text-xs text-muted-foreground">
                  Speak a status update if the tool takes longer than expected
                </p>
              </div>
              <Switch
                checked={config.duringExecution?.enabled || false}
                onCheckedChange={(enabled) => updateDuringExecution({ enabled })}
              />
            </div>

            {config.duringExecution?.enabled && (
              <div className="pl-4 space-y-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="during-delay">Delay (milliseconds)</Label>
                  <Input
                    id="during-delay"
                    type="number"
                    min="100"
                    max="5000"
                    step="100"
                    value={config.duringExecution.delay || 500}
                    onChange={(e) => updateDuringExecution({ delay: parseInt(e.target.value) || 500 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only speak if the tool is still running after this delay
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="during-type">Message Type</Label>
                  <Select
                    value={config.duringExecution.type}
                    onValueChange={(type: 'say' | 'generate') => updateDuringExecution({ type })}
                  >
                    <SelectTrigger id="during-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="say">
                        <div className="flex flex-col">
                          <span className="font-medium">Say (Direct)</span>
                          <span className="text-xs text-muted-foreground">
                            Speak the exact text provided
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="generate">
                        <div className="flex flex-col">
                          <span className="font-medium">Generate (AI)</span>
                          <span className="text-xs text-muted-foreground">
                            AI generates message based on instructions
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="during-content">
                    {config.duringExecution.type === 'say' ? 'Message Text' : 'Generation Instructions'}
                  </Label>
                  <Textarea
                    id="during-content"
                    placeholder={
                      config.duringExecution.type === 'say'
                        ? 'e.g., "This is taking a bit longer than expected..."'
                        : 'e.g., "Tell the user this is taking longer than expected but you\'re still working on it"'
                    }
                    value={config.duringExecution.content}
                    onChange={(e) => updateDuringExecution({ content: e.target.value })}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    {config.duringExecution.type === 'say'
                      ? 'The exact text that will be spoken if the tool is still running'
                      : 'Instructions for the AI to generate an appropriate status message'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

