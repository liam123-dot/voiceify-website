import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import type { KnowledgeBaseSettingsProps } from '../types'

export function KnowledgeBaseSettings({ 
  control, 
  knowledgeBaseMatchCount 
}: KnowledgeBaseSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge Base Configuration</CardTitle>
        <CardDescription>
          Configure how the agent uses knowledge bases
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={control}
          name="knowledgeBaseUseAsTool"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Use Knowledge Base as Tool
                </FormLabel>
                <FormDescription>
                  When enabled, the LLM decides when to search the knowledge base by calling a tool. When disabled, relevant context is automatically retrieved and pre-injected based on user queries.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        {/* Match Count Configuration */}
        <FormField
          control={control}
          name="knowledgeBaseMatchCount"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Number of Documents to Retrieve</FormLabel>
                <span className="text-sm font-mono text-muted-foreground">
                  {knowledgeBaseMatchCount ?? 3}
                </span>
              </div>
              <FormControl>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[field.value ?? 3]}
                  onValueChange={(value) => field.onChange(value[0])}
                  className="py-4"
                />
              </FormControl>
              <FormDescription>
                Maximum number of relevant documents to retrieve from the knowledge base (1-10)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  )
}

