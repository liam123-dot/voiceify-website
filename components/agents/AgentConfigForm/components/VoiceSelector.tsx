import { useMemo } from 'react'
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
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Play, Pause } from 'lucide-react'
import type { VoiceSelectorProps } from '../types'

export function VoiceSelector({
  control,
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
}: VoiceSelectorProps) {
  // Extract unique accents and languages from voices
  const { accents, languages } = useMemo(() => {
    const accentSet = new Set<string>()
    const languageSet = new Set<string>()
    
    availableVoices.forEach(voice => {
      if (voice.labels) {
        if (voice.labels.accent) {
          accentSet.add(voice.labels.accent)
        }
        if (voice.labels.language) {
          languageSet.add(voice.labels.language)
        }
      }
    })
    
    return {
      accents: Array.from(accentSet).sort(),
      languages: Array.from(languageSet).sort()
    }
  }, [availableVoices])

  // Filter voices based on selected accent and language
  const filteredVoices = useMemo(() => {
    return availableVoices.filter(voice => {
      const matchesAccent = selectedAccent === 'all' || 
        (voice.labels?.accent === selectedAccent)
      
      const matchesLanguage = selectedLanguage === 'all' || 
        (voice.labels?.language === selectedLanguage)
      
      return matchesAccent && matchesLanguage
    })
  }, [availableVoices, selectedAccent, selectedLanguage])

  return (
    <FormField
      control={control}
      name="ttsVoiceId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Voice</FormLabel>
          <FormDescription>
            Select a voice from your ElevenLabs account
          </FormDescription>

          {/* Display selected voice */}
          {field.value && !isVoiceListOpen && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {availableVoices.find(v => v.voiceId === field.value)?.name || 'Selected Voice'}
                  </p>
                  {availableVoices.find(v => v.voiceId === field.value)?.description && (
                    <p className="text-xs text-muted-foreground">
                      {availableVoices.find(v => v.voiceId === field.value)?.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {availableVoices.find(v => v.voiceId === field.value)?.previewUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault()
                        const voice = availableVoices.find(v => v.voiceId === field.value)
                        if (voice) onPlayVoicePreview(voice.voiceId, voice.previewUrl)
                      }}
                      title={playingVoiceId === field.value ? 'Stop preview' : 'Play preview'}
                    >
                      {playingVoiceId === field.value ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onVoiceListOpenChange(true)}
                  >
                    Change Voice
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Show voice browser when changing or no voice selected */}
          {(isVoiceListOpen || !field.value) && (
          <>
          {isLoadingVoices ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading voices...</span>
            </div>
          ) : voicesError ? (
            <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                {voicesError}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onFetchVoices}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : availableVoices.length === 0 ? (
            <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No voices found in your ElevenLabs account.
              </p>
            </div>
          ) : (
            <>
              {/* Filter Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by Accent</label>
                  <Select value={selectedAccent} onValueChange={onAccentChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="British" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accents</SelectItem>
                      {accents.map((accent) => (
                        <SelectItem key={accent} value={accent}>
                          {accent.charAt(0).toUpperCase() + accent.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by Language</label>
                  <Select value={selectedLanguage} onValueChange={onLanguageChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="All languages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All languages</SelectItem>
                      {languages.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language.charAt(0).toUpperCase() + language.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results count */}
              <div className="text-sm text-muted-foreground mb-3">
                Showing {filteredVoices.length} of {availableVoices.length} voices
              </div>

              {filteredVoices.length === 0 ? (
                <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    No voices match the selected filters. Try adjusting your filters.
                  </p>
                </div>
              ) : (
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    className="space-y-2 max-h-[600px] overflow-y-auto pr-2"
                  >
                    {filteredVoices.map((voice) => (
                  <div
                    key={voice.voiceId}
                    className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-accent"
                  >
                    <RadioGroupItem value={voice.voiceId} id={voice.voiceId} />
                    <label
                      htmlFor={voice.voiceId}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {voice.name}
                        </p>
                        {voice.description && (
                          <p className="text-xs text-muted-foreground">
                            {voice.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {voice.category && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-secondary">
                              {voice.category}
                            </span>
                          )}
                          {Object.entries(voice.labels).slice(0, 3).map(([key, value]) => (
                            <span
                              key={key}
                              className="text-xs px-2 py-0.5 rounded-md bg-secondary"
                            >
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    </label>
                    {voice.previewUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault()
                          onPlayVoicePreview(voice.voiceId, voice.previewUrl)
                        }}
                        title={playingVoiceId === voice.voiceId ? 'Stop preview' : 'Play preview'}
                      >
                        {playingVoiceId === voice.voiceId ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
                  </RadioGroup>
                </FormControl>
              )}
            </>
          )}
              
          {/* Close button when voice list is open and a voice is selected */}
          {field.value && (
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onVoiceListOpenChange(false)}
                  >
                    Done
                  </Button>
                </div>
              )}
            </>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

