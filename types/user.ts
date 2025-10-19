// types/user.ts
export interface User {
  id: string;
  external_id: string; // WorkOS user ID
  created_at?: string;
  updated_at?: string;
}

