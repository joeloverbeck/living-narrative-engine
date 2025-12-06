/**
 * @file No-op implementation of the action formatting instrumentation interface.
 */

import { ActionFormattingInstrumentation } from './ActionFormattingInstrumentation.js';

/**
 * @class NoopInstrumentation
 * @augments ActionFormattingInstrumentation
 * @description Instrumentation implementation that intentionally performs no operations.
 */
export class NoopInstrumentation extends ActionFormattingInstrumentation {
  /**
   * @inheritdoc
   */

  stageStarted(_context) {}

  /**
   * @inheritdoc
   */

  actionStarted(_context) {}

  /**
   * @inheritdoc
   */

  actionCompleted(_context) {}

  /**
   * @inheritdoc
   */

  actionFailed(_context) {}

  /**
   * @inheritdoc
   */

  stageCompleted(_context) {}
}

export default NoopInstrumentation;
