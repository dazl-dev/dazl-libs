import type {
  ColorSchemeSetup,
  ColorSchemeApi,
  ColorSchemeSubscriber,
  ColorSchemeConfig,
  ColorSchemeResolve,
} from "./types";

function initiateColorScheme({
  saveConfig,
  loadConfig,
  cssClass,
}: ColorSchemeSetup): ColorSchemeApi {
  const state: {
    listeners: Set<ColorSchemeSubscriber>;
    config: ColorSchemeConfig;
  } = {
    listeners: new Set<ColorSchemeSubscriber>(),
    config: loadConfig(),
  };

  const isDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const resolve = (): ColorSchemeResolve => {
    if (state.config !== "system") return state.config;
    return isDarkQuery.matches ? "dark" : "light";
  };
  const onSystemChange = (): void => {
    if (state.config !== "system") return;
    updateDocument();
  };
  const updateDocument = (): void => {
    const resolved = resolve();
    const root = document.documentElement;
    root.classList.remove(cssClass.light, cssClass.dark);
    root.classList.add(cssClass[resolved]);
    root.style.colorScheme = resolved === "dark" ? "dark" : "light";
    state.listeners.forEach((listener) => listener(state.config, resolved));
  };

  // set initial color scheme and listen for system changes
  updateDocument();
  isDarkQuery.addEventListener("change", onSystemChange);

  return {
    get config() {
      return state.config;
    },
    set config(config) {
      if (config === state.config) return;
      state.config = config;
      updateDocument();
      saveConfig(config);
    },
    get current() {
      return { config: state.config, resolved: resolve() };
    },
    subscribe: (sub: ColorSchemeSubscriber): (() => void) => {
      state.listeners.add(sub);
      return (): void => {
        state.listeners.delete(sub);
      };
    },
  };
}

const storageKey: string = "color-scheme";

window.colorSchemeApi ??= initiateColorScheme({
  loadConfig(): ColorSchemeConfig {
    try {
      const config: string | null = localStorage.getItem(storageKey);
      return config === "light" || config === "dark" ? config : "system";
    } catch {
      return "system";
    }
  },
  saveConfig(config: ColorSchemeConfig): void {
    try {
      if (config === "system") {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, config);
      }
    } catch {}
  },
  cssClass: { light: "light-theme", dark: "dark-theme" },
});
