"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface KeywordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  organizationId: string;
  currentKeywords: string[];
  onKeywordsUpdated: (keywords: string[]) => void;
}

export function KeywordsDialog({
  open,
  onOpenChange,
  agentId,
  organizationId,
  currentKeywords,
  onKeywordsUpdated,
}: KeywordsDialogProps) {
  const [keywords, setKeywords] = useState<string[]>(currentKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Reset keywords when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setKeywords(currentKeywords);
      setNewKeyword("");
    }
    onOpenChange(newOpen);
  };

  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) {
      toast.error("Keyword cannot be empty");
      return;
    }

    if (keywords.includes(trimmed)) {
      toast.error("Keyword already exists");
      return;
    }

    setKeywords([...keywords, trimmed]);
    setNewKeyword("");
  };

  const removeKeyword = (keywordToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== keywordToRemove));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/${organizationId}/agents/${agentId}/keywords`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ keywords }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update keywords");
      }

      const data = await response.json();
      onKeywordsUpdated(data.keywords);
      toast.success("Keywords updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating keywords:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update keywords"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Manage STT Keywords</DialogTitle>
          <DialogDescription>
            Add domain-specific keywords to improve transcription accuracy for
            your agent. These keywords help the speech-to-text model better
            recognize specialized terminology.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new keyword input */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter a keyword..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <Button
              type="button"
              onClick={addKeyword}
              disabled={isLoading || !newKeyword.trim()}
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Current keywords */}
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Keywords ({keywords.length})
            </div>
            {keywords.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
                No keywords added yet. Add keywords to improve transcription
                accuracy.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-4 border rounded-lg min-h-[100px]">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    className="text-sm pl-3 pr-1 py-1"
                  >
                    {keyword}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 hover:bg-destructive/20"
                      onClick={() => removeKeyword(keyword)}
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Keywords
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

