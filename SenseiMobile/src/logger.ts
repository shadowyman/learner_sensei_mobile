export const DEBUG_FLAGS = {
  prompt_debug: false,
  mermaid_debug: false,
  learner_analysis_debug: false,
  curriculum_debug: false,
  performance_debug: true
};

const withPrefix = (level: string, args: unknown[]): void => {
  const prefix = `Sensei(${level})`;
  // eslint-disable-next-line no-console
  console[level as 'log' | 'warn' | 'error' | 'info' | 'debug']?.(prefix, ...args);
};

export const logger = {
  log: (...args: unknown[]) => withPrefix('log', args),
  info: (...args: unknown[]) => withPrefix('info', args),
  warn: (...args: unknown[]) => withPrefix('warn', args),
  error: (...args: unknown[]) => withPrefix('error', args),
  debug: (...args: unknown[]) => withPrefix('debug', args)
};
