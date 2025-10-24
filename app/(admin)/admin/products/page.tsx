import CreateNewProduct from "@/app/(admin)/admin-components/create-new-product"

export default async function ProductsPage() {

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground mt-2">
              Manage your subscription products and pricing
            </p>
          </div>
          <CreateNewProduct />
        </div>
        
        <div className="rounded-lg border bg-card">
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              No products yet. Create your first product to get started.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

