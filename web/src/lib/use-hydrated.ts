"use client";

import { useSyncExternalStore } from "react";

const NOOP_SUBSCRIBE = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => true,
    () => false
  );
}
