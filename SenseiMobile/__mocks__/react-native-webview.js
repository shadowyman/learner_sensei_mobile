const React = require('react');
const { View } = require('react-native');

const WebView = React.forwardRef(({ children, ...props }, ref) => {
  React.useImperativeHandle(ref, () => ({
    postMessage: jest.fn(),
    reload: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
  }));

  return React.createElement(View, props, children);
});

module.exports = WebView;
module.exports.default = WebView;
module.exports.WebView = WebView;
module.exports.WebViewMessageEvent = {};
