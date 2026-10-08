import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishTestConfig } from '../../test/runtimeConfigFixture';
import { resetPortalConfigForTests } from '../../runtimeConfig/store';
import { ActionDisplayProvider } from '../../contexts/ActionDisplayContext';

vi.mock('../../contexts/UserContext', () => ({ useUserState: () => ({ host: 'host-a', userId: 'user-a' }) }));
vi.mock('../../utils/fetchClient', () => ({ default: vi.fn() }));
vi.mock('./components/SchemaCatalogFilters', () => ({ default: () => null }));
vi.mock('./components/SchemaCatalogCard', () => ({
  default: ({ schema, onCopyUrl, onOpenUrl }: { schema: unknown; onCopyUrl: (s: unknown) => void; onOpenUrl: (s: unknown) => void }) => <>
    <button onClick={() => onCopyUrl(schema)}>Copy schema URL</button>
    <button onClick={() => onOpenUrl(schema)}>Open schema URL</button>
  </>,
}));
const catalog = vi.hoisted(() => ({ alias: 'petstore-v1' as string }));
vi.mock('./hooks/useSchemaCatalog', async (original) => ({
  ...(await original<typeof import('./hooks/useSchemaCatalog')>()),
  useSchemaCatalog: () => ({
    categories: [], tagGroups: [], total: 1, isLoadingOptions: false, isLoadingSchemas: false, error: null,
    taxonomyFiltersActive: false, schemas: [{ schemaId: 's1', schemaAlias: catalog.alias }],
  }),
}));
import SchemaCatalog from './SchemaCatalog';

describe('schema catalog external URLs', () => {
  beforeEach(() => {
    catalog.alias = 'petstore-v1';
    vi.restoreAllMocks();
    resetPortalConfigForTests();
    publishTestConfig({ routing: { apiBasePath: '/namespace-dev/service' } });
  });

  it('copies and opens schema URLs below the configured API base', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<ActionDisplayProvider><MemoryRouter initialEntries={['/app/schema/catalog']}><SchemaCatalog /></MemoryRouter></ActionDisplayProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Copy schema URL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open schema URL' }));
    const expected = `${window.location.origin}/namespace-dev/service/r/schema/petstore-v1`;
    expect(writeText).toHaveBeenCalledWith(expected);
    expect(open).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  });

  function show() {
    render(<ActionDisplayProvider><MemoryRouter initialEntries={['/app/schema/catalog']}><SchemaCatalog /></MemoryRouter></ActionDisplayProvider>);
  }

  it.each(['Pet Store', 'a/b', '..', 'UPPER', 'a#b'])('refuses non-URL-friendly alias %j with a visible error and no navigation', async (alias) => {
    catalog.alias = alias;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Open schema URL' }));
    expect((await screen.findByRole('alert')).textContent).toContain(`Schema alias '${alias}' is not URL-friendly`);
    fireEvent.click(screen.getByRole('button', { name: 'Copy schema URL' }));
    expect(open).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('reports clipboard rejection with the URL to copy manually', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Copy schema URL' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not copy the URL (denied)');
    expect(alert.textContent).toContain(`${window.location.origin}/namespace-dev/service/r/schema/petstore-v1`);
  });

  it('reports an unavailable clipboard instead of failing silently', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Copy schema URL' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Clipboard is unavailable');
  });

  it('shows apiUrl construction failures instead of throwing from the click handler', async () => {
    resetPortalConfigForTests();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    show();
    // Configuration missing at click time makes apiUrl throw; the handler must surface it.
    fireEvent.click(screen.getByRole('button', { name: 'Open schema URL' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain("Cannot build the external URL for schema alias 'petstore-v1'"));
    expect(open).not.toHaveBeenCalled();
  });
});
