import { requireAdmin } from "@/app/(admin)/lib/admin-auth"
import { AdminCallsContainer } from "@/components/calls/admin-calls-container"

export default async function AdminCallsPage() {
  await requireAdmin()
  
  return <AdminCallsContainer />
}