import type { UserProfile, UserRole } from '../types';

export type Permission =
  | 'quotation:create'
  | 'quotation:view-own'
  | 'quotation:view-all'
  | 'quotation:review'
  | 'cogs:view'
  | 'cogs:edit'
  | 'catalog:view'
  | 'custom-request:create'
  | 'custom-request:price'
  | 'discount-rules:edit'
  | 'reports:view'
  | 'users:manage';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SALES: ['quotation:create', 'quotation:view-own', 'catalog:view', 'custom-request:create'],
  SALES_SUPPORT: [
    'quotation:view-all',
    'quotation:review',
    'cogs:view',
    'cogs:edit',
    'catalog:view',
    'custom-request:price',
    'discount-rules:edit',
  ],
  MANAGEMENT: [
    'quotation:view-all',
    'quotation:review',
    'cogs:view',
    'cogs:edit',
    'catalog:view',
    'custom-request:price',
    'discount-rules:edit',
    'reports:view',
    'users:manage',
  ],
};

export const ROLE_META: Record<UserRole, { label: string; description: string }> = {
  SALES: {
    label: 'Sales',
    description: 'Menyusun penawaran dan request barang custom. Tidak melihat HPP maupun margin.',
  },
  SALES_SUPPORT: {
    label: 'Sales Support',
    description: 'Mereview penawaran, mengatur HPP dan harga final, menerbitkan PDF.',
  },
  MANAGEMENT: {
    label: 'Management',
    description: 'Seluruh akses Sales Support, laporan margin, dan pengelolaan user.',
  },
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'quotation:create': 'Membuat penawaran',
  'quotation:view-own': 'Melihat penawaran sendiri',
  'quotation:view-all': 'Melihat semua penawaran',
  'quotation:review': 'Menyetujui / menolak penawaran',
  'cogs:view': 'Melihat HPP & margin',
  'cogs:edit': 'Mengubah HPP & harga final',
  'catalog:view': 'Melihat katalog produk',
  'custom-request:create': 'Mengajukan barang custom',
  'custom-request:price': 'Menghitung harga barang custom',
  'discount-rules:edit': 'Mengatur aturan diskon',
  'reports:view': 'Melihat laporan margin',
  'users:manage': 'Mengelola user & hak akses',
};

export function can(user: Pick<UserProfile, 'role'> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}
