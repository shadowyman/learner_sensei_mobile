declare module 'react-native-webview' {
    import * as React from 'react';

    export interface WebViewMessageEvent {
        nativeEvent: {
            data: string;
        };
    }

    export interface WebViewSource {
        uri?: string;
        html?: string;
    }

    export interface WebViewProps {
        source: WebViewSource;
        originWhitelist?: string[];
        onMessage?: (event: WebViewMessageEvent) => void;
        injectedJavaScript?: string;
        injectedJavaScriptBeforeContentLoaded?: string;
        style?: any;
        webviewDebuggingEnabled?: boolean;
        allowingReadAccessToURL?: string;
        allowFileAccessFromFileURLs?: boolean;
        allowUniversalAccessFromFileURLs?: boolean;
    }

    export class WebView extends React.Component<WebViewProps> {}

    export default WebView;
}
