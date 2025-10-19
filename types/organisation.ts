// types/organisation.ts

export interface Permission {
  id: string;
  label: string;
  enabled: boolean;
}

export interface PermissionCategory {
  id: string;
  title: string;
  permissions: Permission[];
}

export interface Organisation {
  id: string;
  external_id: string; // WorkOS organization ID
  slug: string;
  permissions: PermissionCategory[];
  created_at?: string;
  updated_at?: string;
}

// Default permissions structure
export const DEFAULT_PERMISSIONS: PermissionCategory[] = [
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
];

