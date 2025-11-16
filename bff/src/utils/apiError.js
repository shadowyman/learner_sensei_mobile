class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sendError = (res, status, code, message, extra) => {
  if (extra?.headers) {
    Object.entries(extra.headers).forEach(([key, value]) => {
      res.set(key, value);
    });
  }
  return res.status(status).json({ code, message });
};

module.exports = {
  ApiError,
  sendError
};
