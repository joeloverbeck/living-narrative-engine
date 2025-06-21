/**
 * @typedef {import('../loadContext.js').LoadContext} LoadContext
 */
import { createLoadContext } from '../loadContext.js';

export default class LoaderPhase {
  /**
   * @param {LoadContext} _ctx
   */
  async execute(_ctx) {
    throw new Error('execute() not implemented');
  }
}
