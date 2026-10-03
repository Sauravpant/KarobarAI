import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { useSession } from '@/providers/session-provider';
import type { Shop } from '@/types/api';

function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

/**
 * Selects a shop and lands on home with a clean stack.
 * Navigation waits for the session to commit, since home is behind the shop guard.
 */
export function useEnterShop() {
  const { activeShop, selectShop } = useSession();
  const pendingId = useRef<string | null>(null);
  const activeId = activeShop?.id;

  useEffect(() => {
    if (!pendingId.current || activeId !== pendingId.current) return;
    pendingId.current = null;
    goHome();
  }, [activeId]);

  return useCallback(
    async (shop: Shop) => {
      if (shop.id === activeId) return goHome();
      pendingId.current = shop.id;
      await selectShop(shop);
    },
    [activeId, selectShop],
  );
}
