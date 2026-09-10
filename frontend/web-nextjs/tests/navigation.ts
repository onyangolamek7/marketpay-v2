import { vi } from 'vitest';

/** Router double shared by every test; assertions read these spies. */
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let searchParams = new URLSearchParams();
let pathname = '/';

export const getSearchParams = () => searchParams;
export const getPathname = () => pathname;

export function setSearchParams(query: string) {
  searchParams = new URLSearchParams(query);
}

export function setPathname(value: string) {
  pathname = value;
}

export function resetNavigation() {
  searchParams = new URLSearchParams();
  pathname = '/';
  for (const spy of Object.values(router)) spy.mockClear();
}
