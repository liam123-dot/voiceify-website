import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import type { AudioProcessingCardProps } from '../types'

export function AudioProcessingCard({ control }: AudioProcessingCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio Processing</CardTitle>
        <CardDescription>
          Configure audio quality and processing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormField
          control={control}
          name="noiseCancellation"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Noise Cancellation</FormLabel>
                <FormDescription>
                  Remove background noise from user audio
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

