import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ChevronDown } from 'lucide-react'
import type { AdvancedTTSSettingsProps } from '../types'

export function AdvancedTTSSettings({ 
  control, 
  ttsStability, 
  ttsSimilarityBoost, 
  ttsStyle, 
  ttsSpeed 
}: AdvancedTTSSettingsProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full hover:underline">
        <h4 className="text-sm font-medium">Advanced Voice Settings</h4>
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Stability Slider */}
        <FormField
          control={control}
          name="ttsStability"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Stability</FormLabel>
                <span className="text-sm font-mono text-muted-foreground">
                  {ttsStability?.toFixed(2) ?? '0.50'}
                </span>
              </div>
              <FormControl>
                <Slider
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={[field.value ?? 0.5]}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="py-4"
                />
              </FormControl>
              <FormDescription>
                Controls consistency. 0.25 (most variable/emotional) to 1.0 (most stable/monotone)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Similarity Boost Slider */}
        <FormField
          control={control}
          name="ttsSimilarityBoost"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Similarity Boost</FormLabel>
                <span className="text-sm font-mono text-muted-foreground">
                  {ttsSimilarityBoost?.toFixed(2) ?? '0.75'}
                </span>
              </div>
              <FormControl>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[field.value ?? 0.75]}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="py-4"
                />
              </FormControl>
              <FormDescription>
                How closely to match the original voice. Higher = closer match
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Style Slider */}
        <FormField
          control={control}
          name="ttsStyle"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Style</FormLabel>
                <span className="text-sm font-mono text-muted-foreground">
                  {ttsStyle?.toFixed(2) ?? '0.00'}
                </span>
              </div>
              <FormControl>
                <Slider
                  min={0}
                  max={0.75}
                  step={0.05}
                  value={[field.value ?? 0.0]}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="py-4"
                />
              </FormControl>
              <FormDescription>
                Expressiveness level. 0 (neutral) to 0.75 (highly expressive, may reduce stability)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Speaker Boost Toggle */}
        <FormField
          control={control}
          name="ttsUseSpeakerBoost"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Speaker Boost</FormLabel>
                <FormDescription>
                  Enhances similarity to original speaker (may increase latency)
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Speed Slider */}
        <FormField
          control={control}
          name="ttsSpeed"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Speed</FormLabel>
                <span className="text-sm font-mono text-muted-foreground">
                  {ttsSpeed?.toFixed(2) ?? '1.00'}x
                </span>
              </div>
              <FormControl>
                <Slider
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  value={[field.value ?? 1.0]}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="py-4"
                />
              </FormControl>
              <FormDescription>
                Playback speed. 0.7x (slower) to 1.2x (faster), 1.0x = normal
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

