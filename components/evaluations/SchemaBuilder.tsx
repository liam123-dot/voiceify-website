'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconPlus, IconTrash, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

type PropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'

interface JSONSchemaProperty {
  type?: PropertyType
  description?: string
  properties?: Record<string, JSONSchemaProperty>
  items?: JSONSchemaProperty
  required?: string[]
}

interface JSONSchema {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

interface SchemaProperty {
  id: string
  name: string
  type: PropertyType
  description: string
  required: boolean
  properties?: SchemaProperty[]
  items?: SchemaProperty
  expanded?: boolean
}

interface SchemaBuilderProps {
  value: JSONSchema | null
  onChange: (schema: JSONSchema) => void
}

export function SchemaBuilder({ value, onChange }: SchemaBuilderProps) {
  const [properties, setProperties] = useState<SchemaProperty[]>([])
  const [nextId, setNextId] = useState(1)

  // Parse JSON schema into our property structure
  useEffect(() => {
    if (value && value.properties) {
      const parsed = parseSchemaToProperties(value)
      setProperties(parsed)
    }
  }, []) // Only run once on mount

  const parseSchemaToProperties = (schema: JSONSchema | JSONSchemaProperty): SchemaProperty[] => {
    if (!schema.properties) return []

    return Object.entries(schema.properties).map(([name, prop]) => {
      const property: SchemaProperty = {
        id: `prop-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type: prop.type || 'string',
        description: prop.description || '',
        required: schema.required?.includes(name) || false,
        expanded: false,
      }

      if (prop.type === 'object' && prop.properties) {
        const nestedSchema: JSONSchemaProperty = {
          type: 'object',
          properties: prop.properties,
          required: prop.required,
        }
        property.properties = parseSchemaToProperties(nestedSchema)
      }

      if (prop.type === 'array' && prop.items) {
        property.items = {
          id: `prop-${Math.random().toString(36).substr(2, 9)}`,
          name: 'items',
          type: prop.items.type || 'string',
          description: prop.items.description || '',
          required: false,
          properties: prop.items.type === 'object' && prop.items.properties
            ? parseSchemaToProperties(prop.items as JSONSchemaProperty)
            : undefined,
        }
      }

      return property
    })
  }

  // Convert our property structure to JSON schema
  const propertiesToSchema = (props: SchemaProperty[]): JSONSchema => {
    const schema: JSONSchema = {
      type: 'object',
      properties: {},
      required: [],
    }

    props.forEach((prop) => {
      const propSchema: JSONSchemaProperty = {
        type: prop.type,
        description: prop.description,
      }

      if (prop.type === 'object' && prop.properties && prop.properties.length > 0) {
        const nestedSchema = propertiesToSchema(prop.properties)
        propSchema.properties = nestedSchema.properties
        propSchema.required = nestedSchema.required
      }

      if (prop.type === 'array' && prop.items) {
        propSchema.items = {
          type: prop.items.type,
          description: prop.items.description,
        }

        if (prop.items.type === 'object' && prop.items.properties && prop.items.properties.length > 0) {
          const nestedSchema = propertiesToSchema(prop.items.properties)
          propSchema.items.properties = nestedSchema.properties
          propSchema.items.required = nestedSchema.required
        }
      }

      schema.properties[prop.name] = propSchema

      if (prop.required && schema.required) {
        schema.required.push(prop.name)
      }
    })

    if (schema.required && schema.required.length === 0) {
      delete schema.required
    }

    return schema
  }

  const updateSchema = (newProperties: SchemaProperty[]) => {
    setProperties(newProperties)
    const schema = propertiesToSchema(newProperties)
    onChange(schema)
  }

  const addProperty = (parentPath?: number[]) => {
    const newProp: SchemaProperty = {
      id: `prop-${nextId}`,
      name: '',
      type: 'string',
      description: '',
      required: false,
    }
    setNextId(nextId + 1)

    if (!parentPath) {
      updateSchema([...properties, newProp])
    } else {
      const newProperties = [...properties]
      let target = newProperties

      for (let i = 0; i < parentPath.length - 1; i++) {
        const prop = target[parentPath[i]]
        if (prop.type === 'object') {
          target = prop.properties = prop.properties || []
        } else if (prop.type === 'array' && prop.items) {
          target = prop.items.properties = prop.items.properties || []
        }
      }

      const parentIndex = parentPath[parentPath.length - 1]
      const parent = target[parentIndex]

      if (parent.type === 'object') {
        parent.properties = parent.properties || []
        parent.properties.push(newProp)
      } else if (parent.type === 'array' && parent.items) {
        parent.items.properties = parent.items.properties || []
        parent.items.properties.push(newProp)
      }

      updateSchema(newProperties)
    }
  }

  const removeProperty = (path: number[]) => {
    const newProperties = [...properties]

    if (path.length === 1) {
      newProperties.splice(path[0], 1)
    } else {
      let target = newProperties
      for (let i = 0; i < path.length - 1; i++) {
        const prop = target[path[i]]
        if (prop.type === 'object' && prop.properties) {
          target = prop.properties
        } else if (prop.type === 'array' && prop.items?.properties) {
          target = prop.items.properties
        }
      }
      target.splice(path[path.length - 1], 1)
    }

    updateSchema(newProperties)
  }

  const updateProperty = (path: number[], field: keyof SchemaProperty, value: string | boolean | PropertyType) => {
    const newProperties = [...properties]
    let target = newProperties

    for (let i = 0; i < path.length - 1; i++) {
      const prop = target[path[i]]
      if (prop.type === 'object' && prop.properties) {
        target = prop.properties
      } else if (prop.type === 'array' && prop.items?.properties) {
        target = prop.items.properties
      }
    }

    const prop = target[path[path.length - 1]]

    if (field === 'type') {
      prop.type = value as PropertyType
      // Initialize nested structures if needed
      if (value === 'object') {
        prop.properties = prop.properties || []
      } else if (value === 'array') {
        prop.items = prop.items || {
          id: `prop-${nextId}`,
          name: 'items',
          type: 'string',
          description: '',
          required: false,
        }
        setNextId(nextId + 1)
      } else {
        delete prop.properties
        delete prop.items
      }
    } else if (field === 'name' || field === 'description') {
      prop[field] = value as string
    } else if (field === 'required') {
      prop[field] = value as boolean
    }

    updateSchema(newProperties)
  }

  const toggleExpanded = (path: number[]) => {
    const newProperties = [...properties]
    let target = newProperties

    for (let i = 0; i < path.length - 1; i++) {
      const prop = target[path[i]]
      if (prop.type === 'object' && prop.properties) {
        target = prop.properties
      } else if (prop.type === 'array' && prop.items?.properties) {
        target = prop.items.properties
      }
    }

    target[path[path.length - 1]].expanded = !target[path[path.length - 1]].expanded
    setProperties([...newProperties])
  }

  const renderProperty = (prop: SchemaProperty, path: number[], depth: number = 0) => {
    const hasNested = (prop.type === 'object' && prop.properties) || 
                     (prop.type === 'array' && prop.items?.type === 'object' && prop.items.properties)
    const isExpanded = prop.expanded || false

    return (
      <div key={prop.id} className={cn("space-y-2", depth > 0 && "ml-6 pl-4 border-l-2 border-muted")}>
        <div className="grid grid-cols-12 gap-3 items-start">
          {/* Expand/Collapse Button */}
          <div className="col-span-1 flex items-center justify-center pt-2">
            {hasNested && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => toggleExpanded(path)}
              >
                {isExpanded ? (
                  <IconChevronDown className="h-4 w-4" />
                ) : (
                  <IconChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* Property Name */}
          <div className="col-span-3">
            <Input
              placeholder="Property name"
              value={prop.name}
              onChange={(e) => updateProperty(path, 'name', e.target.value)}
            />
          </div>

          {/* Type Selector */}
          <div className="col-span-2">
            <Select
              value={prop.type}
              onValueChange={(value) => updateProperty(path, 'type', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="integer">Integer</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                <SelectItem value="array">Array</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Required Checkbox */}
          <div className="col-span-2 flex items-center justify-center pt-2">
            <Checkbox
              checked={prop.required}
              onCheckedChange={(checked) => updateProperty(path, 'required', checked)}
              id={`required-${prop.id}`}
            />
            <label
              htmlFor={`required-${prop.id}`}
              className="ml-2 text-sm text-muted-foreground cursor-pointer"
            >
              Required
            </label>
          </div>

          {/* Actions */}
          <div className="col-span-4 flex items-center justify-end gap-2 pt-2">
            {(prop.type === 'object' || (prop.type === 'array' && prop.items?.type === 'object')) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addProperty([...path])}
              >
                <IconPlus className="h-3 w-3 mr-1" />
                Add Nested
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeProperty(path)}
            >
              <IconTrash className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Description */}
        <div className="grid grid-cols-12 gap-3 mt-2">
          <div className="col-span-1"></div>
          <div className="col-span-11">
            <Textarea
              placeholder="Describe this property's purpose and expected values... This will be used by the LLM to extract this property"
              value={prop.description}
              onChange={(e) => updateProperty(path, 'description', e.target.value)}
              className="resize-none text-sm"
              rows={2}
            />
          </div>
        </div>

        {/* Nested Properties */}
        {isExpanded && prop.type === 'object' && prop.properties && (
          <div className="space-y-2 mt-2">
            {prop.properties.map((nestedProp, index) =>
              renderProperty(nestedProp, [...path, index], depth + 1)
            )}
          </div>
        )}

        {/* Array Items */}
        {isExpanded && prop.type === 'array' && prop.items?.type === 'object' && prop.items.properties && (
          <div className="space-y-2 mt-2">
            <div className="ml-6 text-sm text-muted-foreground">Array Item Properties:</div>
            {prop.items.properties.map((nestedProp, index) =>
              renderProperty(nestedProp, [...path, index], depth + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-6">
        <div className="grid grid-cols-12 gap-3 mb-4 text-sm font-medium text-muted-foreground">
          <div className="col-span-1 text-center"></div>
          <div className="col-span-3">Property</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2 text-center">Required</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        
        <div className="space-y-4">
          {properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No properties defined. Add a property to get started.
            </div>
          ) : (
            properties.map((prop, index) => renderProperty(prop, [index]))
          )}
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => addProperty()}
        className="w-full"
      >
        <IconPlus className="h-4 w-4 mr-2" />
        Add Property
      </Button>
    </div>
  )
}

