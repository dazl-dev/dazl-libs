import { useState, useEffect } from 'react';
import type { ColorSchemeConfig, CurrentState } from './types';

const api = typeof window !== "undefined" ? window.colorSchemeApi : null;

// react hook for color scheme management
export function useColorScheme() {
  const [{ config, resolved }, setScheme] = useState<CurrentState>({
    config: 'system',
    resolved: 'light',
    resolvedSystem: 'light',
  });

  useEffect(() => {
    setScheme(api!.currentState);
    return api!.subscribe((currentState) => setScheme(currentState));
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
