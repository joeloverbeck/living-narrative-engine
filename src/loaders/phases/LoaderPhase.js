/**
 * @typedef {import('../LoadContext.js').LoadContext} LoadContext
 */
import { createLoadContext } from '../LoadContext.js';

export default class LoaderPhase {
  constructor(name) {
    this.name = name;
  }
  /**
   * @param {LoadContext} _ctx
   */
  async execute(_ctx) {
    throw new Error('execute() not implemented');
  }
}