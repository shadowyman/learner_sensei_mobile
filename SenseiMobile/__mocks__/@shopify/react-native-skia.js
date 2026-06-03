const React = require('react');
const { View } = require('react-native');

const Component = React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(View, { ...props, ref }, children)
);

const createPath = () => ({
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  close: jest.fn(),
  cubicTo: jest.fn(),
  quadTo: jest.fn(),
});

const Skia = {
  Color: jest.fn(value => value),
  ImageFilter: {
    MakeBlend: jest.fn(() => ({})),
    MakeBlur: jest.fn(() => ({})),
    MakeRuntimeShaderWithChildren: jest.fn(() => ({})),
    MakeShader: jest.fn(() => ({})),
  },
  Path: {
    Make: jest.fn(createPath),
  },
  RuntimeEffect: {
    Make: jest.fn(() => ({})),
  },
  RuntimeShaderBuilder: jest.fn(() => ({
    makeShader: jest.fn(() => ({})),
    setUniform: jest.fn(),
  })),
  SVG: {
    MakeFromString: jest.fn(() => ({})),
  },
  Shader: {
    MakeColor: jest.fn(() => ({})),
  },
};

module.exports = {
  BackdropFilter: Component,
  BlendMode: {
    SrcIn: 'SrcIn',
    SrcOver: 'SrcOver',
  },
  Canvas: Component,
  Circle: Component,
  Fill: Component,
  Group: Component,
  ImageFilter: Component,
  ImageSVG: Component,
  LinearGradient: Component,
  Path: Component,
  RadialGradient: Component,
  Rect: Component,
  Skia,
  TileMode: {
    Clamp: 'Clamp',
  },
  convertToColumnMajor3: jest.fn(value => value),
  processTransform2d: jest.fn(value => value),
  processUniforms: jest.fn(() => ({})),
  vec: jest.fn((x, y) => ({ x, y })),
};
