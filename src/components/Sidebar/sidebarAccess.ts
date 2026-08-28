export const ORG_ADMIN_ACCESS = {
  role: 'org-admin org-viewer',
  requireExplicitRole: true,
} as const;

export function filterSidebarItems(items: any[], userRoles: string | null, insideAdminSection = false): any[] {
  const isAdmin = hasSidebarRole(userRoles, 'admin host-admin');

  return items.reduce<any[]>((visibleItems, item) => {
    const inAdminSection = insideAdminSection || item.id === 9000;
    const children = item.children ? filterSidebarItems(item.children, userRoles, inAdminSection) : undefined;
    const visibleChildren = children?.length ? children : undefined;

    if (item.type === 'group') {
      if (visibleChildren) {
        visibleItems.push({ ...item, children: visibleChildren });
      }
      return visibleItems;
    }

    if (canShowSidebarItem(item, userRoles, inAdminSection, isAdmin)) {
      visibleItems.push(visibleChildren ? { ...item, children: visibleChildren } : { ...item, children: undefined });
    }

    return visibleItems;
  }, []);
}

function canShowSidebarItem(item: any, userRoles: string | null, insideAdminSection: boolean, isAdmin: boolean) {
  if (item.requireExplicitRole === true) {
    return hasSidebarRole(userRoles, item.role ?? '');
  }
  if (item.role != null && hasSidebarRole(item.role, 'access-admin')) {
    return hasSidebarRole(userRoles, 'admin access-admin');
  }
  if (isAdmin) return true;
  if (insideAdminSection && item.role == null) return false;
  if (item.role == null) return true;
  return hasSidebarRole(userRoles, item.role);
}

function hasSidebarRole(userRoles: string | null, requiredRoles: string) {
  if (!userRoles) return false;

  const userRoleSet = new Set(userRoles.split(/[\s,]+/).filter(Boolean));
  return requiredRoles
    .split(/[\s,]+/)
    .filter(Boolean)
    .some((role) => userRoleSet.has(role));
}
