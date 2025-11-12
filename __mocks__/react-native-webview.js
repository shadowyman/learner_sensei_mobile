const React = require('react');

class WebView extends React.Component {
    render() {
        return React.createElement('WebView', this.props, this.props.children);
    }
}

module.exports = WebView;
module.exports.WebView = WebView;
