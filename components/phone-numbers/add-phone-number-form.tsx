"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"
import { useState } from "react"
import { IconLoader2, IconRefresh } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const formSchema = z.object({
  provider: z.enum(["twilio"]),
  accountSid: z.string().min(1, {
    message: "Account SID is required.",
  }),
  authToken: z.string().min(1, {
    message: "Auth Token is required.",
  }),
  selectedNumber: z.string().optional(),
})

interface TwilioNumber {
  phoneNumber: string
  friendlyName: string
  region: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
}

interface AddPhoneNumberFormProps {
  onSuccess?: () => void
}

export function AddPhoneNumberForm({ onSuccess }: AddPhoneNumberFormProps) {
  const router = useRouter()
  const [availableNumbers, setAvailableNumbers] = useState<TwilioNumber[]>([])
  const [loadingNumbers, setLoadingNumbers] = useState(false)
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: "twilio",
      accountSid: "",
      authToken: "",
      selectedNumber: "",
    },
  })

  const accountSid = form.watch("accountSid")
  const authToken = form.watch("authToken")

  async function loadAvailableNumbers() {
    if (!accountSid || !authToken) {
      toast.error("Please enter your credentials first")
      return
    }

    setLoadingNumbers(true)
    try {
      const response = await fetch('/api/phone-numbers/twilio/available', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountSid,
          authToken,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load available numbers')
      }

      if (data.numbers.length === 0) {
        toast.info("No available numbers found")
      } else {
        toast.success(`Found ${data.numbers.length} available ${data.numbers.length === 1 ? 'number' : 'numbers'}`)
      }

      setAvailableNumbers(data.numbers)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load numbers"
      toast.error("Failed to load available numbers", {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setLoadingNumbers(false)
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!values.selectedNumber) {
      toast.error("Please select a phone number")
      return
    }

    try {
      const selectedNumberData = availableNumbers.find(
        (num) => num.phoneNumber === values.selectedNumber
      )

      const response = await fetch('/api/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: values.provider,
          phoneNumber: values.selectedNumber,
          friendlyName: selectedNumberData?.friendlyName,
          accountSid: values.accountSid,
          authToken: values.authToken,
          metadata: {
            region: selectedNumberData?.region,
            capabilities: selectedNumberData?.capabilities,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add phone number')
      }

      toast.success("Phone number added successfully!", {
        description: `${values.selectedNumber} has been added to your account.`,
      })
      
      // Refresh the page to show the new phone number
      router.refresh()
      
      // Call the success callback to close the sheet
      onSuccess?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while adding the phone number."
      
      toast.error("Failed to add phone number", {
        description: errorMessage,
      })
      console.error(error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="accountSid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Account SID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        setAvailableNumbers([])
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="authToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">Auth Token</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder="Your auth token" 
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        setAvailableNumbers([])
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loadAvailableNumbers}
            disabled={loadingNumbers || !accountSid || !authToken}
            className="w-full"
          >
            {loadingNumbers ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <IconRefresh className="mr-2 h-4 w-4" />
                Load Available Numbers
              </>
            )}
          </Button>
        </div>

        {availableNumbers.length > 0 && (
          <FormField
            control={form.control}
            name="selectedNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Phone Number</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a number" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableNumbers.map((number) => (
                      <SelectItem 
                        key={number.phoneNumber} 
                        value={number.phoneNumber}
                      >
                        {number.phoneNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
        <Button 
          type="submit" 
          disabled={form.formState.isSubmitting || !form.watch("selectedNumber")}
          className="w-full"
        >
          {form.formState.isSubmitting ? "Adding..." : "Add Phone Number"}
        </Button>
      </form>
    </Form>
  )
}

