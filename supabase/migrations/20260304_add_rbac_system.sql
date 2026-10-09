-- ============================================
-- RBAC: Role-Based Access Control System
-- ============================================

-- Add new role enum values (separate transaction required for enum)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- Seed permissions
INSERT INTO public.permissions (key, name, description, group_name) VALUES
  ('view_dashboard', 'View Dashboard', 'Access admin dashboard and view statistics', 'Dashboard'),
  ('manage_auctions', 'Manage Auctions', 'Create, edit, and control auction status', 'Auctions'),
  ('manage_items', 'Manage Items', 'Create, edit, and publish items/gems', 'Items'),
  ('manage_registrations', 'Manage Registrations', 'View and approve/reject auction registrations', 'Registrations'),
  ('control_bidding', 'Control Bidding', 'Start/end bidding rounds, select winners, hold bidders', 'Bidding'),
  ('manage_users', 'Manage Users', 'View user list and profiles', 'Users'),
  ('assign_roles', 'Assign Roles', 'Assign roles (Moderator, Admin) to users', 'Users'),
  ('manage_permissions', 'Manage Permissions', 'Edit role permissions for any role', 'Access Control'),
  ('manage_chat', 'Manage Chat', 'View and respond to all chat conversations', 'Chat'),
  ('upload_files', 'Upload Files', 'Upload images and files', 'Files')
ON CONFLICT (key) DO NOTHING;

-- Seed default role-permission assignments
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::user_role, p.id FROM public.permissions p
WHERE p.key IN ('view_dashboard', 'manage_auctions', 'manage_items', 'manage_registrations', 'control_bidding', 'manage_users', 'manage_chat', 'upload_files')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'moderator'::user_role, p.id FROM public.permissions p
WHERE p.key IN ('view_dashboard', 'manage_registrations', 'manage_chat')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Update is_admin() to include all admin-level roles
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id AND role IN ('super_admin', 'admin', 'moderator')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create has_permission() function
CREATE OR REPLACE FUNCTION public.has_permission(check_user_id UUID, permission_key TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = check_user_id AND u.role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.role_permissions rp ON rp.role = u.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE u.id = check_user_id AND p.key = permission_key
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin roles can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Super admin can insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admin can delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'));

-- Update all existing RLS policies to use is_admin() instead of inline checks
-- (See full policy updates in the applied migration)
