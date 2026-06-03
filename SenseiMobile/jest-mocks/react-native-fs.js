module.exports = {
  MainBundlePath: '/tmp/sensei-mobile-bundle',
  DocumentDirectoryPath: '/tmp/sensei-mobile-documents',
  exists: jest.fn(async () => false),
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
};
