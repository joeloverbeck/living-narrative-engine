import { IScheduler } from './iScheduler.js';

/**
 * @class RealScheduler
 * @augments IScheduler
 * @classdesc Scheduler that delegates to the global environment.
 */
export default class RealScheduler extends IScheduler {
  /**
   * @inheritdoc
   */
  setTimeout(fn, ms) {
    return globalThis.setTimeout(fn, ms);
  }

  /**
   * @inheritdoc
   */
  clearTimeout(id) {
    globalThis.clearTimeout(id);
  }
}
