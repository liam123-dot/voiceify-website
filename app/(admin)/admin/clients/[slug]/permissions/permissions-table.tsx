'use client'

import { useState, useEffect, useCallback } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { PermissionCategory } from "@/types/organisation"

interface PermissionsTableProps {
  organizationId: string
  initialPermissions?: PermissionCategory[]
}

export function PermissionsTable({ organizationId, initialPermissions }: PermissionsTableProps) {
  const [categories, setCategories] = useState<PermissionCategory[]>(initialPermissions || [
    {
      id: 'agents',
      title: 'Agents',
      permissions: [
        { id: 'agents.view', label: 'View Agents', enabled: false },
        { id: 'agents.create', label: 'Create Agents', enabled: false },
        { id: 'agents.edit', label: 'Edit Agents', enabled: false },
        { id: 'agents.delete', label: 'Delete Agents', enabled: false },
      ]
    },
    {
      id: 'knowledge-bases',
      title: 'Knowledge Bases',
      permissions: [
        { id: 'knowledge-bases.view', label: 'View Knowledge Bases', enabled: false },
        { id: 'knowledge-bases.create', label: 'Create Knowledge Bases', enabled: false },
        { id: 'knowledge-bases.edit', label: 'Edit Knowledge Bases', enabled: false },
        { id: 'knowledge-bases.delete', label: 'Delete Knowledge Bases', enabled: false },
      ]
    },
    {
      id: 'tools',
      title: 'Tools',
      permissions: [
        { id: 'tools.view', label: 'View Tools', enabled: false },
        { id: 'tools.create', label: 'Create Tools', enabled: false },
        { id: 'tools.edit', label: 'Edit Tools', enabled: false },
        { id: 'tools.delete', label: 'Delete Tools', enabled: false },
      ]
    },
    {
      id: 'credentials',
      title: 'Credentials',
      permissions: [
        { id: 'credentials.view', label: 'View Credentials', enabled: false },
        { id: 'credentials.create', label: 'Create Credentials', enabled: false },
        { id: 'credentials.edit', label: 'Edit Credentials', enabled: false },
        { id: 'credentials.delete', label: 'Delete Credentials', enabled: false },
      ]
    },
    {
      id: 'phone-numbers',
      title: 'Phone Numbers',
      permissions: [
        { id: 'phone-numbers.view', label: 'View Phone Numbers', enabled: false },
        { id: 'phone-numbers.create', label: 'Create Phone Numbers', enabled: false },
        { id: 'phone-numbers.edit', label: 'Edit Phone Numbers', enabled: false },
        { id: 'phone-numbers.delete', label: 'Delete Phone Numbers', enabled: false },
      ]
    },
  ])

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const loadPermissions = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/permissions`)
      if (!response.ok) {
        throw new Error('Failed to load permissions')
      }
      const data = await response.json()
      if (data.success && data.permissions) {
        setCategories(data.permissions)
      }
    } catch (error) {
      console.error('Error loading permissions:', error)
      toast.error('Failed to load permissions')
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  // Load permissions from API if not provided initially
  useEffect(() => {
    if (!initialPermissions) {
      loadPermissions()
    }
  }, [initialPermissions, loadPermissions])

  // Check if all permissions in a category are enabled
  const isCategoryFullyEnabled = (category: PermissionCategory) => {
    return category.permissions.every(p => p.enabled)
  }

  // Check if some (but not all) permissions in a category are enabled
  const isCategoryPartiallyEnabled = (category: PermissionCategory) => {
    const enabledCount = category.permissions.filter(p => p.enabled).length
    return enabledCount > 0 && enabledCount < category.permissions.length
  }

  // Toggle all permissions in a category
  const toggleCategory = (categoryId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        const allEnabled = isCategoryFullyEnabled(cat)
        return {
          ...cat,
          permissions: cat.permissions.map(p => ({
            ...p,
            enabled: !allEnabled
          }))
        }
      }
      return cat
    }))
  }

  // Toggle a single permission
  const togglePermission = (categoryId: string, permissionId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          permissions: cat.permissions.map(p => 
            p.id === permissionId ? { ...p, enabled: !p.enabled } : p
          )
        }
      }
      return cat
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions: categories }),
      })

      if (!response.ok) {
        throw new Error('Failed to save permissions')
      }

      const data = await response.json()
      
      if (data.success) {
        toast.success('Permissions saved successfully')
      } else {
        throw new Error(data.error || 'Failed to save permissions')
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Failed to save permissions')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.id} className="border rounded-lg overflow-hidden">
            {/* Category Header */}
            <div className="bg-muted/30 px-4 py-3 border-b">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={isCategoryFullyEnabled(category)}
                  onCheckedChange={() => toggleCategory(category.id)}
                  className={isCategoryPartiallyEnabled(category) ? "data-[state=checked]:bg-primary/50" : ""}
                />
                <Label
                  htmlFor={`category-${category.id}`}
                  className="text-base font-semibold cursor-pointer select-none"
                >
                  {category.title}
                </Label>
                {isCategoryPartiallyEnabled(category) && (
                  <span className="text-xs text-muted-foreground">(Partial)</span>
                )}
              </div>
            </div>

            {/* Permission Items */}
            <div className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {category.permissions.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={permission.id}
                      checked={permission.enabled}
                      onCheckedChange={() => togglePermission(category.id, permission.id)}
                    />
                    <Label
                      htmlFor={permission.id}
                      className="text-sm font-normal cursor-pointer select-none"
                    >
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Permissions'}
        </Button>
      </div>

      {/* Summary */}
      <div className="rounded-lg border p-4 bg-muted/10">
        <h4 className="font-semibold text-sm mb-2">Permission Summary</h4>
        <div className="space-y-1 text-sm text-muted-foreground">
          {categories.map(cat => {
            const enabledCount = cat.permissions.filter(p => p.enabled).length
            const totalCount = cat.permissions.length
            return (
              <div key={cat.id} className="flex justify-between">
                <span>{cat.title}:</span>
                <span className={enabledCount > 0 ? "font-medium text-foreground" : ""}>
                  {enabledCount} / {totalCount} enabled
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

