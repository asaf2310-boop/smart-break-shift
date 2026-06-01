import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const TelephonyContext = createContext(null);

export function TelephonyProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);
  const [pendingDial, setPendingDial] = useState(null);

  const openSoftphone = useCallback(() => setSidebarOpen(true), []);
  const closeSoftphone = useCallback(() => {
    setSidebarOpen(false);
    setDialOpen(false);
  }, []);
  const toggleSoftphone = useCallback(() => setSidebarOpen((v) => !v), []);

  const openDialPad = useCallback(() => {
    setSidebarOpen(true);
    setDialOpen(true);
  }, []);
  const closeDialPad = useCallback(() => setDialOpen(false), []);
  const toggleDialPad = useCallback(() => setDialOpen((v) => !v), []);

  /** @param {string} phone @param {{ customerId?: string, customerName?: string }} [meta] */
  const dialNumber = useCallback((phone, meta = {}) => {
    setPendingDial({
      phone: String(phone || "").trim(),
      customerId: meta.customerId ?? meta.customer_id ?? null,
      customerName: meta.customerName ?? meta.customer_name ?? null,
    });
    setSidebarOpen(true);
    setDialOpen(true);
  }, []);

  const clearPendingDial = useCallback(() => setPendingDial(null), []);

  const value = useMemo(
    () => ({
      open: sidebarOpen,
      sidebarOpen,
      dialOpen,
      setSidebarOpen,
      setDialOpen,
      openSoftphone,
      closeSoftphone,
      toggleSoftphone,
      openDialPad,
      closeDialPad,
      toggleDialPad,
      pendingDial,
      dialNumber,
      clearPendingDial,
    }),
    [
      sidebarOpen,
      dialOpen,
      openSoftphone,
      closeSoftphone,
      toggleSoftphone,
      openDialPad,
      closeDialPad,
      toggleDialPad,
      pendingDial,
      dialNumber,
      clearPendingDial,
    ]
  );

  return <TelephonyContext.Provider value={value}>{children}</TelephonyContext.Provider>;
}

export function useTelephony() {
  const ctx = useContext(TelephonyContext);
  if (!ctx) {
    throw new Error("useTelephony must be used within TelephonyProvider");
  }
  return ctx;
}
