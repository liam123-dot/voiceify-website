import { Suspense } from "react"
import { CreateToolForm } from "./create-tool-form"

type CreateToolPageProps = {
  params: Promise<{ slug: string }>
}

export default async function CreateToolPage({ params }: CreateToolPageProps) {
  const { slug } = await params

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="max-w-2xl">
          <Suspense fallback={<div>Loading...</div>}>
            <CreateToolForm slug={slug} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

