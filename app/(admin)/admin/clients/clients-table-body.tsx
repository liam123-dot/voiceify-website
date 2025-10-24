import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { IconBuilding } from "@tabler/icons-react"
import { AccessButton } from "@/app/(admin)/admin/clients/access-button"

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
  return (
    <TableBody>
      {organizations
        .filter((org): org is Organization & { slug: string } => !!org.slug)
        .map((org) => (
        <TableRow 
          key={org.id}
          className="hover:bg-muted/30"
        >
          <TableCell className="text-center">
            <Link 
              href={`/admin/clients/${org.slug}`}
              className="flex items-center justify-center text-muted-foreground"
              prefetch={true}
            >
              <IconBuilding className="h-4 w-4" />
            </Link>
          </TableCell>
          <TableCell>
            <Link 
              href={`/admin/clients/${org.slug}`}
              className="flex items-center gap-2"
              prefetch={true}
            >
              <span className="font-medium text-sm">{org.name}</span>
            </Link>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            <Link 
              href={`/admin/clients/${org.slug}`}
              className="block"
              prefetch={true}
            >
              {org.createdAt
                ? new Date(org.createdAt).toLocaleDateString()
                : '—'
              }
            </Link>
          </TableCell>
          <TableCell className="text-right">
            <AccessButton baseUrl={baseUrl} slug={org.slug} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  )
}
