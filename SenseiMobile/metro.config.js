const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const defaultConfig = getDefaultConfig(projectRoot);
const sharedWatchFolders = [
  path.resolve(workspaceRoot, 'core'),
  path.resolve(workspaceRoot, 'protocol'),
  path.resolve(workspaceRoot, 'src'),
];
const escapePathForRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const projectRootPattern = escapePathForRegex(projectRoot);
const workspaceRootPattern = escapePathForRegex(workspaceRoot);

const config = {
  watchFolders: sharedWatchFolders,
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
    blockList: [
      /\/__tests__\/.*/,
      new RegExp(`${projectRootPattern}\\/node_modules\\s+\\d+\\/.*`),
      new RegExp(`${workspaceRootPattern}\\/node_modules\\s+\\d+\\/.*`),
      new RegExp(`${workspaceRootPattern}\\/backup\\/.*`),
      new RegExp(`${workspaceRootPattern}\\/tmp\\/.*`),
      new RegExp(`${workspaceRootPattern}\\/\\.git\\/.*`),
    ],
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    unstable_enablePackageExports: true,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules')
    ],
    extraNodeModules: {
      '@sensei/core': path.resolve(workspaceRoot, 'core'),
      '@sensei/protocol': path.resolve(workspaceRoot, 'protocol')
    }
  },
};

module.exports = mergeConfig(defaultConfig, config);
