/**
 * @typedef {import('../LoadContext.js').LoadContext} LoadContext
 */
import { createLoadContext } from '../LoadContext.js';

export default class LoaderPhase {
  constructor(name) {
    this.name = name;
  }
  /**
   * @param {LoadContext} executionContext
   */
  async execute(executionContext) {
    throw new Error('execute() not implemented');
  }
}
