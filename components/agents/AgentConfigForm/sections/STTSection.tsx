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
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { STT_MODELS } from '@/lib/models'
import type { STTSectionProps } from '../types'

export function STTSection({ control, sttModel, keywords, onManageKeywords }: STTSectionProps) {
  // Find the selected model to determine its inference type capability
  const selectedModel = STT_MODELS.find(model => model.id === sttModel)
  const supportsBothInferenceTypes = selectedModel?.inferenceType === 'both'
  const modelInferenceType = selectedModel?.inferenceType || 'livekit'

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Speech-to-Text</h4>
      
      <FormField
        control={control}
        name="sttModel"
        render={({ field }) => (
          <FormItem>
            <FormLabel>STT Model</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select STT model" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {STT_MODELS.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {model.description} {model.recommended && '(Recommended)'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Choose your speech recognition model
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="backgroundNoiseEnabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Enable Background Noise</FormLabel>
              <FormDescription>
                Adds ambient sounds like keyboard typing to simulate a realistic office environment
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

      {/* Always show inference type selector */}
      <FormField
        control={control}
        name="sttInferenceType"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Use LiveKit Inference</FormLabel>
              <FormDescription>
                {supportsBothInferenceTypes 
                  ? "When enabled, uses LiveKit's managed inference. When disabled, uses provider plugin directly."
                  : `This model only supports ${modelInferenceType === 'livekit' ? "LiveKit's managed" : "direct provider"} inference.`
                }
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={supportsBothInferenceTypes ? field.value === 'livekit' : modelInferenceType === 'livekit'}
                onCheckedChange={supportsBothInferenceTypes ? (checked) => field.onChange(checked ? 'livekit' : 'direct') : undefined}
                disabled={!supportsBothInferenceTypes}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Keywords management - only for Deepgram and AssemblyAI */}
      {(sttModel?.startsWith('deepgram/') || sttModel?.startsWith('assemblyai/')) && (
        <div className="space-y-2">
          <FormLabel>Keywords</FormLabel>
          <FormDescription>
            Add domain-specific keywords to improve transcription accuracy
          </FormDescription>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onManageKeywords}
            className="w-full"
          >
            Manage Keywords ({keywords?.length || 0})
          </Button>
        </div>
      )}
    </div>
  )
}

