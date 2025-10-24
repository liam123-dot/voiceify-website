'use client'

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface AccessButtonProps {
  baseUrl: string
  slug: string
}

export function AccessButton({ baseUrl, slug }: AccessButtonProps) {
  const router = useRouter()

  return (
    <Button 
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.preventDefault()
        if (baseUrl) {
          router.push(`${baseUrl}/${slug}`)
        }
      }}
    >
      Access
    </Button>
  )
}

