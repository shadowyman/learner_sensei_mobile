import { NativeModules, Platform } from 'react-native';

const BFF_PORT = 8787;
const ANDROID_EMULATOR_BFF_BASE_URL = `http://10.0.2.2:${BFF_PORT}`;
const IOS_LOCAL_BFF_BASE_URL = `http://127.0.0.1:${BFF_PORT}`;

type GlobalBffOverride = typeof globalThis & {
  __SENSEI_BFF_BASE_URL?: string;
  __DEV__?: boolean;
};

export type ResolveBffBaseUrlOptions = {
  explicitBaseUrl?: string | null;
  platformOS?: string;
  scriptURL?: string | null;
};

export function deriveBffBaseUrlFromScriptURL(scriptURL?: string | null): string | null {
  if (!scriptURL) {
    return null;
  }
  try {
    const url = new URL(scriptURL);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) {
      return null;
    }
    return `${url.protocol}//${url.hostname}:${BFF_PORT}`;
  } catch (_) {
    return null;
  }
}

export function resolveBffBaseUrl(options: ResolveBffBaseUrlOptions = {}): string {
  const explicitBaseUrl = options.explicitBaseUrl ?? (globalThis as GlobalBffOverride).__SENSEI_BFF_BASE_URL;
  if (typeof explicitBaseUrl === 'string' && explicitBaseUrl.trim().length > 0) {
    return explicitBaseUrl.trim().replace(/\/+$/, '');
  }
  const scriptURL = options.scriptURL ?? NativeModules?.SourceCode?.scriptURL;
  const metroHostBaseUrl = deriveBffBaseUrlFromScriptURL(scriptURL);
  const devMode = (globalThis as GlobalBffOverride).__DEV__ ?? true;
  if (devMode && metroHostBaseUrl) {
    return metroHostBaseUrl;
  }
  const platformOS = options.platformOS ?? Platform.OS;
  if (platformOS === 'android') {
    return ANDROID_EMULATOR_BFF_BASE_URL;
  }
  return IOS_LOCAL_BFF_BASE_URL;
}
