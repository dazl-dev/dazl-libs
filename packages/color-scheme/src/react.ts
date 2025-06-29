import { useState, useEffect } from "react";
import type { ColorSchemeConfig, ColorSchemeResolve } from "./types";

const api = typeof window !== "undefined" ? window.colorSchemeApi : null;

// react hook for color scheme management
export function useColorScheme() {
  const [{ config, resolved }, setScheme] = useState<{
    config: ColorSchemeConfig;
    resolved: ColorSchemeResolve;
  }>({ config: "system", resolved: "light" });

  useEffect(() => {
    setScheme(api!.current);
    return api!.subscribe((config, resolved) =>
      setScheme({ config, resolved })
    );
  }, []);

  return {
    configScheme: config,
    resolvedScheme: resolved,
    setColorScheme: (config: ColorSchemeConfig) => {
      if (!api) return;
      api.config = config;
    },
    isLight: resolved === "light",
    isDark: resolved === "dark",
  };
}
