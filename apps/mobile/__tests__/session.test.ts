/**
 * #550 — SecureStore session layer + access-mode guards.
 */
const store = new Map<string, string>();

jest.mock('../utils/secureStore', () => ({
  saveSecureItem: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  getSecureItem: jest.fn(async (key: string) => store.get(key) ?? null),
  deleteSecureItem: jest.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import {
  __resetSessionForTests,
  clearSession,
  getAccessToken,
  getSession,
  hydrateSession,
  isSessionHydrated,
  saveSession,
  subscribeToSession,
} from '../services/session';
import {
  __resetAuthForTests,
  enterGuestMode,
  getAccessMode,
  isAuthenticated,
  isGuest,
  requireAuth,
  requireWallet,
  signOut,
  consumePendingRedirect,
} from '../services/auth';

const SESSION = {
  accessToken: 'jwt.access.token',
  refreshToken: 'jwt.refresh.token',
  walletAddress: 'GCEXAMPLEADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

beforeEach(() => {
  store.clear();
  __resetSessionForTests();
  __resetAuthForTests();
});

describe('session store', () => {
  it('starts empty and unhydrated', () => {
    expect(getSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(isSessionHydrated()).toBe(false);
  });

  it('persists a session to SecureStore and exposes it synchronously', async () => {
    await saveSession(SESSION);

    expect(getAccessToken()).toBe(SESSION.accessToken);
    expect(store.get('vaultix-access-token')).toBe(SESSION.accessToken);
    expect(store.get('vaultix-refresh-token')).toBe(SESSION.refreshToken);
    expect(store.get('vaultix-session-address')).toBe(SESSION.walletAddress);
  });

  it('hydrates a previously persisted session', async () => {
    await saveSession(SESSION);
    __resetSessionForTests();

    expect(getSession()).toBeNull();
    const hydrated = await hydrateSession();

    expect(hydrated).toEqual(SESSION);
    expect(isSessionHydrated()).toBe(true);
  });

  it('hydrates to null when only part of the session survived', async () => {
    store.set('vaultix-access-token', 'orphan');
    expect(await hydrateSession()).toBeNull();
  });

  it('shares one read across concurrent hydrations', async () => {
    await saveSession(SESSION);
    __resetSessionForTests();

    const [a, b] = await Promise.all([hydrateSession(), hydrateSession()]);
    expect(a).toEqual(SESSION);
    expect(b).toEqual(SESSION);
  });

  it('clears memory and SecureStore on sign out', async () => {
    await saveSession(SESSION);
    await clearSession();

    expect(getSession()).toBeNull();
    expect(store.size).toBe(0);
  });

  it('notifies subscribers on change', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToSession(listener);

    await saveSession(SESSION);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    await clearSession();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('access modes', () => {
  it('reports authenticated once a session exists', async () => {
    expect(isAuthenticated()).toBe(false);
    await saveSession(SESSION);
    expect(isAuthenticated()).toBe(true);
    expect(getAccessMode()).toBe('authenticated');
  });

  it('treats guest mode as read-only, not authenticated', () => {
    enterGuestMode();
    expect(isGuest()).toBe(true);
    expect(isAuthenticated()).toBe(false);
    expect(getAccessMode()).toBe('guest');
  });

  it('signs out of both a session and guest mode', async () => {
    await saveSession(SESSION);
    enterGuestMode();
    await signOut();

    expect(getAccessMode()).toBe('anonymous');
    expect(store.size).toBe(0);
  });
});

describe('route guards', () => {
  const router = { replace: jest.fn() };

  beforeEach(() => router.replace.mockClear());

  it('defers instead of redirecting while the session is still hydrating', () => {
    expect(requireAuth(router, { pathname: '/(tabs)/dashboard' })).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('bounces anonymous users to the welcome screen and remembers the target', async () => {
    await hydrateSession();

    expect(requireAuth(router, { pathname: '/(tabs)/settings' })).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(consumePendingRedirect()).toEqual({ pathname: '/(tabs)/settings' });
  });

  it('lets guests browse', async () => {
    await hydrateSession();
    enterGuestMode();

    expect(requireAuth(router, { pathname: '/(tabs)/dashboard' })).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('still blocks guests from wallet-backed actions', async () => {
    await hydrateSession();
    enterGuestMode();

    expect(requireWallet(router, { pathname: '/escrow/create' })).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('lets an authenticated user through both guards', async () => {
    await saveSession(SESSION);

    expect(requireAuth(router, { pathname: '/(tabs)/dashboard' })).toBe(true);
    expect(requireWallet(router, { pathname: '/escrow/create' })).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
