/**
 * @file No-op implementation of the action formatting instrumentation interface.
 */

import { ActionFormattingInstrumentation } from './ActionFormattingInstrumentation.js';

/**
 * @class NoopInstrumentation
 * @extends ActionFormattingInstrumentation
 * @description Instrumentation implementation that intentionally performs no operations.
 */
export class NoopInstrumentation extends ActionFormattingInstrumentation {
  /**
   * @inheritdoc
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  stageStarted(_context) {}

  /**
   * @inheritdoc
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  actionStarted(_context) {}

  /**
   * @inheritdoc
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  actionCompleted(_context) {}

  /**
   * @inheritdoc
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  actionFailed(_context) {}

  /**
   * @inheritdoc
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  stageCompleted(_context) {}
}

export default NoopInstrumentation;
