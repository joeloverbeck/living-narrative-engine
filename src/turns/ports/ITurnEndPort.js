/**
 * @file Output-port used by turn handlers to say
 * “this actor’s turn is finished”.
 *
 * Concrete adapters (e.g. Event-Bus emitters, Promise resolvers, etc.)
 * implement this contract.
 */
export class ITurnEndPort {
  /**
   * Notify whoever is listening that a turn has ended.
   * @async
   * @param {string}  entityId – ID of the actor whose turn is over.
   * @param {boolean} success  – Was the turn a success (true) or a failure (false)?
   * @returns {Promise<void>}
   */
  /* eslint-disable no-unused-vars */ // it *is* an interface
  async notifyTurnEnded(entityId, success) {
    throw new Error('ITurnEndPort.notifyTurnEnded() not implemented.');
  }

  /* eslint-enable  no-unused-vars */
}
