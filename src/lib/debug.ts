export const isDebugEnabled = (scope: string): boolean => {
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`debug:${scope}`) === "true";
};

export const debugLog = (scope: string, ...args: unknown[]): void => {
  if (isDebugEnabled(scope)) {
    console.log(`[${scope}]`, ...args);
  }
};

export const debugWarn = (scope: string, ...args: unknown[]): void => {
  if (isDebugEnabled(scope)) {
    console.warn(`[${scope}]`, ...args);
  }
};

export const debugError = (scope: string, ...args: unknown[]): void => {
  if (isDebugEnabled(scope)) {
    console.error(`[${scope}]`, ...args);
  }
};
