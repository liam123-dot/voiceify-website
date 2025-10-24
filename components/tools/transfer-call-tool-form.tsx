"use client"

import { useState, useEffect } from 'react'
import { TransferCallToolConfig, ToolFormProps } from '@/types/tools'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface Agent {
  id: string
  name: string
}

export function TransferCallToolForm({ initialData, onChange, slug }: ToolFormProps<TransferCallToolConfig>) {
  // Agents list
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(true)

  // Target state
  const [targetType, setTargetType] = useState<'agent' | 'number'>(
    initialData?.target.type || 'agent'
  )
  const [selectedAgentId, setSelectedAgentId] = useState(initialData?.target.agentId || '')
  const [phoneNumber, setPhoneNumber] = useState(initialData?.target.phoneNumber || '')

  // Message state
  const [messageStrategy, setMessageStrategy] = useState<'fixed' | 'summarized' | 'none'>(
    initialData?.message.strategy || 'none'
  )
  const [messageContent, setMessageContent] = useState(initialData?.message.content || '')
  const [summarizePrompt, setSummarizePrompt] = useState(initialData?.message.summarizePrompt || '')

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch(`/api/${slug}/agents`)
        if (response.ok) {
          const data = await response.json()
          setAgents(data.agents || [])
        }
      } catch (error) {
        console.error('Failed to load agents:', error)
      } finally {
        setIsLoadingAgents(false)
      }
    }

    loadAgents()
  }, [slug])

  // Update parent whenever state changes
  useEffect(() => {
    const selectedAgent = agents.find((a) => a.id === selectedAgentId)

    const config: TransferCallToolConfig = {
      type: 'transfer_call',
      label: initialData?.label || '',
      description: initialData?.description || '',
      target:
        targetType === 'agent'
          ? {
              type: 'agent',
              agentId: selectedAgentId,
              agentName: selectedAgent?.name,
            }
          : {
              type: 'number',
              phoneNumber: phoneNumber,
            },
      message:
        messageStrategy === 'fixed'
          ? {
              strategy: 'fixed',
              content: messageContent,
            }
          : messageStrategy === 'summarized'
          ? {
              strategy: 'summarized',
              summarizePrompt: summarizePrompt,
            }
          : {
              strategy: 'none',
            },
    }
    onChange(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    targetType,
    selectedAgentId,
    phoneNumber,
    messageStrategy,
    messageContent,
    summarizePrompt,
    agents,
  ])

  return (
    <div className="space-y-6">
      {/* Transfer Target Configuration */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Transfer Target</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose where to transfer the call
              </p>
            </div>

            <RadioGroup
              value={targetType}
              onValueChange={(value) => setTargetType(value as 'agent' | 'number')}
            >
              <div className="space-y-3">
                {/* Transfer to Agent */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="agent" id="target-agent" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="target-agent" className="font-normal cursor-pointer">
                      Transfer to Another Agent
                    </Label>
                    {targetType === 'agent' && (
                      <div>
                        {isLoadingAgents ? (
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading agents...</span>
                          </div>
                        ) : agents.length > 0 ? (
                          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-muted-foreground py-2">
                            No agents available. Create an agent first.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transfer to Phone Number */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="number" id="target-number" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="target-number" className="font-normal cursor-pointer">
                      Transfer to Phone Number
                    </Label>
                    {targetType === 'number' && (
                      <Input
                        placeholder="+1234567890"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Message Configuration */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Transfer Message</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Configure what message should be sent with the transfer
              </p>
            </div>

            <RadioGroup
              value={messageStrategy}
              onValueChange={(value) => setMessageStrategy(value as 'fixed' | 'summarized' | 'none')}
            >
              <div className="space-y-3">
                {/* Fixed Message */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="fixed" id="message-fixed" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="message-fixed" className="font-normal cursor-pointer">
                      Fixed Message
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Send a pre-written message with the transfer
                    </p>
                    {messageStrategy === 'fixed' && (
                      <Textarea
                        placeholder="Enter the transfer message..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        className="min-h-[100px]"
                      />
                    )}
                  </div>
                </div>

                {/* Summarize Conversation */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="summarized" id="message-summarized" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="message-summarized" className="font-normal cursor-pointer">
                      Summarize Conversation
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      AI generates a summary of the conversation so far
                    </p>
                    {messageStrategy === 'summarized' && (
                      <Input
                        placeholder="Describe what the summary should include..."
                        value={summarizePrompt}
                        onChange={(e) => setSummarizePrompt(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {/* No Message */}
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="none" id="message-none" className="mt-1" />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="message-none" className="font-normal cursor-pointer">
                      No Message
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Transfer without sending any context
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

