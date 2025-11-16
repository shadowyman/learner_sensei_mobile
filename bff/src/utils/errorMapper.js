const DEFAULT_WS_ERROR = {
  code: 'BAD_REQUEST',
  message: 'Something went wrong. Please try again.'
};

const mapCode = (code) => {
  switch (code) {
    case 'BAD_REQUEST':
      return DEFAULT_WS_ERROR;
    case 'RATE_LIMITED':
      return {
        code: 'RATE_LIMITED',
        message: 'Too many messages—wait a moment before trying again.'
      };
    case 'DOWNSTREAM_UNAVAILABLE':
      return {
        code: 'DOWNSTREAM_UNAVAILABLE',
        message: 'Sensei is busy—try again shortly.'
      };
    case 'TURN_TIMEOUT':
      return {
        code: 'TURN_TIMEOUT',
        message: 'Sensei timed out—try again.'
      };
    default:
      return DEFAULT_WS_ERROR;
  }
};

const toWsError = (error) => {
  const code = error?.code || 'BAD_REQUEST';
  return mapCode(code);
};

module.exports = {
  toWsError
};
