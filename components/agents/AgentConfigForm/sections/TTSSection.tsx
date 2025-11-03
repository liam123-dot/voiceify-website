import { Separator } from '@/components/ui/separator'
import { VoiceSelector } from '../components/VoiceSelector'
import { AdvancedTTSSettings } from '../components/AdvancedTTSSettings'
import type { TTSSectionProps } from '../types'

export function TTSSection({
  control,
  ttsVoiceId,
  ttsStability,
  ttsSimilarityBoost,
  ttsStyle,
  ttsSpeed,
  availableVoices,
  isLoadingVoices,
  voicesError,
  playingVoiceId,
  selectedAccent,
  selectedLanguage,
  isVoiceListOpen,
  onFetchVoices,
  onPlayVoicePreview,
  onAccentChange,
  onLanguageChange,
  onVoiceListOpenChange,
}: TTSSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Text-to-Speech</h4>
      
      {/* Fixed TTS Model display */}
      <div className="rounded-lg border p-4 bg-muted/50">
        <div className="space-y-1">
          <p className="text-sm font-medium">TTS Model</p>
          <p className="text-sm text-muted-foreground">Eleven Flash v2.5</p>
          <p className="text-xs text-muted-foreground">
            Latest generation flash model with improved quality
          </p>
        </div>
      </div>

      {/* Voice Selection */}
      <VoiceSelector
        control={control}
        availableVoices={availableVoices}
        isLoadingVoices={isLoadingVoices}
        voicesError={voicesError}
        playingVoiceId={playingVoiceId}
        selectedAccent={selectedAccent}
        selectedLanguage={selectedLanguage}
        isVoiceListOpen={isVoiceListOpen}
        onFetchVoices={onFetchVoices}
        onPlayVoicePreview={onPlayVoicePreview}
        onAccentChange={onAccentChange}
        onLanguageChange={onLanguageChange}
        onVoiceListOpenChange={onVoiceListOpenChange}
      />

      <Separator />

      {/* Advanced TTS Settings */}
      <AdvancedTTSSettings
        control={control}
        ttsStability={ttsStability}
        ttsSimilarityBoost={ttsSimilarityBoost}
        ttsStyle={ttsStyle}
        ttsSpeed={ttsSpeed}
      />
    </div>
  )
}

