import { afterEach, vi } from 'vitest';

// Declared here so the mock applies to every test module, not just this file.
vi.mock('next/navigation', async () => {
  const state = await import('./navigation');
  return {
    useRouter: () => state.router,
    useSearchParams: () => state.getSearchParams(),
    usePathname: () => state.getPathname(),
  };
});

/** Route-handler tests run in the node environment and have no DOM to set up. */
const hasDom = typeof window !== 'undefined';

if (hasDom) {
  await import('@testing-library/jest-dom/vitest');

  // jsdom implements neither, and the upload preview uses both.
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => `blob:test/${Math.random().toString(36).slice(2)}`;
    URL.revokeObjectURL = () => {};
  }
}

afterEach(async () => {
  if (hasDom) {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
    window.sessionStorage.clear();
  }
  vi.unstubAllGlobals();
  const { resetNavigation } = await import('./navigation');
  resetNavigation();
});
