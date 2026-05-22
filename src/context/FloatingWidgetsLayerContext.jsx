import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export const FLOATING_WIDGET_BASE_Z = 90;
const FLOATING_WIDGET_ACTIVE_Z_START = 95;

const FloatingWidgetsLayerContext = createContext(null);

export function FloatingWidgetsLayerProvider({ children }) {
  const [layers, setLayers] = useState({
    chat: FLOATING_WIDGET_BASE_Z,
    phone: FLOATING_WIDGET_BASE_Z,
    next: FLOATING_WIDGET_ACTIVE_Z_START,
  });

  const bringToFront = useCallback((id) => {
    if (id !== "chat" && id !== "phone") return;
    setLayers((prev) => {
      const z = prev.next;
      return { ...prev, [id]: z, next: z + 1 };
    });
  }, []);

  const getZIndex = useCallback(
    (id) => layers[id] ?? FLOATING_WIDGET_BASE_Z,
    [layers]
  );

  const value = useMemo(
    () => ({ bringToFront, getZIndex }),
    [bringToFront, getZIndex]
  );

  return (
    <FloatingWidgetsLayerContext.Provider value={value}>
      {children}
    </FloatingWidgetsLayerContext.Provider>
  );
}

export function useFloatingWidgetsLayer() {
  const ctx = useContext(FloatingWidgetsLayerContext);
  if (!ctx) {
    throw new Error(
      "useFloatingWidgetsLayer must be used within FloatingWidgetsLayerProvider"
    );
  }
  return ctx;
}
