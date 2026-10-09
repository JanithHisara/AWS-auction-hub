export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_AUCTIONS: 'manage_auctions',
  MANAGE_ITEMS: 'manage_items',
  MANAGE_REGISTRATIONS: 'manage_registrations',
  CONTROL_BIDDING: 'control_bidding',
  MANAGE_USERS: 'manage_users',
  ASSIGN_ROLES: 'assign_roles',
  MANAGE_PERMISSIONS: 'manage_permissions',
  MANAGE_CHAT: 'manage_chat',
  UPLOAD_FILES: 'upload_files',
  MANAGE_DEVICES: 'manage_devices',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ADMIN_ROLES = ['super_admin', 'admin', 'moderator'] as const

export const ASSIGNABLE_ROLES = ['user', 'moderator', 'admin'] as const

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  user: 'User',
}
