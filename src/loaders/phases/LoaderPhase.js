/**
 * @typedef {import('../LoadContext.js').LoadContext} LoadContext
 */
export default class LoaderPhase {
  /**
   * @param {LoadContext} _ctx
   */
  async execute(_ctx) {
    throw new Error('execute() not implemented');
  }
} 