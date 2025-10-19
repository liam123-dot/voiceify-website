"use client"

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { SmsToolConfig, ToolFormProps } from '@/types/tools'
import { ParameterConfigField, ParameterConfig } from '@/components/tools/parameter-config'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface PhoneNumber {
  id: string
  phone_number: string
  friendly_name: string | null
  provider: string
}

export function SmsToolForm({ initialData, onChange }: ToolFormProps<SmsToolConfig>) {
  // Phone number state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(true)
  const [fromType, setFromType] = useState<'called_number' | 'specific_number'>(
    initialData?.from?.type || 'called_number'
  )
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(
    initialData?.from?.phone_number_id || ''
  )

  const [textConfig, setTextConfig] = useState<ParameterConfig>(() => {
    if (initialData?.text.mode === 'ai') {
      return { mode: 'ai', prompt: initialData.text.prompt || '' }
    }
    const textValue = initialData?.text.mode === 'fixed' ? initialData.text.value : ''
    return { mode: 'fixed', value: typeof textValue === 'string' ? textValue : '' }
  })

  const [recipientsConfig, setRecipientsConfig] = useState<ParameterConfig>(() => {
    if (initialData?.recipients.mode === 'ai') {
      return {
        mode: 'ai',
        prompt: initialData.recipients.prompt || '',
      }
    } else if (initialData?.recipients.mode === 'array_extendable') {
      return {
        mode: 'fixed',
        arrayItems: (initialData.recipients.fixedValues || []).map((val) => ({ mode: 'fixed', value: String(val) })),
        aiCanAdd: initialData.recipients.aiExtension.enabled,
        aiAddPrompt: initialData.recipients.aiExtension.prompt || '',
        aiMustAdd: initialData.recipients.aiExtension.required || false,
      }
    } else if (initialData?.recipients.mode === 'fixed') {
      const recipientsValue = initialData.recipients.value
      const recipientsArray = Array.isArray(recipientsValue) ? recipientsValue : []
      return {
        mode: 'fixed',
        arrayItems: recipientsArray.map((val) => ({ mode: 'fixed', value: String(val) })),
      }
    }
    return {
      mode: 'fixed',
      arrayItems: [{ mode: 'fixed', value: '' }],
    }
  })

  // Load phone numbers on mount
  useEffect(() => {
    const loadPhoneNumbers = async () => {
      try {
        const response = await fetch('/api/phone-numbers')
        const data = await response.json()
        
        if (response.ok) {
          setPhoneNumbers(data.phoneNumbers || [])
        }
      } catch (error) {
        console.error('Error loading phone numbers:', error)
      } finally {
        setLoadingPhoneNumbers(false)
      }
    }
    
    loadPhoneNumbers()
  }, [])

  // Update parent whenever configuration changes
  useEffect(() => {
    // Convert text config
    const text =
      textConfig.mode === 'fixed'
        ? { mode: 'fixed' as const, value: textConfig.value || '' }
        : { mode: 'ai' as const, prompt: textConfig.prompt || '', schema: z.string().describe(textConfig.prompt || '') }

    // Convert recipients config
    let recipients
    if (recipientsConfig.arrayItems) {
      const fixedValues: string[] = []
      const aiPrompts: string[] = []

      recipientsConfig.arrayItems.forEach((item) => {
        if (item.mode === 'fixed' && item.value) {
          fixedValues.push(item.value)
        } else if (item.mode === 'ai' && item.prompt) {
          aiPrompts.push(item.prompt)
        }
      })

      if (recipientsConfig.aiCanAdd && recipientsConfig.aiAddPrompt) {
        recipients = {
          mode: 'array_extendable' as const,
          fixedValues,
          aiExtension: {
            enabled: true,
            prompt: recipientsConfig.aiAddPrompt,
            required: recipientsConfig.aiMustAdd || false,
            itemSchema: z.string().describe(recipientsConfig.aiAddPrompt),
          },
        }
      } else if (aiPrompts.length > 0 || fixedValues.length === 0) {
        recipients = {
          mode: 'ai' as const,
          prompt: aiPrompts.join(', ') || 'Extract phone numbers from conversation',
          schema: z.array(z.string()).describe(aiPrompts.join(', ') || 'Extract phone numbers'),
        }
      } else {
        recipients = {
          mode: 'fixed' as const,
          value: fixedValues,
        }
      }
    } else if (recipientsConfig.mode === 'ai') {
      recipients = {
        mode: 'ai' as const,
        prompt: recipientsConfig.prompt || '',
        schema: z.array(z.string()).describe(recipientsConfig.prompt || ''),
      }
    } else {
      recipients = {
        mode: 'fixed' as const,
        value: [],
      }
    }

    const config: SmsToolConfig = {
      type: 'sms',
      label: initialData?.label || '',
      description: initialData?.description || '',
      from: {
        type: fromType,
        ...(fromType === 'specific_number' && selectedPhoneNumberId
          ? { phone_number_id: selectedPhoneNumberId }
          : {}),
      },
      text,
      recipients,
    }

    onChange(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textConfig, recipientsConfig, fromType, selectedPhoneNumberId])

  return (
    <div className="space-y-6">
      {/* Phone Number Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Send From</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which phone number to send the SMS from
              </p>
            </div>

            {loadingPhoneNumbers ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading phone numbers...</span>
              </div>
            ) : (
              <RadioGroup
                value={fromType}
                onValueChange={(value) => setFromType(value as 'called_number' | 'specific_number')}
              >
                <div className="space-y-3">
                  {/* Use Called Number */}
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="called_number" id="from-called" className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="from-called" className="font-normal cursor-pointer">
                        Use Called Number (Automatic)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Send from the phone number that was called by the customer
                      </p>
                    </div>
                  </div>

                  {/* Specific Phone Number */}
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="specific_number" id="from-specific" className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="from-specific" className="font-normal cursor-pointer">
                        Specific Phone Number
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Always send from a specific phone number
                      </p>
                      {fromType === 'specific_number' && (
                        <div>
                          {phoneNumbers.length > 0 ? (
                            <Select
                              value={selectedPhoneNumberId}
                              onValueChange={setSelectedPhoneNumberId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a phone number" />
                              </SelectTrigger>
                              <SelectContent>
                                {phoneNumbers.map((number) => (
                                  <SelectItem key={number.id} value={number.id}>
                                    <div className="flex items-center gap-2">
                                      <span>{number.phone_number}</span>
                                      <span className="text-xs text-muted-foreground capitalize">
                                        ({number.provider})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">
                              No phone numbers available. Add a phone number first.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </RadioGroup>
            )}
          </div>
        </CardContent>
      </Card>

      <ParameterConfigField
        name="text"
        label="Message Content"
        description="The text message content to send"
        required={true}
        isArray={false}
        value={textConfig}
        onChange={setTextConfig}
        customFixedInput={<textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Enter message content..." value={typeof textConfig.value === 'string' ? textConfig.value : ''} onChange={(e) => setTextConfig({ ...textConfig, value: e.target.value })} />}
      />

      <ParameterConfigField
        name="recipients"
        label="Recipients"
        description="Phone number(s) to send the SMS to"
        required={true}
        isArray={true}
        value={recipientsConfig}
        onChange={setRecipientsConfig}
      />
    </div>
  )
}
