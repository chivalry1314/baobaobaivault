"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { ShareSiteBrandingSettings } from "@/lib/shared";
import { shareSiteBrand, updateShareSiteBrandRuntime } from "@/lib/site-config";

type ShareSiteBrandContextValue = {
  brand: ShareSiteBrandingSettings;
  setBrand: (brand: ShareSiteBrandingSettings) => void;
};

const ShareSiteBrandContext = createContext<ShareSiteBrandContextValue>({
  brand: {
    ...shareSiteBrand,
    canUpdate: false,
  },
  setBrand: () => {},
});

export function ShareSiteBrandProvider(props: {
  brand: ShareSiteBrandingSettings;
  children: React.ReactNode;
}) {
  const [brand, setBrandState] = useState(props.brand);

  // Keep the shared fallback singleton in sync with the runtime brand so that
  // helper functions outside React also use the latest saved values.
  useEffect(() => {
    updateShareSiteBrandRuntime(brand);
  }, [brand]);

  const value = useMemo(
    () => ({ brand, setBrand: setBrandState }),
    [brand],
  );

  return (
    <ShareSiteBrandContext.Provider value={value}>
      {props.children}
    </ShareSiteBrandContext.Provider>
  );
}

export function useShareSiteBrand() {
  return useContext(ShareSiteBrandContext).brand;
}

export function useShareSiteBrandControls() {
  return useContext(ShareSiteBrandContext).setBrand;
}
