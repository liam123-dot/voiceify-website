"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconDeviceMobile, IconAlertCircle, IconLoader2, IconTrash, IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddPhoneNumberButton } from "@/components/phone-numbers/add-phone-number-button"

interface PhoneNumber {
  id: string
  phone_number: string
  friendly_name: string | null
  provider: string
  status: string
  agent_id: string | null
  webhook_configured: boolean
  webhook_url: string | null
}

interface AgentDeploymentProps {
  agentId: string
  slug: string
}

export function AgentDeployment({ agentId, slug }: AgentDeploymentProps) {
  const router = useRouter()
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [selectedNumberId, setSelectedNumberId] = useState<string>("")
  const [assignedNumbers, setAssignedNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [configuring, setConfiguring] = useState<string | null>(null)

  const loadPhoneNumbers = useCallback(async () => {
    try {
      const response = await fetch(`/api/${slug}/phone-numbers`)
      const data = await response.json()

      if (response.ok) {
        setPhoneNumbers(data.phoneNumbers || [])

        // Find all numbers assigned to this agent
        const assigned = data.phoneNumbers?.filter((num: PhoneNumber) => num.agent_id === agentId) || []
        setAssignedNumbers(assigned)
      }
    } catch (error) {
      console.error('Error loading phone numbers:', error)
    } finally {
      setLoading(false)
    }
  }, [agentId, slug])

  useEffect(() => {
    loadPhoneNumbers()
  }, [loadPhoneNumbers])

  async function handleAssignNumber() {
    if (!selectedNumberId) {
      toast.error("Please select a phone number")
      return
    }

    // Find the number to assign
    const numberToAssign = phoneNumbers.find(num => num.id === selectedNumberId)
    if (!numberToAssign) return

    // Optimistically update the UI
    const optimisticNumber = { ...numberToAssign, agent_id: agentId }
    setAssignedNumbers(prev => [...prev, optimisticNumber])
    setPhoneNumbers(prev => prev.map(num => 
      num.id === selectedNumberId ? optimisticNumber : num
    ))
    setConfiguring(selectedNumberId)
    const previousSelectedId = selectedNumberId
    setSelectedNumberId("")

    try {
      // Step 1: Assign the number to the agent
      const assignResponse = await fetch(`/api/${slug}/phone-numbers/${previousSelectedId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      })

      const assignData = await assignResponse.json()

      if (!assignResponse.ok) {
        throw new Error(assignData.error || 'Failed to assign phone number')
      }

      // Step 2: Configure the webhook with the provider
      const webhookResponse = await fetch(`/api/${slug}/phone-numbers/${previousSelectedId}/configure-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const webhookData = await webhookResponse.json()

      if (!webhookResponse.ok) {
        // Unassign if webhook configuration fails
        await fetch(`/api/${slug}/phone-numbers/${previousSelectedId}/assign`, {
          method: 'DELETE',
        })
        throw new Error(webhookData.error || 'Failed to configure webhook')
      }

      toast.success("Phone number added successfully!", {
        description: `${assignData.phoneNumber.phone_number} is now connected to this agent.`,
      })

      router.refresh()
    } catch (error) {
      // Revert optimistic update
      setAssignedNumbers(prev => prev.filter(num => num.id !== previousSelectedId))
      setPhoneNumbers(prev => prev.map(num => 
        num.id === previousSelectedId ? numberToAssign : num
      ))
      setSelectedNumberId(previousSelectedId)

      const errorMessage = error instanceof Error ? error.message : "Failed to configure phone number"
      toast.error("Configuration failed", {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setConfiguring(null)
    }
  }

  async function handleUnassignNumber(numberId: string, phoneNumber: string) {
    // Find the number to unassign
    const numberToUnassign = assignedNumbers.find(num => num.id === numberId)
    if (!numberToUnassign) return

    // Optimistically update the UI
    const optimisticNumber = { ...numberToUnassign, agent_id: null }
    setAssignedNumbers(prev => prev.filter(num => num.id !== numberId))
    setPhoneNumbers(prev => prev.map(num => 
      num.id === numberId ? optimisticNumber : num
    ))
    setConfiguring(numberId)

    try {
      const response = await fetch(`/api/${slug}/phone-numbers/${numberId}/assign`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove phone number')
      }

      toast.success("Phone number removed", {
        description: `${phoneNumber} is no longer connected to this agent.`,
      })

      router.refresh()
    } catch (error) {
      // Revert optimistic update
      setAssignedNumbers(prev => [...prev, numberToUnassign])
      setPhoneNumbers(prev => prev.map(num => 
        num.id === numberId ? numberToUnassign : num
      ))

      const errorMessage = error instanceof Error ? error.message : "Failed to remove phone number"
      toast.error("Removal failed", {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setConfiguring(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <div className="h-5 w-32 bg-accent animate-pulse rounded-md" />
            <div className="h-4 w-64 bg-accent animate-pulse rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-accent animate-pulse rounded-md" />
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3 bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-32 bg-accent animate-pulse rounded-md" />
                    <div className="h-6 w-16 bg-accent animate-pulse rounded-md" />
                  </div>
                  <div className="h-8 w-8 bg-accent animate-pulse rounded-md" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-32 bg-accent animate-pulse rounded-md" />
            <div className="flex gap-2">
              <div className="h-10 flex-1 bg-accent animate-pulse rounded-md" />
              <div className="h-10 w-20 bg-accent animate-pulse rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const availableNumbers = phoneNumbers.filter(num => !num.agent_id)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconDeviceMobile className="h-5 w-5" />
          Phone Numbers
        </CardTitle>
        <CardDescription>
          Connect phone numbers to this agent. Incoming calls will be automatically handled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assigned Numbers List */}
        {assignedNumbers.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Connected Numbers</h3>
            <div className="space-y-2">
              {assignedNumbers.map((number) => (
                <div
                  key={number.id}
                  className="flex items-center justify-between rounded-lg border p-3 bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{number.phone_number}</span>
                    <Badge variant="outline" className="capitalize">
                      {number.provider}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnassignNumber(number.id, number.phone_number)}
                    disabled={configuring === number.id}
                  >
                    {configuring === number.id ? (
                      <IconLoader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <IconTrash className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Number Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Add Phone Number</h3>
          
          {phoneNumbers.length === 0 ? (
            <Alert>
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>You don&apos;t have any phone numbers yet. Add one to get started.</span>
                <AddPhoneNumberButton slug={slug} onSuccess={loadPhoneNumbers} />
              </AlertDescription>
            </Alert>
          ) : availableNumbers.length === 0 ? (
            <Alert>
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>All your phone numbers are assigned. Add more to continue.</span>
                <AddPhoneNumberButton slug={slug} onSuccess={loadPhoneNumbers} />
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedNumberId} onValueChange={setSelectedNumberId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a phone number" />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.map((number) => (
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
              <Button
                onClick={handleAssignNumber}
                disabled={!selectedNumberId || configuring !== null}
              >
                {configuring === selectedNumberId ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconPlus className="mr-2 h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

