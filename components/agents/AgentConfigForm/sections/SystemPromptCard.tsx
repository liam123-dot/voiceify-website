import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import type { SystemPromptCardProps } from '../types'

export function SystemPromptCard({ control }: SystemPromptCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Prompt</CardTitle>
        <CardDescription>
          Define your agent&apos;s personality, role, and behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="You are a helpful AI assistant..."
                  className="h-[200px] resize-y"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Core system prompt that defines your agent&apos;s role and behavior. Be specific about the agent&apos;s purpose, tone, and how it should interact with users.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}

