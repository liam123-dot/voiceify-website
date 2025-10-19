'use client'

import { CredentialsList } from "@/components/credentials/credentials-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { use } from "react"

interface CredentialsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default function CredentialsPage({ params }: CredentialsPageProps) {
  const { slug } = use(params)

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>
            Manage API credentials and access tokens for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsList slug={slug} />
        </CardContent>
      </Card>
    </div>
  )
}

