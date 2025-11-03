
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CredentialsList } from "@/components/credentials/credentials-list"
import { ToolsList } from "@/components/tools/tools-list"

type ToolsPageProps = {
  params: Promise<{ slug: string }>
}

export default async function ToolsPage({ params }: ToolsPageProps) {
  const { slug } = await params

  return (
    <div className="px-4 lg:px-6">
      <Tabs defaultValue="tools" className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="space-y-4">
          <ToolsList slug={slug} />
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <CredentialsList slug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

