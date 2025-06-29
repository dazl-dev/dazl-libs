export type ColorSchemeConfig = "light" | "dark" | "system";
export type ColorSchemeResolve = "light" | "dark";

export interface ColorSchemeSetup {
  saveConfig(config: ColorSchemeConfig): void;
  loadConfig(): ColorSchemeConfig;
  cssClass: { light: string; dark: string };
}

export type ColorSchemeSubscriber = (
  config: ColorSchemeConfig,
  resolved: ColorSchemeResolve
) => void;

export interface ColorSchemeApi {
  get config(): ColorSchemeConfig;
  set config(value: ColorSchemeConfig);
  get current(): { config: ColorSchemeConfig; resolved: ColorSchemeResolve };
  subscribe(sub: ColorSchemeSubscriber): () => void;
}

declare global {
  interface Window {
    colorSchemeApi: ColorSchemeApi;
  }
}
