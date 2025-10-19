"use client"

import { useForm, useFieldArray, Controller } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { IconClock, IconAlertCircle, IconPlus, IconTrash, IconLoader2 } from "@tabler/icons-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import type { AgentRules, Schedule, DayOfWeek } from "@/types/agent-rules"
import { defaultAgentRules } from "@/types/agent-rules"

interface AgentRulesProps {
  agentId: string
  slug: string
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
]

async function fetchAgentRules(slug: string, agentId: string): Promise<AgentRules> {
  const response = await fetch(`/api/${slug}/agents/${agentId}/rules`)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch rules')
  }
  
  return data.rules || defaultAgentRules
}

async function updateAgentRules(slug: string, agentId: string, rules: AgentRules): Promise<AgentRules> {
  const response = await fetch(`/api/${slug}/agents/${agentId}/rules`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update rules')
  }

  return data.rules
}

export function AgentRules({ agentId, slug }: AgentRulesProps) {
  const queryClient = useQueryClient()

  // Fetch rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ['agent-rules', agentId],
    queryFn: () => fetchAgentRules(slug, agentId),
  })

  // Form
  const { control, handleSubmit, watch, setValue, formState: { isDirty } } = useForm<AgentRules>({
    defaultValues: rules || defaultAgentRules,
    values: rules, // This will update form when query data changes
  })

  const { fields: scheduleFields, append: appendSchedule, remove: removeSchedule } = useFieldArray({
    control,
    name: "timeBasedRouting.schedules",
  })

  // Watch form values
  const timeBasedEnabled = watch("timeBasedRouting.enabled")
  const agentFallbackEnabled = watch("agentFallback.enabled")

  // Mutation
  const mutation = useMutation({
    mutationFn: (rules: AgentRules) => updateAgentRules(slug, agentId, rules),
    onSuccess: (data) => {
      queryClient.setQueryData(['agent-rules', agentId], data)
      toast.success('Rules saved successfully')
    },
    onError: (error: Error) => {
      toast.error('Save failed', {
        description: error.message,
      })
    },
  })

  const onSubmit = (data: AgentRules) => {
    mutation.mutate(data)
  }

  const addSchedule = () => {
    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      startTime: "09:00",
      endTime: "17:00",
      transferTo: "",
    }
    appendSchedule(newSchedule)
  }

  const toggleDay = (index: number, day: DayOfWeek) => {
    const currentDays = watch(`timeBasedRouting.schedules.${index}.days`)
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d: DayOfWeek) => d !== day)
      : [...currentDays, day]
    
    setValue(`timeBasedRouting.schedules.${index}.days`, newDays, { shouldDirty: true })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Time-Based Routing Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconClock className="h-5 w-5" />
              <CardTitle>Time-Based Routing</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              {isDirty && (
                <Button type="submit" disabled={mutation.isPending} size="sm">
                  {mutation.isPending ? (
                    <>
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Rules'
                  )}
                </Button>
              )}
              <Controller
                control={control}
                name="timeBasedRouting.enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
          <CardDescription>
            Route calls to specific numbers during business hours. Outside those times, calls go directly to the agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {timeBasedEnabled ? (
            <>
              {/* Schedules */}
              <div className="space-y-4">
                {scheduleFields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Schedule {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSchedule(index)}
                      >
                        <IconTrash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>

                    {/* Days Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm">Days</Label>
                      <div className="flex gap-2">
                        {DAYS.map((day) => {
                          const currentDays = watch(`timeBasedRouting.schedules.${index}.days`)
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleDay(index, day.value)}
                              className={`
                                px-3 py-2 text-sm font-medium rounded-md border transition-colors
                                ${
                                  currentDays?.includes(day.value)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-input hover:bg-muted"
                                }
                              `}
                            >
                              {day.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Time Range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`schedule-${index}-start`}>Start Time</Label>
                        <Controller
                          control={control}
                          name={`timeBasedRouting.schedules.${index}.startTime`}
                          render={({ field }) => (
                            <Input
                              id={`schedule-${index}-start`}
                              type="time"
                              {...field}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`schedule-${index}-end`}>End Time</Label>
                        <Controller
                          control={control}
                          name={`timeBasedRouting.schedules.${index}.endTime`}
                          render={({ field }) => (
                            <Input
                              id={`schedule-${index}-end`}
                              type="time"
                              {...field}
                            />
                          )}
                        />
                      </div>
                    </div>

                    {/* Transfer Number */}
                    <div className="space-y-2">
                      <Label htmlFor={`schedule-${index}-transfer`}>Transfer to Number</Label>
                      <Controller
                        control={control}
                        name={`timeBasedRouting.schedules.${index}.transferTo`}
                        render={({ field }) => (
                          <Input
                            id={`schedule-${index}-transfer`}
                            type="tel"
                            placeholder="+1234567890"
                            {...field}
                          />
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        During these hours, calls will be transferred to this number
                      </p>
                    </div>
                  </div>
                ))}

                {/* Add Schedule Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSchedule}
                  className="w-full"
                >
                  <IconPlus className="mr-2 h-4 w-4" />
                  Add Schedule
                </Button>
              </div>

              {scheduleFields.length === 0 && (
                <Alert>
                  <IconAlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Add at least one schedule to enable time-based routing.
                  </AlertDescription>
                </Alert>
              )}

              {/* Agent Fallback Section - Only show when schedules exist */}
              {scheduleFields.length > 0 && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-base">Agent Fallback</Label>
                        <p className="text-sm text-muted-foreground">
                          If no one answers the transferred call, automatically route it to the agent
                        </p>
                      </div>
                      <Controller
                        control={control}
                        name="agentFallback.enabled"
                        render={({ field }) => (
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                    </div>

                    {agentFallbackEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="timeout">Timeout (seconds)</Label>
                        <Controller
                          control={control}
                          name="agentFallback.timeoutSeconds"
                          render={({ field }) => (
                            <Input
                              id="timeout"
                              type="number"
                              min="5"
                              max="300"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                            />
                          )}
                        />
                        <p className="text-xs text-muted-foreground">
                          How long to wait for someone to pick up before routing to the agent (5-300 seconds)
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <Alert>
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enable time-based routing to configure schedules and transfer numbers.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </form>
  )
}

