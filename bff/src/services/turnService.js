const TAG = 'TURN_SERVICE';

class TurnService {
  constructor({ sessionStore, logger }) {
    this.sessionStore = sessionStore;
    this.logger = logger;
  }

  createOrGetTurn(sessionId, clientTurnId, payload) {
    const result = this.sessionStore.createOrGetTurn(sessionId, clientTurnId, payload);
    if (!result.turn) {
      return { turn: null, isReplay: false };
    }
    this.logger.info(TAG, result.isReplay ? 'turn replay' : 'turn created', {
      sessionId,
      turnId: result.turn.id,
      clientTurnId
    });
    return result;
  }

  getTurn(turnId) {
    const turn = this.sessionStore.getTurn(turnId);
    if (!turn) {
      this.logger.warn(TAG, 'turn missing', { turnId });
    }
    return turn;
  }
}

module.exports = TurnService;
