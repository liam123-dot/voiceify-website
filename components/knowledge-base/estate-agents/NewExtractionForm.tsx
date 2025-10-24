'use client'

import { useState } from 'react'
import { IconLoader2, IconSparkles } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ExtractionModel } from '@/types/extractions'

interface NewExtractionFormProps {
  propertyCount: number
  onSubmit: (data: { name: string; prompt: string; model: ExtractionModel }) => void
  isSubmitting: boolean
}

const EXAMPLE_PROMPTS = [
  {
    name: 'Property Types',
    prompt: 'Extract the property type. CONSISTENCY IS CRITICAL - Always return EXACTLY ONE of these standard values: "Apartment", "House", "Terraced House", "Semi-Detached", "Flat", "Bungalow", "Studio", or "Maisonette". Do not invent new types or variations. Return only the exact type as a single value.',
  },
  {
    name: 'Bedroom Counts',
    prompt: 'Extract the exact number of bedrooms. CONSISTENCY IS CRITICAL - Return ONLY a single digit (e.g., "1", "2", "3", "4", "5", "6", "7", "8+"). Do not return text or ranges. If the number is 8 or more, return "8+". If unknown, return empty array.',
  },
  {
    name: 'Cities & Towns',
    prompt: 'Extract the city or town where the property is located. CONSISTENCY IS CRITICAL - Always use the standard UK city/town name exactly as it appears on official UK maps (e.g., "London", "Manchester", "Birmingham", "Leeds", "Bristol", "Edinburgh", "Cardiff", "Belfast"). Return the primary city/town only, without postcodes or street names. Return only ONE city/town per property.',
  },
  {
    name: 'Local Area/District',
    prompt: 'Extract the specific local area or district. CONSISTENCY IS CRITICAL - Always return in the format: "[District/Area Name] [City]" (e.g., "Elephant & Castle London", "Shoreditch London", "City Centre Manchester", "Southside Birmingham", "Covent Garden London"). Use standardized district names. Must be consistent across all properties. Return only ONE area per property.',
  },
  {
    name: 'Parking Information',
    prompt: 'Extract parking availability. CONSISTENCY IS CRITICAL - Return EXACTLY ONE of these standard values: "Yes", "No", "Garage", "Street", "Covered", "Off-street", or "Unknown". Do not create variations. Use these exact values only.',
  },
  {
    name: 'Property Status',
    prompt: 'Identify if the property is new or resale. CONSISTENCY IS CRITICAL - Return EXACTLY ONE of these two standard values: "New Build" or "Resale". No other variations allowed. If unknown, return empty array.',
  },
  {
    name: 'Key Features',
    prompt: 'Extract the 3 most important unique features or amenities. CONSISTENCY IS CRITICAL - Always use standardized feature names (e.g., "Garden", "Balcony", "En-suite", "Gym", "Pool", "Parking", "Lift", "Concierge", "Terrace", "Patio", "Courtyard", "Study", "Utility Room", "Fitted Kitchen", "Wood Floors"). Return up to 3 features per property using only standard feature names.',
  },
]

export function NewExtractionForm({ propertyCount, onSubmit, isSubmitting }: NewExtractionFormProps) {
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ExtractionModel>('google/gemini-2.5-flash')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !prompt) return
    onSubmit({ name, prompt, model })
    // Reset form
    setName('')
    setPrompt('')
  }

  const loadExample = (example: typeof EXAMPLE_PROMPTS[0]) => {
    setName(example.name)
    setPrompt(example.prompt)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert>
        <IconSparkles className="h-4 w-4" />
        <AlertDescription>
          This will analyze all {propertyCount} properties using AI to extract structured data based on your custom prompt.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="name">Extraction Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Property Types, Bedroom Counts"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSubmitting}
        />
        <p className="text-sm text-muted-foreground">
          A descriptive name to identify this extraction run
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="model">AI Model *</Label>
        <Select value={model} onValueChange={(v) => setModel(v as ExtractionModel)} disabled={isSubmitting}>
          <SelectTrigger id="model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai/gpt-5-nano">
              <div>
                <div className="font-medium">GPT-5 Nano</div>
                <div className="text-xs text-muted-foreground">Fast & cheapest - simple extractions</div>
              </div>
            </SelectItem>
            <SelectItem value="openai/gpt-5-mini">
              <div>
                <div className="font-medium">GPT-5 Mini</div>
                <div className="text-xs text-muted-foreground">Balanced - most use cases</div>
              </div>
            </SelectItem>
            <SelectItem value="google/gemini-2.5-flash">
              <div>
                <div className="font-medium">Gemini 2.5 Flash</div>
                <div className="text-xs text-muted-foreground">Best reasoning - complex extractions</div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">Extraction Prompt *</Label>
        <Textarea
          id="prompt"
          placeholder="e.g., Extract the property type from the metadata and description..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          disabled={isSubmitting}
          className="min-h-[120px] resize-none"
        />
        <p className="text-sm text-muted-foreground">
          Describe what you want to extract. Be specific about the format.
        </p>
      </div>

      <div className="space-y-2">
        <Label>💡 Example Prompts</Label>
        <div className="grid gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example.name}
              type="button"
              onClick={() => loadExample(example)}
              disabled={isSubmitting}
              className="text-left p-3 rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <div className="font-medium text-sm">{example.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{example.prompt}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !name || !prompt} size="lg">
          {isSubmitting ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting Extraction...
            </>
          ) : (
            <>
              <IconSparkles className="mr-2 h-4 w-4" />
              Start Extraction
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

