"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import type { EditorState } from "@/domain/editorState";
import type { RoomStore } from "./store";

const StoreContext = createContext<RoomStore | null>(null);

export function RoomStoreProvider({
  store,
  children,
}: {
  store: RoomStore;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useRoomStore(): RoomStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useRoomStore must be used inside a RoomStoreProvider");
  return store;
}

/** Subscribes to the store; the server snapshot is the same object, so SSR is stable. */
export function useEditorState(): EditorState {
  const store = useRoomStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
