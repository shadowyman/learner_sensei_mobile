const React = require('react');

const createComponent = displayName => {
    const Component = React.forwardRef((props, ref) => React.createElement(displayName, { ...props, ref }, props.children));
    Component.displayName = displayName;
    return Component;
};

module.exports = {
    SafeAreaView: createComponent('SafeAreaView'),
    View: createComponent('View'),
    Text: createComponent('Text'),
    TextInput: createComponent('TextInput'),
    TouchableOpacity: createComponent('TouchableOpacity'),
    StyleSheet: {
        create: styles => styles
    },
    Platform: { OS: 'ios' }
};
