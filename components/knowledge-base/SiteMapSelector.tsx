'use client'

import { useState, useMemo } from "react"
import { IconSearch, IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface SiteMapSelectorProps {
  urls: string[]
  selectedUrls: string[]
  onSelectionChange: (urls: string[]) => void
}

export function SiteMapSelector({ urls, selectedUrls, onSelectionChange }: SiteMapSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())

  // Group URLs by domain
  const urlsByDomain = useMemo(() => {
    const grouped = new Map<string, string[]>()
    
    urls.forEach(url => {
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname
        if (!grouped.has(domain)) {
          grouped.set(domain, [])
        }
        grouped.get(domain)?.push(url)
      } catch {
        // Invalid URL, skip
        console.warn("Invalid URL:", url)
      }
    })
    
    return grouped
  }, [urls])

  // Filter URLs based on search query
  const filteredUrlsByDomain = useMemo(() => {
    if (!searchQuery) return urlsByDomain

    const filtered = new Map<string, string[]>()
    
    urlsByDomain.forEach((domainUrls, domain) => {
      const matchingUrls = domainUrls.filter(url =>
        url.toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (matchingUrls.length > 0) {
        filtered.set(domain, matchingUrls)
      }
    })
    
    return filtered
  }, [urlsByDomain, searchQuery])

  const toggleDomain = (domain: string) => {
    const newExpanded = new Set(expandedDomains)
    if (newExpanded.has(domain)) {
      newExpanded.delete(domain)
    } else {
      newExpanded.add(domain)
    }
    setExpandedDomains(newExpanded)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(urls)
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectDomain = (domain: string, checked: boolean) => {
    const domainUrls = urlsByDomain.get(domain) || []
    if (checked) {
      const newSelection = [...new Set([...selectedUrls, ...domainUrls])]
      onSelectionChange(newSelection)
    } else {
      const newSelection = selectedUrls.filter(url => !domainUrls.includes(url))
      onSelectionChange(newSelection)
    }
  }

  const handleSelectUrl = (url: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedUrls, url])
    } else {
      onSelectionChange(selectedUrls.filter(u => u !== url))
    }
  }

  const handleInvertSelection = () => {
    const newSelection = urls.filter(url => !selectedUrls.includes(url))
    onSelectionChange(newSelection)
  }

  const handleClearSelection = () => {
    onSelectionChange([])
  }

  const isDomainSelected = (domain: string) => {
    const domainUrls = urlsByDomain.get(domain) || []
    return domainUrls.length > 0 && domainUrls.every(url => selectedUrls.includes(url))
  }

  const isDomainIndeterminate = (domain: string) => {
    const domainUrls = urlsByDomain.get(domain) || []
    const selectedCount = domainUrls.filter(url => selectedUrls.includes(url)).length
    return selectedCount > 0 && selectedCount < domainUrls.length
  }

  const isAllSelected = urls.length > 0 && selectedUrls.length === urls.length
  const isAllIndeterminate = selectedUrls.length > 0 && selectedUrls.length < urls.length

  return (
    <div className="flex flex-col h-[400px] border rounded-md">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Search Box */}
        <div className="relative mb-3">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select All Checkbox */}
        <div className="flex items-center space-x-2 mb-3">
          <Checkbox
            id="select-all"
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            className={cn(isAllIndeterminate && "data-[state=checked]:bg-primary")}
            {...(isAllIndeterminate && { "data-state": "indeterminate" } as Record<string, unknown>)}
          />
          <label
            htmlFor="select-all"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Select All ({urls.length})
          </label>
        </div>

        {/* URLs List */}
        <div className="space-y-1">
          {Array.from(filteredUrlsByDomain.entries()).map(([domain, domainUrls]) => (
            <div key={domain}>
              {/* Domain Header */}
              <div className="flex items-center space-x-2 py-2 hover:bg-accent rounded-md px-2">
                <button
                  onClick={() => toggleDomain(domain)}
                  className="p-0 hover:bg-transparent"
                >
                  {expandedDomains.has(domain) ? (
                    <IconChevronDown className="h-4 w-4" />
                  ) : (
                    <IconChevronRight className="h-4 w-4" />
                  )}
                </button>
                <Checkbox
                  id={`domain-${domain}`}
                  checked={isDomainSelected(domain)}
                  onCheckedChange={(checked) => handleSelectDomain(domain, checked === true)}
                  className={cn(isDomainIndeterminate(domain) && "data-[state=checked]:bg-primary")}
                  {...(isDomainIndeterminate(domain) && { "data-state": "indeterminate" } as Record<string, unknown>)}
                />
                <label
                  htmlFor={`domain-${domain}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                  onClick={() => toggleDomain(domain)}
                >
                  {domain} ({domainUrls.length})
                </label>
              </div>

              {/* Domain URLs */}
              {expandedDomains.has(domain) && (
                <div className="ml-6 space-y-1">
                  {domainUrls.map((url) => (
                    <div key={url} className="flex items-center space-x-2 py-2 hover:bg-accent rounded-md px-2">
                      <Checkbox
                        id={`url-${url}`}
                        checked={selectedUrls.includes(url)}
                        onCheckedChange={(checked) => handleSelectUrl(url, checked === true)}
                      />
                      <label
                        htmlFor={`url-${url}`}
                        className="text-sm cursor-pointer flex-1 truncate"
                        title={url}
                      >
                        {url}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="flex items-center justify-between p-3 border-t bg-background">
        <span className="text-sm text-muted-foreground">
          {selectedUrls.length} items selected
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleInvertSelection}>
            Invert Selection
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearSelection}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}

