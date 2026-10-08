import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetPortalConfigForTests } from '../runtimeConfig/store';

afterEach(() => {
  cleanup();
  resetPortalConfigForTests();
});

