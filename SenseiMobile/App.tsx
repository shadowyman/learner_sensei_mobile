import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type WebView from 'react-native-webview';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';

import { BridgeManager } from './src/mobile/bridge/BridgeManager';
import { MainScreen } from './src/mobile/MainScreen';
import { BffClient } from './src/mobile/network/BffClient';
import { SaveLoadService } from './src/mobile/saveLoad/SaveLoadService';
import { IOSFileAdapter } from './src/mobile/saveLoad/nativeFileAdapter';
import { TelemetryManager } from './src/mobile/telemetry/TelemetryManager';

const BFF_BASE_URL = 'http://localhost:8787';

const createMemoryStore = () => {
  const store = new Map<string, string>();
  return {
    async getItem(key: string) {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
};

function App(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);

  const bridge = useMemo(
    () =>
      new BridgeManager({
        sender: message => {
          if (!webViewRef.current) {
            return;
          }
          webViewRef.current.postMessage(JSON.stringify(message));
        }
      }),
    []
  );

  const fileAdapter = useMemo(() => new IOSFileAdapter(), []);
  const saveLoadService = useMemo(() => new SaveLoadService(bridge, fileAdapter), [bridge, fileAdapter]);
  const telemetryManager = useMemo(
    () =>
      new TelemetryManager({
        endpoint: `${BFF_BASE_URL}/telemetry`,
        deviceMetadata: () => ({ platform: Platform.OS }),
        storage: createMemoryStore()
      }),
    []
  );
  const bffClient = useMemo(
    () =>
      new BffClient({
        baseUrl: BFF_BASE_URL,
        bridge,
        clientMetadata: { appVersion: '1.0.0-mobile', source: 'mobile', topicId: 'c++_recursive_mastery' }
      }),
    [bridge]
  );

  const webContentUri = useMemo(() => {
    const basePath = RNFS.MainBundlePath ?? '';
    return `file://${basePath}/app_web/webview_dist/index.html`;
  }, []);

  // Fallback resolver for common bundle layouts
  const [uriIndex, setUriIndex] = useState(0);
  const candidates = useMemo(() => {
    const basePath = RNFS.MainBundlePath ?? '';
    return [
      `file://${basePath}/app_web/webview_dist/index.html`,
      `file://${basePath}/webview_dist/index.html`,
      `file://${basePath}/index.html`
    ];
  }, []);
  const activeUri = candidates[Math.min(uriIndex, candidates.length - 1)];
  const readAccessBase = useMemo(() => {
    const basePath = RNFS.MainBundlePath ?? '';
    return `file://${basePath}`;
  }, []);

  // Development preflight: log existence of common bundle paths
  useEffect(() => {
    const basePath = RNFS.MainBundlePath ?? '';
    const paths = [
      `${basePath}/app_web/webview_dist/index.html`,
      `${basePath}/app_web/webview_dist/index.js`,
      `${basePath}/app_web/webview_dist/index.css`,
      `${basePath}/webview_dist/index.html`,
      `${basePath}/webview_dist/index.js`,
      `${basePath}/webview_dist/index.css`,
      `${basePath}/index.html`,
      `${basePath}/index.js`,
      `${basePath}/index.css`
    ];
    (async () => {
      for (const p of paths) {
        try {
          // @ts-ignore RNFS.exists is available at runtime
          const exists = await RNFS.exists(p);
          if (exists && p.includes('app_web/webview_dist')) {
            // eslint-disable-next-line no-console
            console.info('Sensei(info) [MOBILE_PORT] webview preflight', { path: p, exists: true });
            break;
          }
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  const handleWebViewError = useCallback(() => {
    setUriIndex((i) => Math.min(i + 1, candidates.length));
  }, [candidates.length]);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <MainScreen
        bridge={bridge}
        bffClient={bffClient}
        saveLoadService={saveLoadService}
        telemetryManager={telemetryManager}
        webContentUri={uriIndex < candidates.length ? activeUri : undefined}
        webContentHtml={uriIndex >= candidates.length ? '<!doctype html><html><body style="font-family:-apple-system;color:#e2e8f0;background:#0b0b0b;padding:16px"><h3>Web bundle not found</h3><p>Looked for:<br/>app_web/webview_dist/index.html<br/>webview_dist/index.html<br/>index.html</p><p>Confirm Xcode has a blue folder reference for <code>app_web</code> or adjust the path in App.tsx.</p></body></html>' : undefined}
        onWebViewError={handleWebViewError}
        allowingReadAccessToURL={readAccessBase}
        webViewRefOverride={webViewRef}
      />
    </SafeAreaProvider>
  );
}

export default App;
