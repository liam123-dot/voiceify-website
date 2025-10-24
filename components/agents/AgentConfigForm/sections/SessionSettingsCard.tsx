import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import type { SessionSettingsCardProps } from '../types'

export function SessionSettingsCard({ control }: SessionSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Settings</CardTitle>
        <CardDescription>
          Control how your agent handles conversations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={control}
          name="enableTranscription"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Enable Transcription</FormLabel>
                <FormDescription>
                  Save text transcripts of all conversations
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

        <FormField
          control={control}
          name="recordSession"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Record Session</FormLabel>
                <FormDescription>
                  Save audio recordings of all conversations
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
      </CardContent>
    </Card>
  )
}

