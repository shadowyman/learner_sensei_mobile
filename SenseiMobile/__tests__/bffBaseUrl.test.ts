import { deriveBffBaseUrlFromScriptURL, resolveBffBaseUrl } from '../src/mobile/network/bffBaseUrl';

describe('BFF base URL resolution', () => {
  test('maps iOS Metro script host to BFF port', () => {
    expect(resolveBffBaseUrl({
      platformOS: 'ios',
      scriptURL: 'http://192.168.1.42:8081/index.bundle?platform=ios&dev=true'
    })).toBe('http://192.168.1.42:8787');
  });

  test('keeps Android emulator fallback when no Metro host is available', () => {
    expect(resolveBffBaseUrl({
      platformOS: 'android',
      scriptURL: null
    })).toBe('http://10.0.2.2:8787');
  });

  test('falls back to iOS local host when script URL is malformed', () => {
    expect(resolveBffBaseUrl({
      platformOS: 'ios',
      scriptURL: 'not a valid bundle url'
    })).toBe('http://127.0.0.1:8787');
  });

  test('normalizes explicit override before derived hosts', () => {
    expect(resolveBffBaseUrl({
      explicitBaseUrl: 'http://dev-host.local:8787/',
      platformOS: 'ios',
      scriptURL: 'http://192.168.1.42:8081/index.bundle'
    })).toBe('http://dev-host.local:8787');
  });

  test('derives no BFF URL for non-http script URLs', () => {
    expect(deriveBffBaseUrlFromScriptURL('file:///main.jsbundle')).toBeNull();
  });
});
