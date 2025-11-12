import React, { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import type WebView from 'react-native-webview';

import { BridgeManager } from './src/mobile/bridge/BridgeManager';
import { MainScreen } from './src/mobile/MainScreen';
import { BffClient } from './src/mobile/network/BffClient';
import { SaveLoadService } from './src/mobile/saveLoad/SaveLoadService';
import { IOSFileAdapter } from './src/mobile/saveLoad/nativeFileAdapter';
import { TelemetryManager } from './src/mobile/telemetry/TelemetryManager';

const BFF_BASE_URL = 'https://your-bff.example.com';

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
  const bffClient = useMemo(() => new BffClient({ baseUrl: BFF_BASE_URL, bridge }), [bridge]);

  const webContentUri = useMemo(() => {
    const basePath = RNFS.MainBundlePath ?? '';
    return `file://${basePath}/app_web/webview_dist/index.html`;
  }, []);

  return (
    <MainScreen
      bridge={bridge}
      bffClient={bffClient}
      saveLoadService={saveLoadService}
      telemetryManager={telemetryManager}
      webContentUri={webContentUri}
      webViewRefOverride={webViewRef}
    />
  );
}

export default App;
