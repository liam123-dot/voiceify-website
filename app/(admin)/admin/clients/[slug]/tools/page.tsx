import { ToolsList } from "@/components/tools/tools-list"

type ToolsPageProps = {
  params: Promise<{ slug: string }>
}

export default async function ToolsPage({ params }: ToolsPageProps) {

  const { slug } = await params

  return (
    <div className="space-y-4 mt-6">
      <ToolsList slug={slug} />
    </div>
  )
}