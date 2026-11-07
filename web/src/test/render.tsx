import { render as renderComponent } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ApiProvider } from '../shared/api/ApiProvider';

export * from '@testing-library/react';

export function render(
  ui: ReactElement,
  {
    initialEntries = ['/reservations'],
    ...options
  }: RenderOptions & { initialEntries?: string[] } = {},
) {
  return renderComponent(
    <ApiProvider>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </ApiProvider>,
    options,
  );
}
