"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { ShareSiteBrandingSettings } from "@/lib/shared";
import { applyShareSiteBrand, shareSiteBrand } from "@/lib/site-config";

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
  const [brand, setBrandState] = useState(() => {
    applyShareSiteBrand(props.brand);
    return props.brand;
  });

  useEffect(() => {
    applyShareSiteBrand(props.brand);
    setBrandState(props.brand);
  }, [props.brand]);

  function setBrand(nextBrand: ShareSiteBrandingSettings) {
    applyShareSiteBrand(nextBrand);
    setBrandState(nextBrand);
  }

  return (
    <ShareSiteBrandContext.Provider value={{ brand, setBrand }}>
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
