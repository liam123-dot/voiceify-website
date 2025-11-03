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
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { LLM_MODELS } from '@/lib/models'
import type { LLMSectionProps } from '../types'

export function LLMSection({ control, llmTemperature }: LLMSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Language Model</h4>
      
      <FormField
        control={control}
        name="llmModel"
        render={({ field }) => {
          // Find the selected model to determine its inference type capability
          const selectedModel = LLM_MODELS.find(model => model.id === field.value)
          const supportsBothInferenceTypes = selectedModel?.inferenceType === 'both'
          const modelInferenceType = selectedModel?.inferenceType || 'livekit'

          return (
            <>
              <FormItem>
                <FormLabel>LLM Model</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select LLM model" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LLM_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {model.description} {model.recommended && '(Recommended)'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Inference: {model.inferenceType === 'both' ? 'Supports Both' : model.inferenceType === 'livekit' ? 'LiveKit' : 'Direct'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  LiveKit Inference provides managed, optimized model hosting. Direct uses provider APIs directly.
                </FormDescription>
                <FormMessage />
              </FormItem>

              {/* Always show inference type selector */}
              <FormField
                control={control}
                name="llmInferenceType"
                render={({ field: inferenceField }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Use LiveKit Inference</FormLabel>
                      <FormDescription>
                        {supportsBothInferenceTypes 
                          ? "When enabled, uses LiveKit's managed inference. When disabled, calls provider API directly."
                          : `This model only supports ${modelInferenceType === 'livekit' ? "LiveKit's managed" : "direct provider"} inference.`
                        }
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={supportsBothInferenceTypes ? inferenceField.value === 'livekit' : modelInferenceType === 'livekit'}
                        onCheckedChange={supportsBothInferenceTypes ? (checked) => inferenceField.onChange(checked ? 'livekit' : 'direct') : undefined}
                        disabled={!supportsBothInferenceTypes}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )
        }}
      />

      <FormField
        control={control}
        name="llmTemperature"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Temperature</FormLabel>
              <span className="text-sm font-mono text-muted-foreground">
                {llmTemperature?.toFixed(1) ?? '0.8'}
              </span>
            </div>
            <FormControl>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={[field.value ?? 0.8]}
                onValueChange={(value) => field.onChange(value[0])}
                className="py-4"
              />
            </FormControl>
            <FormDescription>
              Higher values make output more creative
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

