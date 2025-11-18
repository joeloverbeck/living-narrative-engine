/**
 * @file Trace aware implementation of the action formatting instrumentation interface.
 */

import { ActionFormattingInstrumentation } from './ActionFormattingInstrumentation.js';

/**
 * @typedef {import('./ActionFormattingInstrumentation.js').StageStartContext} StageStartContext
 */
/**
 * @typedef {import('./ActionFormattingInstrumentation.js').ActionLifecycleContext} ActionLifecycleContext
 */
/**
 * @typedef {import('./ActionFormattingInstrumentation.js').StageCompletionContext} StageCompletionContext
 */

/**
 * @typedef {import('../../../../entities/entity.js').default} Entity
 */

/**
 * @typedef {object} TraceLike
 * @property {(category: string, id: string, payload: object) => void} captureActionData - Emits structured trace data.
 */

/**
 * @class TraceAwareInstrumentation
 * @augments ActionFormattingInstrumentation
 * @description Emits structured trace payloads that mirror the behaviour currently provided by {@link ActionFormattingStage}.
 */
export class TraceAwareInstrumentation extends ActionFormattingInstrumentation {
  #trace;

  #stageStartTime = 0;

  #formattingPath = 'legacy';

  /**
   * @param {TraceLike} trace - Trace instance used for emitting structured lifecycle payloads.
   */
  constructor(trace) {
    super();
    this.#trace = trace;
  }

  /**
   * @inheritdoc
   */
  stageStarted(context) {
    const { formattingPath, actor, actions } = context;

    this.#formattingPath = formattingPath;
    this.#stageStartTime = Date.now();

    for (const { actionDef, metadata = {} } of actions) {
      this.#trace.captureActionData('formatting', actionDef.id, {
        timestamp: this.#stageStartTime,
        status: 'started',
        formattingPath,
        actorId: actor.id,
        ...metadata,
      });
    }
  }

  /**
   * @inheritdoc
   */
  actionStarted(context) {
    const { actionDef, payload = {}, timestamp } = context;
    const startTimestamp = timestamp ?? Date.now();

    this.#trace.captureActionData('formatting', actionDef.id, {
      timestamp: startTimestamp,
      status: 'formatting',
      ...payload,
    });
  }

  /**
   * @inheritdoc
   */
  actionCompleted(context) {
    const { actionDef, payload = {}, timestamp } = context;
    const endTimestamp = timestamp ?? Date.now();

    this.#trace.captureActionData('formatting', actionDef.id, {
      timestamp: endTimestamp,
      status: 'completed',
      ...payload,
    });
  }

  /**
   * @inheritdoc
   */
  actionFailed(context) {
    const { actionDef, payload = {}, timestamp } = context;
    const endTimestamp = timestamp ?? Date.now();

    this.#trace.captureActionData('formatting', actionDef.id, {
      timestamp: endTimestamp,
      status: 'failed',
      ...payload,
    });
  }

  /**
   * @inheritdoc
   */
  stageCompleted(context) {
    const { formattingPath, statistics, errorCount = 0 } = context;
    const stageEndTime = Date.now();
    const totalDuration = stageEndTime - this.#stageStartTime;
    const actionCount = statistics?.total ?? 0;

    this.#trace.captureActionData('formatting', '__stage_summary', {
      timestamp: stageEndTime,
      status: 'completed',
      formattingPath: formattingPath ?? this.#formattingPath,
      statistics,
      performance: {
        totalDuration,
        averagePerAction: actionCount > 0 ? totalDuration / actionCount : 0,
      },
      errors: errorCount,
    });
  }
}

export default TraceAwareInstrumentation;
