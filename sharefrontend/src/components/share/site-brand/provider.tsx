"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { ShareSiteBrandingSettings } from "@/lib/shared";
import { shareSiteBrand } from "@/lib/site-config";

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
