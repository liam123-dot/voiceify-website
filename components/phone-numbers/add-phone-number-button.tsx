"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AddPhoneNumberForm } from "./add-phone-number-form"

interface AddPhoneNumberButtonProps {
  slug: string
  onSuccess?: () => void
}

export function AddPhoneNumberButton({ slug, onSuccess }: AddPhoneNumberButtonProps) {
  const [open, setOpen] = useState(false)

  const handleSuccess = () => {
    setOpen(false)
    onSuccess?.()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>Add New Phone Number</Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add Phone Number</SheetTitle>
          <SheetDescription>
            Connect a Twilio number to your account
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <AddPhoneNumberForm slug={slug} onSuccess={handleSuccess} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

