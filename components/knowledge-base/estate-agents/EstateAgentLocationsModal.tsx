'use client'

import { useMemo, useState } from 'react'
import { IconCopy, IconCheck } from '@tabler/icons-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { KnowledgeBaseItem, RightmovePropertyMetadata } from '@/types/knowledge-base'

interface EstateAgentLocationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: KnowledgeBaseItem[]
}

interface ExtractedLocations {
  cities: Set<string>
  towns: Set<string>
  postcodes: Set<string>
}

export function EstateAgentLocationsModal({
  open,
  onOpenChange,
  properties,
}: EstateAgentLocationsModalProps) {
  const [copied, setCopied] = useState(false)

  const locations = useMemo(() => {
    const result: ExtractedLocations = {
      cities: new Set(),
      towns: new Set(),
      postcodes: new Set(),
    }

    properties.forEach((property) => {
      const metadata = property.metadata as RightmovePropertyMetadata | undefined
      if (!metadata?.address) return

      const address = metadata.address

      // Extract postcode (UK format: e.g., "SW1A 1AA", "EC1A 1BB")
      const postcodeMatch = address.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/i)
      if (postcodeMatch) {
        result.postcodes.add(postcodeMatch[1].toUpperCase())
      }

      // Split address by comma
      const parts = address.split(',').map(p => p.trim())

      // The last part is usually the city/town (or postcode area)
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1]
        // Remove postcode if present
        const locationPart = lastPart.replace(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i, '').trim()
        
        if (locationPart) {
          // Common UK cities
          const ukCities = [
            'London', 'Birmingham', 'Manchester', 'Leeds', 'Liverpool',
            'Sheffield', 'Bristol', 'Glasgow', 'Edinburgh', 'Newcastle',
            'Cardiff', 'Belfast', 'Leicester', 'Nottingham', 'Coventry',
            'Bradford', 'Southampton', 'Brighton'
          ]

          if (ukCities.some(city => locationPart.includes(city))) {
            result.cities.add(locationPart)
          } else {
            result.towns.add(locationPart)
          }
        }
      }

      // Also check for London boroughs in earlier parts
      if (address.includes('London')) {
        const londonBoroughMatch = address.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),.*London/i)
        if (londonBoroughMatch) {
          result.towns.add(londonBoroughMatch[1].trim())
        }
      }
    })

    return result
  }, [properties])

  const formatLocationsText = () => {
    const sections: string[] = []

    if (locations.cities.size > 0) {
      sections.push('Cities:\n' + Array.from(locations.cities).sort().join('\n'))
    }

    if (locations.towns.size > 0) {
      sections.push('Towns/Areas:\n' + Array.from(locations.towns).sort().join('\n'))
    }

    if (locations.postcodes.size > 0) {
      sections.push('Postcode Areas:\n' + Array.from(locations.postcodes).sort().join('\n'))
    }

    return sections.join('\n\n')
  }

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatLocationsText())
      setCopied(true)
      toast.success('Locations copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard')
    }
  }

  const totalLocations = locations.cities.size + locations.towns.size + locations.postcodes.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Property Locations</DialogTitle>
          <DialogDescription>
            Unique locations extracted from {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2">
          {totalLocations === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No locations found in property addresses
            </p>
          ) : (
            <>
              {locations.cities.size > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Cities ({locations.cities.size})</h3>
                  <div className="text-sm text-muted-foreground space-y-1 pl-2">
                    {Array.from(locations.cities).sort().map((city) => (
                      <div key={city}>{city}</div>
                    ))}
                  </div>
                </div>
              )}

              {locations.towns.size > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Towns/Areas ({locations.towns.size})</h3>
                  <div className="text-sm text-muted-foreground space-y-1 pl-2">
                    {Array.from(locations.towns).sort().map((town) => (
                      <div key={town}>{town}</div>
                    ))}
                  </div>
                </div>
              )}

              {locations.postcodes.size > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Postcode Areas ({locations.postcodes.size})</h3>
                  <div className="text-sm text-muted-foreground space-y-1 pl-2">
                    {Array.from(locations.postcodes).sort().map((postcode) => (
                      <div key={postcode}>{postcode}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {totalLocations > 0 && (
            <Button onClick={handleCopyToClipboard} disabled={copied}>
              {copied ? (
                <>
                  <IconCheck className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <IconCopy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

