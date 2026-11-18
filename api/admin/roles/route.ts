import type { Request, Response } from 'express'
import prisma from '../../../lib/prisma'
import { PERMISSIONS } from '../../../lib/permissions'
import { authorizeAdmin } from '../_auth'
import { broadcastEvent } from '../../../lib/events'

interface PermissionMeta {
  name: string
  description: string
  group: string
}

const PERMISSION_METADATA: Record<string, PermissionMeta> = {
  view_dashboard: {
    name: 'View Dashboard',
    description: 'View the admin dashboard and overview metrics',
    group: 'General',
  },
  create_auctions: {
    name: 'Create Auctions',
    description: 'Create and publish new auctions',
    group: 'Auctions',
  },
  manage_auctions: {
    name: 'Manage Auctions',
    description: 'Edit, update, and manage existing auctions',
    group: 'Auctions',
  },
  create_items: {
    name: 'Create Items',
    description: 'Add new gems and auction items',
    group: 'Items & Gems',
  },
  manage_items: {
    name: 'Manage Items',
    description: 'Edit, update, and manage existing gems and items',
    group: 'Items & Gems',
  },
  control_bidding: {
    name: 'Control Bidding',
    description: 'Control live bidding, price rounds, and winners',
    group: 'Bidding',
  },
  manage_registrations: {
    name: 'Manage Registrations',
    description: 'Review and approve or reject auction registrations',
    group: 'Registrations',
  },
  manage_users: {
    name: 'Manage Users',
    description: 'View and manage user accounts',
    group: 'Users & Roles',
  },
  assign_roles: {
    name: 'Assign Roles',
    description: 'Assign and change user roles',
    group: 'Users & Roles',
  },
  manage_permissions: {
    name: 'Manage Permissions',
    description: 'Configure permissions and access control for roles',
    group: 'Access Control',
  },
  manage_chat: {
    name: 'Manage Chat',
    description: 'View, reply, and moderate support conversations',
    group: 'Communication',
  },
  upload_files: {
    name: 'Upload Files',
    description: 'Upload images, certificates, and media files',
    group: 'Media & Files',
  },
  manage_devices: {
    name: 'Manage Devices',
    description: 'Manage NFC cards, devices, and physical access readers',
    group: 'Devices & NFC',
  },
}

export async function getRoles(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_PERMISSIONS)) return

    const existingCreateAuctions = await prisma.permission.findUnique({ where: { key: PERMISSIONS.CREATE_AUCTIONS } })
    const existingCreateItems = await prisma.permission.findUnique({ where: { key: PERMISSIONS.CREATE_ITEMS } })

    const permissions = await Promise.all(Object.values(PERMISSIONS).map(key => {
      const meta = PERMISSION_METADATA[key]
      const desc = meta?.description || key
      return prisma.permission.upsert({
        where: { key },
        update: { description: desc },
        create: { key, description: desc },
      })
    }))

    const roles = await Promise.all(['admin', 'moderator'].map(name =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } })
    ))

    // First-time initialization: if create_auctions was just created, link it to roles that currently have manage_auctions
    if (!existingCreateAuctions) {
      const manageAuctionsPerm = permissions.find(p => p.key === PERMISSIONS.MANAGE_AUCTIONS)
      const createAuctionsPerm = permissions.find(p => p.key === PERMISSIONS.CREATE_AUCTIONS)
      if (manageAuctionsPerm && createAuctionsPerm) {
        const rolesWithManage = await prisma.rolePermission.findMany({
          where: { permissionId: manageAuctionsPerm.id },
          select: { roleId: true },
        })
        for (const r of rolesWithManage) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: r.roleId, permissionId: createAuctionsPerm.id } },
            update: {},
            create: { roleId: r.roleId, permissionId: createAuctionsPerm.id },
          }).catch(() => {})
        }
      }
    }

    // First-time initialization: if create_items was just created, link it to roles that currently have manage_items
    if (!existingCreateItems) {
      const manageItemsPerm = permissions.find(p => p.key === PERMISSIONS.MANAGE_ITEMS)
      const createItemsPerm = permissions.find(p => p.key === PERMISSIONS.CREATE_ITEMS)
      if (manageItemsPerm && createItemsPerm) {
        const rolesWithManage = await prisma.rolePermission.findMany({
          where: { permissionId: manageItemsPerm.id },
          select: { roleId: true },
        })
        for (const r of rolesWithManage) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: r.roleId, permissionId: createItemsPerm.id } },
            update: {},
            create: { roleId: r.roleId, permissionId: createItemsPerm.id },
          }).catch(() => {})
        }
      }
    }

    let roleLinks = await prisma.rolePermission.findMany({
      where: { roleId: { in: roles.map(role => role.id) } },
      select: { roleId: true, permissionId: true },
    })

    // If a role has no permissions configured yet, seed defaults so the matrix reflects true active permissions
    for (const role of roles) {
      const hasLinks = roleLinks.some(link => link.roleId === role.id)
      if (!hasLinks) {
        let defaultKeys: string[] = []
        if (role.name === 'admin') {
          defaultKeys = Object.values(PERMISSIONS).filter(k => k !== PERMISSIONS.MANAGE_PERMISSIONS)
        } else if (role.name === 'moderator') {
          defaultKeys = [
            PERMISSIONS.VIEW_DASHBOARD,
            PERMISSIONS.CREATE_AUCTIONS,
            PERMISSIONS.MANAGE_AUCTIONS,
            PERMISSIONS.CREATE_ITEMS,
            PERMISSIONS.MANAGE_ITEMS,
            PERMISSIONS.MANAGE_REGISTRATIONS,
            PERMISSIONS.CONTROL_BIDDING,
            PERMISSIONS.MANAGE_CHAT,
            PERMISSIONS.UPLOAD_FILES,
            PERMISSIONS.MANAGE_DEVICES,
          ]
        }
        const targetPerms = permissions.filter(p => defaultKeys.includes(p.key))
        if (targetPerms.length > 0) {
          await prisma.rolePermission.createMany({
            data: targetPerms.map(p => ({ roleId: role.id, permissionId: p.id })),
            skipDuplicates: true,
          })
          for (const p of targetPerms) {
            roleLinks.push({ roleId: role.id, permissionId: p.id })
          }
        }
      }
    }

    response.json({
      permissions: permissions.map(permission => {
        const meta = PERMISSION_METADATA[permission.key]
        return {
          ...permission,
          name: meta?.name || permission.key.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' '),
          group_name: meta?.group || permission.key.split('_')[0].replace(/^\w/, letter => letter.toUpperCase()),
        }
      }),
      rolePermissions: Object.fromEntries(roles.map(role => [
        role.name,
        roleLinks.filter(link => link.roleId === role.id).map(link => link.permissionId),
      ])),
    })
  } catch (error) {
    console.error('Failed to load role permissions:', error)
    response.status(500).json({ error: 'Failed to load role permissions.' })
  }
}

export async function updateRolePermissions(request: Request, response: Response) {
  try {
    if (!await authorizeAdmin(request, response, PERMISSIONS.MANAGE_PERMISSIONS)) return
    const { role, permissionIds } = request.body as { role?: unknown; permissionIds?: unknown }
    if (!['admin', 'moderator'].includes(String(role)) || !Array.isArray(permissionIds) ||
      !permissionIds.every(id => typeof id === 'string')) {
      response.status(400).json({ error: 'A valid editable role and permission ID list are required.' })
      return
    }

    const permissions = await prisma.permission.findMany({
      where: { id: { in: permissionIds as string[] } },
      select: { id: true },
    })
    if (permissions.length !== new Set(permissionIds as string[]).size) {
      response.status(400).json({ error: 'One or more permissions are invalid.' })
      return
    }

    const roleRecord = await prisma.role.upsert({
      where: { name: role as string },
      update: {},
      create: { name: role as string },
    })
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: roleRecord.id } }),
      ...(permissions.length ? [
        prisma.rolePermission.createMany({
          data: permissions.map(permission => ({
            roleId: roleRecord.id,
            permissionId: permission.id,
          })),
        }),
      ] : []),
    ])

    broadcastEvent({
      channel: 'admin-users',
      table: 'permissions',
      eventType: 'UPDATE',
      new: { role, permissionIds },
    })

    response.json({ success: true })
  } catch (error) {
    console.error('Failed to update role permissions:', error)
    response.status(500).json({ error: 'Failed to update role permissions.' })
  }
}
