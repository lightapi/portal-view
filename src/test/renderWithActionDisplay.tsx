import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ActionDisplayProvider } from '../contexts/ActionDisplayContext';

/** Match the application root when testing pages that consume the global preference. */
export function renderWithActionDisplay(ui: ReactElement, options?: RenderOptions) {
  const Wrapper = options?.wrapper;
  return render(ui, {
    ...options,
    wrapper: ({ children }) => <ActionDisplayProvider>
      {Wrapper ? <Wrapper>{children}</Wrapper> : children}
    </ActionDisplayProvider>,
  });
}
