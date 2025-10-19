import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { 
  AppCredentialResponse, 
  TokenResponse, 
  DeleteAccountResponse,
  ConnectionMethod,
  PipedreamAccount 
} from '@/types/pipedream'

interface UseAppCredentialsOptions {
  slug: string
  appSlug: string
  connectionMethod?: ConnectionMethod
  redirectUrl?: string
  onConnectionSuccess?: () => void
  onConnectionRemoved?: () => void
}

export function useAppCredentials({
  slug,
  appSlug,
  connectionMethod = 'popup',
  redirectUrl,
  onConnectionSuccess,
  onConnectionRemoved,
}: UseAppCredentialsOptions) {
  const queryClient = useQueryClient()

  // Fetch app details and connected accounts
  const { data, isLoading, error, refetch } = useQuery<AppCredentialResponse>({
    queryKey: ['app-credentials', slug, appSlug],
    queryFn: async () => {
      const response = await fetch(`/api/${slug}/tools/credentials/app/${appSlug}`)
      if (!response.ok) {
        throw new Error('Failed to fetch app credentials')
      }
      return response.json()
    },
  })

  // Fetch connection token
  const fetchTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/${slug}/tools/credentials/token`)
      if (!response.ok) {
        throw new Error('Failed to generate connect token')
      }
      return response.json() as Promise<TokenResponse>
    },
  })

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/${slug}/tools/credentials/${accountId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }
      
      return response.json() as Promise<DeleteAccountResponse>
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Account disconnected successfully')
      queryClient.invalidateQueries({ queryKey: ['app-credentials', slug, appSlug] })
      onConnectionRemoved?.()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect account')
    },
  })

  // Connect app function
  const connectApp = async () => {
    try {
      // Generate token
      const tokenData = await fetchTokenMutation.mutateAsync()
      
      if (!tokenData.success || !tokenData.connectLinkUrl) {
        throw new Error('Failed to generate connection token')
      }

      // Construct Connect URL with app slug
      const connectUrl = new URL(tokenData.connectLinkUrl)
      connectUrl.searchParams.set('app', appSlug)
      
      // Add custom redirect URL if provided
      if (redirectUrl) {
        connectUrl.searchParams.set('redirect_url', redirectUrl)
      }

      const url = connectUrl.toString()

      // Handle different connection methods
      switch (connectionMethod) {
        case 'popup': {
          const width = 600
          const height = 700
          const left = window.screen.width / 2 - width / 2
          const top = window.screen.height / 2 - height / 2
          window.open(
            url,
            'pipedream-connect',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
          )
          toast.success('Opening connection window...', {
            description: 'Complete the authentication in the popup',
          })
          break
        }
        case 'new-tab':
          window.open(url, '_blank')
          toast.success('Opening connection in new tab...')
          break
        case 'same-tab':
          window.location.href = url
          return // Don't continue as we're navigating away
      }

      // Poll for the new connection with multiple retries
      // Pipedream may take a moment to register the connection
      const pollAttempts = [2000, 4000, 6000, 10000] // Poll at 2s, 4s, 6s, 10s
      pollAttempts.forEach((delay) => {
        setTimeout(() => {
          refetch()
        }, delay)
      })

      // Call success callback after initial delay
      setTimeout(() => {
        onConnectionSuccess?.()
      }, 2000)
    } catch (error) {
      console.error('Error connecting app:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to connect app')
    }
  }

  // Delete account function
  const deleteAccount = async (account: PipedreamAccount) => {
    await deleteAccountMutation.mutateAsync(account.id)
  }

  return {
    app: data?.app || null,
    accounts: data?.accounts || [],
    total: data?.total || 0,
    isLoading,
    error,
    connectApp,
    deleteAccount,
    isConnecting: fetchTokenMutation.isPending,
    isDeleting: deleteAccountMutation.isPending,
    refetch,
  }
}

