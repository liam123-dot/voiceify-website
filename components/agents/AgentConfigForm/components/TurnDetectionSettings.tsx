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
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import type { TurnDetectionSettingsProps } from '../types'

export function TurnDetectionSettings({ 
  control,
  turnDetectionType,
  vadMinSpeechDuration,
  vadMinSilenceDuration,
  vadPrefixPaddingDuration,
  turnDetectorMinEndpointingDelay,
  turnDetectorMaxEndpointingDelay,
}: TurnDetectionSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Turn Detection & VAD</CardTitle>
        <CardDescription>
          Configure how the agent detects when a user has finished speaking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Turn Detection Type */}
        <FormField
          control={control}
          name="turnDetectionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turn Detection Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select turn detection type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="multilingual">
                    <div className="flex flex-col">
                      <span className="font-medium">Multilingual (EOU + VAD)</span>
                      <span className="text-xs text-muted-foreground">
                        Uses semantic understanding and VAD for best turn detection
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="server-vad">
                    <div className="flex flex-col">
                      <span className="font-medium">Server VAD Only</span>
                      <span className="text-xs text-muted-foreground">
                        Basic voice activity detection without semantic analysis
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="disabled">
                    <div className="flex flex-col">
                      <span className="font-medium">Disabled</span>
                      <span className="text-xs text-muted-foreground">
                        No automatic turn detection
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Multilingual mode reduces interruptions by 85% compared to VAD-only
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* VAD Settings */}
        {turnDetectionType !== 'disabled' && (
          <>
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Voice Activity Detection (VAD) Settings</h4>
              
              {/* Min Speech Duration */}
              <FormField
                control={control}
                name="vadMinSpeechDuration"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Minimum Speech Duration</FormLabel>
                      <span className="text-sm font-mono text-muted-foreground">
                        {vadMinSpeechDuration ?? 50}ms
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={10}
                        max={500}
                        step={10}
                        value={[field.value ?? 50]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum duration of speech required to start a new speech chunk
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Min Silence Duration */}
              <FormField
                control={control}
                name="vadMinSilenceDuration"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Minimum Silence Duration</FormLabel>
                      <span className="text-sm font-mono text-muted-foreground">
                        {vadMinSilenceDuration ?? 550}ms
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={100}
                        max={2000}
                        step={50}
                        value={[field.value ?? 550]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <FormDescription>
                      Duration of silence to wait after speech ends to determine if the user has finished speaking
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Prefix Padding Duration */}
              <FormField
                control={control}
                name="vadPrefixPaddingDuration"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Prefix Padding Duration</FormLabel>
                      <span className="text-sm font-mono text-muted-foreground">
                        {vadPrefixPaddingDuration ?? 500}ms
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1000}
                        step={50}
                        value={[field.value ?? 500]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="py-4"
                      />
                    </FormControl>
                    <FormDescription>
                      Duration of padding to add to the beginning of each speech chunk
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* EOU Settings (only for multilingual) */}
            {turnDetectionType === 'multilingual' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">End-of-Utterance (EOU) Settings</h4>
                  
                  {/* Min Endpointing Delay */}
                  <FormField
                    control={control}
                    name="turnDetectorMinEndpointingDelay"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Minimum Endpointing Delay</FormLabel>
                          <span className="text-sm font-mono text-muted-foreground">
                            {turnDetectorMinEndpointingDelay ?? 500}ms
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            min={0}
                            max={2000}
                            step={50}
                            value={[field.value ?? 500]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription>
                          The number of seconds to wait before considering the turn complete (lower = faster response)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Endpointing Delay */}
                  <FormField
                    control={control}
                    name="turnDetectorMaxEndpointingDelay"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Maximum Endpointing Delay</FormLabel>
                          <span className="text-sm font-mono text-muted-foreground">
                            {turnDetectorMaxEndpointingDelay ?? 6000}ms
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1000}
                            max={10000}
                            step={500}
                            value={[field.value ?? 6000]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum time to wait for the user to speak when the model indicates they may continue
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

