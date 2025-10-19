"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { z } from "zod"

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

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Agent name must be at least 2 characters.",
  }).max(50, {
    message: "Agent name must not exceed 50 characters.",
  }),
})

interface CreateAgentFormProps {
  slug: string
}

export function CreateAgentForm({ slug }: CreateAgentFormProps) {
  const router = useRouter()
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const response = await fetch(`/api/${slug}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: values.name }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error messages from the API
        throw new Error(data.error || 'Failed to create agent')
      }

      toast.success("Agent created successfully!", {
        description: `Your agent "${values.name}" has been created.`,
      })
      
      // Redirect to the agent's detail page
      router.push(`/${slug}/agents/${data.agent.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while creating the agent. Please try again."
      
      toast.error("Failed to create agent", {
        description: errorMessage,
      })
      console.error(error)
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
                  <FormLabel>Agent Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. Customer Support Agent" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    This is the name of your AI voice agent. Choose a descriptive name that helps you identify its purpose.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create Agent"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push(`/${slug}/agents`)}
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

