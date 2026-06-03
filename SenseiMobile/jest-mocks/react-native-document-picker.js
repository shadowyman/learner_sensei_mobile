module.exports = {
  pickSingle: jest.fn(async () => ({
    fileCopyUri: 'file:///tmp/sensei-mobile-documents/import.json',
    name: 'import.json',
    uri: 'file:///tmp/sensei-mobile-documents/import.json',
  })),
  types: {
    allFiles: '*/*',
    plainText: 'text/plain',
  },
};
