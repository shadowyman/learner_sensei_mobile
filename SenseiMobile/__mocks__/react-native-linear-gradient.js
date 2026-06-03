const React = require('react');
const { View } = require('react-native');

module.exports = React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(View, { ...props, ref }, children)
);
