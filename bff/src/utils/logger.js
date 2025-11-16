const serialize = (meta) => {
  if (!meta) {
    return '';
  }
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (_) {
    return '';
  }
};

const log = (level, tag, message, meta) => {
  const timestamp = new Date().toISOString();
  const line = `[${tag}] ${message}${serialize(meta)}`;
  if (level === 'error') {
    console.error(timestamp, line);
  } else if (level === 'warn') {
    console.warn(timestamp, line);
  } else {
    console.log(timestamp, line);
  }
};

module.exports = {
  info(tag, message, meta) {
    log('info', tag, message, meta);
  },
  warn(tag, message, meta) {
    log('warn', tag, message, meta);
  },
  error(tag, message, meta) {
    log('error', tag, message, meta);
  }
};
