import { IScheduler } from './iScheduler.js';

/**
 * @class ImmediateScheduler
 * @augments IScheduler
 * @classdesc Scheduler that executes callbacks immediately for deterministic tests.
 */
export default class ImmediateScheduler extends IScheduler {
  /**
   * @inheritdoc
   */
  setTimeout(fn) {
    fn();
    return 0;
  }

  /**
   * @inheritdoc
   */

  clearTimeout() {
    // no-op
  }
}
