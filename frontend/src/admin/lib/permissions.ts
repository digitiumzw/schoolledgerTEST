export type PlatformRole = 'Owner' | 'Admin' | 'Finance' | 'Support';

export type PermissionAction =
  | 'tenants.create'
  | 'tenants.suspend'
  | 'tenants.impersonate'
  | 'tenants.delete'
  | 'plans.write'
  | 'subscriptions.write'
  | 'finance.export'
  | 'finance.invoice_actions'
  | 'settings.write'
  | 'team.invite'
  | 'team.deactivate'
  | 'team.remove'
  | 'team.change_role'
  | 'security.platform_toggles'
  | 'apikeys.view'
  | 'apikeys.write';

const MATRIX: Record<PermissionAction, PlatformRole[]> = {
  'tenants.create':            ['Owner', 'Admin'],
  'tenants.suspend':           ['Owner', 'Admin', 'Support'],
  'tenants.impersonate':       ['Owner', 'Admin', 'Support'],
  'tenants.delete':            ['Owner'],
  'plans.write':               ['Owner', 'Admin', 'Finance'],
  'subscriptions.write':       ['Owner', 'Admin', 'Finance'],
  'finance.export':            ['Owner', 'Admin', 'Finance'],
  'finance.invoice_actions':   ['Owner', 'Admin', 'Finance'],
  'settings.write':            ['Owner', 'Admin'],
  'team.invite':               ['Owner', 'Admin'],
  'team.deactivate':           ['Owner', 'Admin'],
  'team.remove':               ['Owner', 'Admin'],
  'team.change_role':          ['Owner'],
  'security.platform_toggles': ['Owner'],
  'apikeys.view':              ['Owner', 'Admin'],
  'apikeys.write':             ['Owner'],
};

export function can(role: PlatformRole | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  return MATRIX[action]?.includes(role) ?? false;
}
