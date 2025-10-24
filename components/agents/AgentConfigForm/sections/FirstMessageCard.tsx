import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { FirstMessageCardProps } from '../types'

export function FirstMessageCard({ 
  control, 
  generateFirstMessage, 
  firstMessageType 
}: FirstMessageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>First Message</CardTitle>
        <CardDescription>
          Configure how your agent greets users when they connect
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="generateFirstMessage"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Enable First Message</FormLabel>
                <FormDescription>
                  Agent greets the user when they connect
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {generateFirstMessage && (
          <>
            <FormField
              control={control}
              name="firstMessageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select message type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="direct">
                        <div className="flex flex-col">
                          <span className="font-medium">Direct Message</span>
                          <span className="text-xs text-muted-foreground">
                            Say a specific message exactly as written
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="generated">
                        <div className="flex flex-col">
                          <span className="font-medium">AI-Generated Message</span>
                          <span className="text-xs text-muted-foreground">
                            Let AI generate the greeting based on a prompt
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose whether to use a predefined message or let AI generate one
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {firstMessageType === 'direct' ? (
              <FormField
                control={control}
                name="firstMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Message Text</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Hello! How can I help you today?"
                        className="min-h-[100px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The exact message the agent will say when the call starts
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={control}
                name="firstMessagePrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Message Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Greet the user warmly and ask how you can help them."
                        className="min-h-[100px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Instructions for generating the greeting message. Context about the caller will be automatically included.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={control}
              name="firstMessageAllowInterruptions"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Allow Interruptions</FormLabel>
                    <FormDescription>
                      Whether the user can interrupt the first message
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

