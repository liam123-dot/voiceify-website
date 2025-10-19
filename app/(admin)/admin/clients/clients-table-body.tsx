'use client'

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { IconBuilding } from "@tabler/icons-react"

interface Organization {
  id: string
  name: string
  slug?: string
  createdAt?: string
}

interface ClientsTableBodyProps {
  organizations: Organization[]
  baseUrl: string
}

export function ClientsTableBody({ organizations, baseUrl }: ClientsTableBodyProps) {
  const router = useRouter()

  return (
    <TableBody>
      {organizations
        .filter((org): org is Organization & { slug: string } => !!org.slug)
        .map((org) => (
        <TableRow 
          key={org.id}
          className="hover:bg-muted/30 cursor-pointer"
          onClick={() => router.push(`/admin/clients/${org.slug}`)}
        >
          <TableCell className="text-center">
            <div className="flex items-center justify-center text-muted-foreground">
              <IconBuilding className="h-4 w-4" />
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{org.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {org.createdAt
              ? new Date(org.createdAt).toLocaleDateString()
              : '—'
            }
          </TableCell>
          <TableCell className="text-right">
            <Button 
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                if (baseUrl) {
                  window.location.href = `${baseUrl}/${org.slug}`
                }
              }}
            >
              Access
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}
