const TAG = 'SESSION_SERVICE';

class SessionService {
  constructor({ sessionStore, logger, topicRegistry }) {
    this.sessionStore = sessionStore;
    this.logger = logger;
    this.topicRegistry = topicRegistry;
  }

  createSession(topicId, metadata) {
    if (!this.topicRegistry.has(topicId)) {
      const error = new Error('Unknown topic');
      error.code = 'BAD_REQUEST';
      throw error;
    }
    const session = this.sessionStore.createSession(topicId, metadata);
    this.logger.info(TAG, 'session created', { sessionId: session.id, topicId });
    return session;
  }

  getSession(sessionId) {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) {
      this.logger.warn(TAG, 'session missing', { sessionId });
    }
    return session;
  }
}

module.exports = SessionService;
