import { describe, expect, it } from 'vitest';
import { filterSidebarItems, ORG_ADMIN_ACCESS } from './sidebarAccess';

const structure = [{
  id: 9000,
  type: 'group',
  label: 'Administration',
  children: [
    { id: 90, label: 'Org Admin', ...ORG_ADMIN_ACCESS },
    { id: 91, label: 'Host Admin' },
  ],
}];

function containsLabel(items: any[], label: string): boolean {
  return items.some((item) => item.label === label || containsLabel(item.children ?? [], label));
}

describe('Org Admin sidebar access', () => {
  it.each([
    ['org-admin', true],
    ['org-viewer', true],
    ['user org-admin', true],
    ['user,org-viewer', true],
    ['admin', false],
    ['host-admin', false],
    ['user', false],
    [null, false],
  ])('shows Org Admin for roles %s: %s', (roles, expected) => {
    expect(containsLabel(filterSidebarItems(structure, roles), 'Org Admin')).toBe(expected);
  });
});
