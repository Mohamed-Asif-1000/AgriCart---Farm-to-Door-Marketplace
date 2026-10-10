"use client";

import { createContext, useContext, useState } from "react";

type DashboardUIContextType = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const DashboardUIContext = createContext<DashboardUIContextType | undefined>(
  undefined
);

export function DashboardUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <DashboardUIContext.Provider
      value={{
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
      }}
    >
      {children}
    </DashboardUIContext.Provider>
  );
}

export function useDashboardUI() {
  const context = useContext(DashboardUIContext);
  if (!context) {
    throw new Error(
      "useDashboardUI must be used within DashboardUIProvider"
    );
  }
  return context;
}
