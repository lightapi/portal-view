import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionDisplayProvider } from '../../../contexts/ActionDisplayContext';
import { PortalActionScope } from '../../../components/PortalActions/PortalActions';
import SchemaCatalogCard from './SchemaCatalogCard';
import type { SchemaCatalogItem } from '../hooks/useSchemaCatalog';

const handlers = { onDetails: vi.fn(), onCopyUrl: vi.fn(), onOpenUrl: vi.fn(), onUpdate: vi.fn() };
beforeEach(() => { localStorage.clear(); Object.values(handlers).forEach(handler => handler.mockClear()); });

function show(schemaAlias: string) {
  const schema = { schemaId: 's1', schemaAlias, schemaName: 'Pet', externalVisible: true, schemaStatus: 'P' } as SchemaCatalogItem;
  render(<ActionDisplayProvider><PortalActionScope>
    <SchemaCatalogCard schema={schema} viewMode="grid" isUpdating={false} {...handlers} />
  </PortalActionScope></ActionDisplayProvider>);
}

describe('schema catalog card external URL actions', () => {
  it('disables Copy URL and Open with an explanation for a non-URL-friendly alias', async () => {
    show('Pet Store');
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    for (const name of ['Copy URL', 'Open']) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    expect(screen.getAllByText(/Schema alias 'Pet Store' is not URL-friendly/).length).toBeGreaterThan(0);
  });

  it('keeps both actions enabled for a compliant published external alias', async () => {
    show('pet-store_v1');
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    for (const name of ['Copy URL', 'Open']) {
      expect(screen.getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled', 'true');
    }
  });
});
