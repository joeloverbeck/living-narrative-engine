/**
 * @file Refinement tracer for step-by-step execution capture
 * 
 * Captures and formats refinement execution traces via events from the event bus.
 * Provides detailed step-by-step execution timeline for debugging and analysis.
 */

import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { GOAP_EVENTS } from '../events/goapEvents.js';

/** @typedef {import('../../events/eventBus.js').default} IEventBus */
/** @typedef {import('../../utils/loggerUtils.js').ILogger} ILogger */
/** @typedef {import('../../data/gameDataRepository.js').default} GameDataRepository */

/**
 * @typedef {object} TraceEvent
 * @property {string} type - Event type
 * @property {object} payload - Event payload
 * @property {number} timestamp - Event timestamp
 */

/**
 * @typedef {object} TraceData
 * @property {string} actorId - Actor entity ID
 * @property {TraceEvent[]} events - Captured events
 * @property {number} startTime - Capture start timestamp
 * @property {boolean} active - Whether capture is active
 * @property {number} [endTime] - Capture end timestamp
 * @property {number} [duration] - Total capture duration
 * @property {(event: object) => void} [handler] - Event handler function
 */

/**
 * Captures and formats refinement execution traces via events.
 *
 * The tracer listens to refinement events for specific actors and provides
 * formatted output showing the step-by-step execution timeline, state updates,
 * and action generation during task refinement.
 */
class RefinementTracer {
  #eventBus;
  #logger;
  #activeTraces; // Map<actorId, TraceData>

  /**
   * Creates a new RefinementTracer instance.
   *
   * @param {object} deps - Dependencies
   * @param {IEventBus} deps.eventBus - Event bus for listening
   * @param {GameDataRepository} deps.gameDataRepository - Access to task/method definitions
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ eventBus, gameDataRepository, logger }) {
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['on', 'off', 'dispatch'],
    });
    validateDependency(gameDataRepository, 'GameDataRepository', logger, {
      requiredMethods: ['get'],
    });

    this.#eventBus = eventBus;
    this.#logger = logger;
    // gameDataRepository available for future use if needed
    this.#activeTraces = new Map();
  }

  /**
   * Start capturing refinement trace for an actor.
   *
   * @param {string} actorId - Actor entity ID
   */
  startCapture(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'RefinementTracer.startCapture',
      this.#logger
    );

    if (this.#activeTraces.has(actorId)) {
      this.#logger.warn(`Trace already active for actor ${actorId}`);
      return;
    }

    const trace = {
      actorId,
      events: [],
      startTime: Date.now(),
      active: true,
    };

    this.#activeTraces.set(actorId, trace);

    // Register event listeners
    this.#registerListeners(actorId);

    this.#logger.info(`Started refinement trace capture for ${actorId}`);
  }

  /**
   * Stop capturing and return trace for an actor.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {TraceData|null} Trace data or null if not active
   */
  stopCapture(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'RefinementTracer.stopCapture',
      this.#logger
    );

    const trace = this.#activeTraces.get(actorId);

    if (!trace) {
      this.#logger.warn(`No active trace for actor ${actorId}`);
      return null;
    }

    // Unregister event listeners
    this.#unregisterListeners(actorId);

    trace.active = false;
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    this.#activeTraces.delete(actorId);

    this.#logger.info(`Stopped refinement trace capture for ${actorId}`);

    return trace;
  }

  /**
   * Get current trace without stopping capture.
   *
   * @param {string} actorId - Actor entity ID
   * @returns {TraceData|null} Current trace or null
   */
  getTrace(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'RefinementTracer.getTrace',
      this.#logger
    );

    const trace = this.#activeTraces.get(actorId);
    return trace ? { ...trace, events: [...trace.events] } : null;
  }

  /**
   * Format trace as readable text.
   *
   * @param {TraceData|null} trace - Trace data from stopCapture()
   * @returns {string} Formatted trace text
   */
  format(trace) {
    if (!trace) {
      return '=== No Trace Data ===\n';
    }

    let output = '';
    output += `=== Refinement Trace: ${trace.actorId} ===\n`;
    output += `Capture Duration: ${trace.duration || 'ongoing'} ms\n`;
    output += `Events Captured: ${trace.events.length}\n`;
    output += `\n`;

    if (trace.events.length === 0) {
      output += `No refinement events captured.\n`;
    } else {
      output += `Events:\n`;
      for (const event of trace.events) {
        output += this.#formatEvent(event);
      }

      // Summary
      const taskRefined = trace.events.filter(
        (e) => e.type === GOAP_EVENTS.TASK_REFINED
      );
      const stepsStarted = trace.events.filter(
        (e) => e.type === GOAP_EVENTS.REFINEMENT_STEP_STARTED
      );
      const stepsCompleted = trace.events.filter(
        (e) => e.type === GOAP_EVENTS.REFINEMENT_STEP_COMPLETED
      );
      const stepsFailed = trace.events.filter(
        (e) => e.type === GOAP_EVENTS.REFINEMENT_STEP_FAILED
      );

      output += `\nSummary:\n`;
      output += `  Tasks Refined: ${taskRefined.length}\n`;
      output += `  Steps Executed: ${stepsStarted.length}\n`;
      output += `  Steps Succeeded: ${stepsCompleted.length}\n`;
      output += `  Steps Failed: ${stepsFailed.length}\n`;
    }

    output += `\n=== End Trace ===\n`;

    return output;
  }

  /**
   * Format a single event for display.
   *
   * @param {TraceEvent} event - Event from trace
   * @returns {string} Formatted event line
   */
  #formatEvent(event) {
    const timestamp = new Date(event.timestamp).toISOString();
    const type = event.type.replace('goap:', '').toUpperCase();

    let line = `[${timestamp}] ${type}`;

    switch (event.type) {
      case GOAP_EVENTS.TASK_REFINED:
        line += `: taskId=${event.payload.taskId}, stepsGenerated=${event.payload.stepsGenerated || 0}\n`;
        break;

      case GOAP_EVENTS.REFINEMENT_STEP_STARTED:
        line += `: step=${event.payload.stepIndex}, stepType=${event.payload.step?.stepType}\n`;
        break;

      case GOAP_EVENTS.REFINEMENT_STEP_COMPLETED:
        line += `: step=${event.payload.stepIndex}, success=${event.payload.result?.success}, duration=${event.payload.duration}ms\n`;
        break;

      case GOAP_EVENTS.REFINEMENT_STEP_FAILED:
        line += `: step=${event.payload.stepIndex}, error="${event.payload.error}"\n`;
        break;

      case GOAP_EVENTS.REFINEMENT_STATE_UPDATED:
        line += `: ${event.payload.key} = ${JSON.stringify(event.payload.newValue)}\n`;
        break;

      case GOAP_EVENTS.REFINEMENT_FAILED:
        line += `: taskId=${event.payload.taskId}, reason="${event.payload.reason}"\n`;
        break;

      default:
        line += `: ${JSON.stringify(event.payload)}\n`;
    }

    return line;
  }

  /**
   * Register event listeners for an actor.
   *
   * @param {string} actorId - Actor entity ID
   */
  #registerListeners(actorId) {
    const handler = (event) => {
      const trace = this.#activeTraces.get(actorId);

      if (!trace || !trace.active) {
        return;
      }

      // Only capture events for this actor
      if (event.payload.actorId === actorId) {
        trace.events.push({
          type: event.type,
          payload: { ...event.payload },
          timestamp: event.payload.timestamp || Date.now(),
        });
      }
    };

    // Store handler for cleanup
    if (!this.#activeTraces.has(actorId)) {
      return;
    }

    this.#activeTraces.get(actorId).handler = handler;

    // Listen to all refinement events
    this.#eventBus.on(GOAP_EVENTS.TASK_REFINED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_FAILED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_STARTED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STEP_FAILED, handler);
    this.#eventBus.on(GOAP_EVENTS.REFINEMENT_STATE_UPDATED, handler);
  }

  /**
   * Unregister event listeners for an actor.
   *
   * @param {string} actorId - Actor entity ID
   */
  #unregisterListeners(actorId) {
    const trace = this.#activeTraces.get(actorId);

    if (!trace || !trace.handler) {
      return;
    }

    const handler = trace.handler;

    // Remove all listeners
    this.#eventBus.off(GOAP_EVENTS.TASK_REFINED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_FAILED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STEP_STARTED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STEP_COMPLETED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STEP_FAILED, handler);
    this.#eventBus.off(GOAP_EVENTS.REFINEMENT_STATE_UPDATED, handler);
  }
}

export default RefinementTracer;
