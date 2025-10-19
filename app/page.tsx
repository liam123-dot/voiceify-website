import { AuthButtons } from "@/components/auth-buttons"

export default async function Home() {

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Voiceify</h1>
          <p className="text-muted-foreground">
            Sign in or create an account to get started
          </p>
        </div>
        <AuthButtons />
      </div>
    </div>
  )
}
