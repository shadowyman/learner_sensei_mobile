const { makeId } = require('../utils/idGenerator');

class SessionStore {
  constructor({ sessionTtlMs, idempotencyTtlMs }) {
    this.sessionTtlMs = sessionTtlMs;
    this.idempotencyTtlMs = idempotencyTtlMs;
    this.sessions = new Map();
    this.turns = new Map();
    this.sessionTurns = new Map();
    this.idempotencyKeys = new Map();
  }

  createSession(topicId, metadata) {
    const sessionId = makeId('sess');
    const session = {
      id: sessionId,
      topicId,
      metadata: metadata || {},
      createdAt: Date.now()
    };
    this.sessions.set(sessionId, session);
    this.sessionTurns.set(sessionId, new Set());
    this.idempotencyKeys.set(sessionId, new Map());
    return session;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId) || null;
    if (session && Date.now() - session.createdAt > this.sessionTtlMs) {
      this.deleteSession(sessionId);
      return null;
    }
    return session;
  }

  deleteSession(sessionId) {
    const turnIds = this.sessionTurns.get(sessionId) || new Set();
    turnIds.forEach((turnId) => this.turns.delete(turnId));
    this.sessions.delete(sessionId);
    this.sessionTurns.delete(sessionId);
    this.idempotencyKeys.delete(sessionId);
  }

  createOrGetTurn(sessionId, clientTurnId, payload) {
    const session = this.getSession(sessionId);
    if (!session) {
      return { turn: null, isReplay: false };
    }
    const keyMap = this.idempotencyKeys.get(sessionId);
    const existing = keyMap?.get(clientTurnId);
    if (existing) {
      const { turnId, createdAt } = existing;
      if (Date.now() - createdAt <= this.idempotencyTtlMs) {
        const turn = this.turns.get(turnId);
        if (turn) {
          return { turn, isReplay: true };
        }
      }
    }
    const turnId = makeId('turn');
    const turn = {
      id: turnId,
      sessionId,
      clientTurnId,
      input: payload.input,
      metadata: payload.metadata || {},
      createdAt: Date.now()
    };
    this.turns.set(turnId, turn);
    if (!this.sessionTurns.has(sessionId)) {
      this.sessionTurns.set(sessionId, new Set());
    }
    this.sessionTurns.get(sessionId).add(turnId);
    if (!this.idempotencyKeys.has(sessionId)) {
      this.idempotencyKeys.set(sessionId, new Map());
    }
    this.idempotencyKeys.get(sessionId).set(clientTurnId, {
      turnId,
      createdAt: Date.now()
    });
    return { turn, isReplay: false };
  }

  getTurn(turnId) {
    return this.turns.get(turnId) || null;
  }
}

module.exports = SessionStore;
