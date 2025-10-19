"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconTrash, IconLoader2 } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DeletePhoneNumberButtonProps {
  phoneNumberId: string
  phoneNumber: string
  onSuccess?: () => void
}

export function DeletePhoneNumberButton({ 
  phoneNumberId, 
  phoneNumber,
  onSuccess 
}: DeletePhoneNumberButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/phone-numbers/${phoneNumberId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete phone number')
      }

      toast.success("Phone number deleted successfully", {
        description: `${phoneNumber} has been removed from your account.`,
      })
      
      // Close the dialog
      setOpen(false)
      
      // Call onSuccess callback if provided, otherwise refresh
      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : "An error occurred while deleting the phone number."
      
      toast.error("Failed to delete phone number", {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{phoneNumber}</strong> from your account.
            This action will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Remove the number from LiveKit SIP trunk</li>
              <li>Clear the Twilio webhook configuration</li>
              <li>Delete the phone number record</li>
            </ul>
            <p className="mt-2 font-semibold">This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

