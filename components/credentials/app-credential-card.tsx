'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Loader2, Trash2, Plus, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppCredentials } from '@/hooks/use-app-credentials'
import type { ConnectionMethod, PipedreamAccount } from '@/types/pipedream'

interface AppCredentialCardProps {
  slug: string
  appSlug: string
  connectionMethod?: ConnectionMethod
  redirectUrl?: string
  onConnectionSuccess?: () => void
  onConnectionRemoved?: () => void
}

export function AppCredentialCard({
  slug,
  appSlug,
  connectionMethod = 'popup',
  redirectUrl,
  onConnectionSuccess,
  onConnectionRemoved,
}: AppCredentialCardProps) {
  const [accountToDelete, setAccountToDelete] = useState<PipedreamAccount | null>(null)

  const {
    app,
    accounts,
    isLoading,
    error,
    connectApp,
    deleteAccount,
    isConnecting,
    isDeleting,
    refetch,
  } = useAppCredentials({
    slug,
    appSlug,
    connectionMethod,
    redirectUrl,
    onConnectionSuccess,
    onConnectionRemoved,
  })

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleDelete = async () => {
    if (accountToDelete) {
      await deleteAccount(accountToDelete)
      setAccountToDelete(null)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Error loading {appSlug}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Failed to load app'}
          </p>
        </CardContent>
      </Card>
    )
  }

  // App not found
  if (!app) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">App not found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Could not find app with slug: {appSlug}
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasConnectedAccounts = accounts.length > 0

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {app.imgSrc ? (
                <img 
                  src={app.imgSrc} 
                  alt={app.name}
                  className="w-10 h-10 rounded object-contain flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-lg font-semibold flex-shrink-0">
                  {app.name.charAt(0).toUpperCase()}
                </div>
              )}
              <CardTitle className="text-base">{app.name}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Connected accounts */}
          {hasConnectedAccounts && (
            <div className="space-y-2">
              {accounts.map((account) => {
                const isHealthy = account.healthy && !account.dead
                const isDead = account.dead
                
                return (
                  <div 
                    key={account.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 ${isDead ? 'opacity-60' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate font-medium">
                        {account.name || 'Connected Account'}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {isDead ? (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <XCircle className="h-3 w-3" />
                            <span>Disconnected</span>
                          </div>
                        ) : isHealthy ? (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Connected</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-yellow-600">
                            <AlertCircle className="h-3 w-3" />
                            <span>Issues</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => setAccountToDelete(account)}
                      disabled={isDeleting && accountToDelete?.id === account.id}
                    >
                      {isDeleting && accountToDelete?.id === account.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Connect/Add another button */}
          <Button 
            onClick={connectApp}
            disabled={isConnecting}
            className="w-full"
            variant={hasConnectedAccounts ? 'outline' : 'default'}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : hasConnectedAccounts ? (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Another Account
              </>
            ) : (
              <>
                Connect {app.name}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect <strong>{accountToDelete?.name || app.name}</strong>? 
              This will revoke access and you&apos;ll need to reconnect to use this integration again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

