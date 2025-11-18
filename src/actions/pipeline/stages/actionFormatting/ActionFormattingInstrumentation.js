/**
 * @file Interface describing lifecycle hooks for action formatting instrumentation.
 */

/**
 * @typedef {import('../../../../entities/entity.js').default} Entity
 */
/**
 * @typedef {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */
/**
 * @typedef {object} StageStartActionContext
 * @property {ActionDefinition} actionDef - The action definition being formatted.
 * @property {object} [metadata] - Additional metadata captured when the stage starts.
 */

/**
 * @typedef {object} StageStartContext
 * @property {Entity} actor - The actor that owns the actions being formatted.
 * @property {'legacy'|'multi-target'|'per-action'} formattingPath - Formatting pathway being executed.
 * @property {StageStartActionContext[]} actions - Metadata for the actions that will be formatted.
 */

/**
 * @typedef {object} ActionLifecycleContext
 * @property {ActionDefinition} actionDef - The action definition under consideration.
 * @property {object} [payload] - Arbitrary payload captured for trace emission.
 * @property {number} [timestamp] - Optional timestamp override for deterministic testing.
 */

/**
 * @typedef {object} StageCompletionContext
 * @property {'legacy'|'multi-target'|'per-action'} formattingPath - Formatting pathway that completed.
 * @property {{total:number,successful:number,failed:number,perActionMetadata:number,multiTarget:number,legacy:number}} statistics - Aggregated statistics captured for the stage.
 * @property {number} [errorCount] - Number of formatting errors that occurred.
 */

/**
 * @interface ActionFormattingInstrumentation
 * @description Lifecycle hooks that instrumentation implementations must provide.
 */
export class ActionFormattingInstrumentation {
  /**
   * @param {StageStartContext} _context - Context describing the actions prior to formatting.
   * @returns {void}
   */
   
  stageStarted(_context) {
    throw new Error('ActionFormattingInstrumentation.stageStarted must be implemented');
  }

  /**
   * @param {ActionLifecycleContext} _context - Context supplied when an action begins formatting.
   * @returns {void}
   */
   
  actionStarted(_context) {
    throw new Error('ActionFormattingInstrumentation.actionStarted must be implemented');
  }

  /**
   * @param {ActionLifecycleContext} _context - Context describing a successfully formatted action.
   * @returns {void}
   */
   
  actionCompleted(_context) {
    throw new Error('ActionFormattingInstrumentation.actionCompleted must be implemented');
  }

  /**
   * @param {ActionLifecycleContext} _context - Context describing an action formatting failure.
   * @returns {void}
   */
   
  actionFailed(_context) {
    throw new Error('ActionFormattingInstrumentation.actionFailed must be implemented');
  }

  /**
   * @param {StageCompletionContext} _context - Context describing the completion statistics for the stage.
   * @returns {void}
   */
   
  stageCompleted(_context) {
    throw new Error('ActionFormattingInstrumentation.stageCompleted must be implemented');
  }
}

export default ActionFormattingInstrumentation;
