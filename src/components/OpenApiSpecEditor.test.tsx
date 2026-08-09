import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OpenApiSpecEditor from './OpenApiSpecEditor';

describe('OpenApiSpecEditor', () => {
  it('previews a different format without changing the controlled source', async () => {
    const onChange = vi.fn();
    render(
      <OpenApiSpecEditor
        value={'openapi: 3.1.0\ninfo:\n  title: Petstore\npaths: {}\n'}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'JSON' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'OpenAPI specification source' }))
      .toHaveTextContent('"openapi": "3.1.0"');

    await userEvent.click(screen.getByRole('button', { name: 'Use JSON format' }));

    const converted = onChange.mock.calls.at(-1)?.[0];
    expect(JSON.parse(converted)).toMatchObject({ openapi: '3.1.0', paths: {} });
  });

  it('keeps the current format selected when conversion encounters invalid syntax', async () => {
    render(<OpenApiSpecEditor value="openapi: [" onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'JSON' }));

    expect(screen.getByRole('alert')).toHaveTextContent('not valid YAML');
    expect(screen.getByRole('tab', { name: 'YAML' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lets read-only previews dismiss circular-alias conversion failures', async () => {
    render(
      <OpenApiSpecEditor
        value={'info: &info { title: API, self: *info }\n'}
        readOnly
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'JSON' }));

    expect(screen.getByRole('alert')).toHaveTextContent('circular reference');
    expect(screen.getByRole('tab', { name: 'YAML' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'YAML' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('restores the exact source when leaving a converted preview', async () => {
    const source = '# keep this comment\nopenapi: 3.1.0\npaths: {}\n';
    const onChange = vi.fn();
    render(<OpenApiSpecEditor value={source} onChange={onChange} />);

    await userEvent.click(screen.getByRole('tab', { name: 'JSON' }));
    await userEvent.click(screen.getByRole('tab', { name: 'YAML' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'OpenAPI specification source' }))
      .toHaveTextContent('# keep this comment');
  });

  it('gives the real CodeMirror textbox an accessible name and makes previews read only', () => {
    render(<OpenApiSpecEditor value={'{"openapi":"3.1.0"}'} readOnly />);
    expect(screen.getByRole('textbox', { name: 'OpenAPI specification source' }))
      .toHaveAttribute('contenteditable', 'false');
  });
});
