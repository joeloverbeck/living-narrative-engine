/**
 * @file ContextUpdateEmitter.js
 * @description Applies immutable target validation results back to the pipeline context.
 */

import { ACTOR_ROLE } from '../../TargetRoleRegistry.js';
import { deepClone } from '../../../../utils/cloneUtils.js';

/**
 * @typedef {import('../../adapters/TargetValidationIOAdapter.js').TargetValidationItem} TargetValidationItem
 */

/**
 * @typedef {import('../../adapters/TargetValidationIOAdapter.js').TargetValidationMetadata} TargetValidationMetadata
 */

/**
 * @typedef {object} StageUpdate
 * @property {string} stage - The originating stage name.
 * @property {string} type - The update type identifier.
 * @property {string|null} actionId - Identifier of the affected action, when available.
 * @property {Array<object>} removedTargets - Removed target metadata emitted by the pruner.
 * @property {string[]} removalReasons - Human readable removal reasons.
 */

/**
 * @typedef {object} TargetValidationResult
 * @property {string|null} actionId - Identifier of the evaluated action.
 * @property {boolean} kept - Indicates whether the action survived validation.
 * @property {object|null} keptTargets - Sanitized target collection kept for the action.
 * @property {Array<object>} targetContexts - Filtered target context entries for the action.
 * @property {StageUpdate[]} stageUpdates - Stage updates recorded during validation for the action.
 * @property {number} originalIndex - Original index of the action in the source collection.
 * @property {'actionsWithTargets'|'candidateActions'} sourceFormat - Source collection identifier.
 */

/**
 * Collaborator responsible for synchronising target validation results back to the
 * mutable pipeline context while exposing immutable result descriptions.
 */
export class ContextUpdateEmitter {
  /**
   * Apply validation results to the provided pipeline context.
   *
   * @param {object} params - Application parameters.
   * @param {object} params.context - Pipeline context being mutated.
   * @param {'actionsWithTargets'|'candidateActions'|'empty'} params.format - Source collection identifier.
   * @param {TargetValidationItem[]} params.items - Normalised validation items (original ordering).
   * @param {TargetValidationMetadata} params.metadata - Shared metadata captured during normalisation.
   * @param {TargetValidationItem[]} params.validatedItems - Items that survived validation.
   * @returns {TargetValidationResult[]} Immutable result descriptions per processed action.
   */
  applyTargetValidationResults({
    context,
    format,
    items,
    metadata,
    validatedItems,
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const validatedSet = new Set(validatedItems);
    const results = items.map((item) =>
      this.#buildResult({
        item,
        kept: validatedSet.has(item),
        metadata,
      })
    );

    if (format === 'actionsWithTargets') {
      this.#applyActionsWithTargets({ context, items, validatedSet });
    } else if (format === 'candidateActions') {
      this.#applyCandidateActions({ context, items, metadata, validatedSet });
    }

    return results;
  }

  /**
   * Build result metadata for a validation item.
   *
   * @private
   * @param {object} params - Build parameters.
   * @param {TargetValidationItem} params.item - Item being described.
   * @param {boolean} params.kept - Indicates whether the action survived validation.
   * @param {TargetValidationMetadata} params.metadata - Shared metadata containing stage updates.
   * @returns {TargetValidationResult} Result description.
   */
  #buildResult({ item, kept, metadata }) {
    const sanitizedTargets = this.#sanitizeResolvedTargets(item.resolvedTargets);

    return {
      actionId: item.actionDef?.id ?? null,
      kept,
      keptTargets: sanitizedTargets ? deepClone(sanitizedTargets) : null,
      targetContexts: Array.isArray(item.targetContexts)
        ? item.targetContexts.map((contextEntry) => deepClone(contextEntry))
        : [],
      stageUpdates: this.#extractStageUpdates(metadata, item.actionDef?.id ?? null),
      originalIndex: item.originalIndex,
      sourceFormat: item.sourceFormat,
    };
  }

  /**
   * Apply validation results for `actionsWithTargets` sources.
   *
   * @private
   * @param {object} params - Application parameters.
   * @param {object} params.context - Pipeline context.
   * @param {TargetValidationItem[]} params.items - All processed items.
   * @param {Set<TargetValidationItem>} params.validatedSet - Surviving items.
   * @returns {void}
   */
  #applyActionsWithTargets({ context, items, validatedSet }) {
    const orderedValidated = items.filter((item) => validatedSet.has(item));

    if (!Array.isArray(context.actionsWithTargets)) {
      context.actionsWithTargets = [];
    }

    context.actionsWithTargets = orderedValidated.map((item) => {
      const base = item.originalRef ? { ...item.originalRef } : { actionDef: item.actionDef };
      const sanitizedTargets = this.#sanitizeResolvedTargets(item.resolvedTargets);

      return {
        ...base,
        actionDef: item.actionDef,
        resolvedTargets: sanitizedTargets ? deepClone(sanitizedTargets) : sanitizedTargets,
        targetDefinitions: item.targetDefinitions ?? base.targetDefinitions ?? null,
        targetContexts: Array.isArray(item.targetContexts)
          ? item.targetContexts.map((entry) => deepClone(entry))
          : base.targetContexts,
      };
    });
  }

  /**
   * Apply validation results for legacy `candidateActions` sources.
   *
   * @private
   * @param {object} params - Application parameters.
   * @param {object} params.context - Pipeline context.
   * @param {TargetValidationItem[]} params.items - All processed items.
   * @param {TargetValidationMetadata} params.metadata - Shared metadata captured during normalisation.
   * @param {Set<TargetValidationItem>} params.validatedSet - Surviving items.
   * @returns {void}
   */
  #applyCandidateActions({ context, items, metadata, validatedSet }) {
    const orderedValidated = items.filter((item) => validatedSet.has(item));

    for (const item of items) {
      const sanitizedTargets = this.#sanitizeResolvedTargets(item.resolvedTargets);

      if (validatedSet.has(item) && sanitizedTargets) {
        item.actionDef.resolvedTargets = deepClone(sanitizedTargets);
      } else if (item.actionDef.resolvedTargets) {
        delete item.actionDef.resolvedTargets;
      }
    }

    context.candidateActions = orderedValidated.map((item) => item.actionDef);

    this.#synchroniseSharedResolvedTargets(metadata, orderedValidated);
  }

  /**
   * Extract stage updates applicable to the provided action identifier.
   *
   * @private
   * @param {TargetValidationMetadata} metadata - Shared metadata containing stage updates.
   * @param {string|null} actionId - Action identifier used for filtering.
   * @returns {StageUpdate[]} Stage updates relevant to the action.
   */
  #extractStageUpdates(metadata, actionId) {
    const stageUpdates = Array.isArray(metadata?.stageUpdates)
      ? metadata.stageUpdates
      : [];

    return stageUpdates
      .filter((update) => (update?.actionId ?? null) === actionId)
      .map((update) => ({
        stage: update.stage,
        type: update.type,
        actionId: update.actionId ?? null,
        removedTargets: Array.isArray(update.removedTargets)
          ? update.removedTargets.map((entry) => ({ ...entry }))
          : [],
        removalReasons: Array.isArray(update.removalReasons)
          ? [...update.removalReasons]
          : [],
      }));
  }

  /**
   * Synchronise the shared resolved targets reference with validated results.
   *
   * @private
   * @param {TargetValidationMetadata} metadata - Normalisation metadata.
   * @param {TargetValidationItem[]} orderedValidated - Surviving validation items.
   * @returns {void}
   */
  #synchroniseSharedResolvedTargets(metadata, orderedValidated) {
    const sharedTargets = metadata?.sharedResolvedTargetsRef;
    if (!sharedTargets || typeof sharedTargets !== 'object') {
      return;
    }

    const survivingRoles = new Set();
    for (const item of orderedValidated) {
      if (!item.resolvedTargets || typeof item.resolvedTargets !== 'object') {
        continue;
      }

      for (const [role, value] of Object.entries(item.resolvedTargets)) {
        if (role === ACTOR_ROLE) {
          continue;
        }
        sharedTargets[role] = deepClone(value);
        survivingRoles.add(role);
      }
    }

    for (const role of Object.keys(sharedTargets)) {
      if (!survivingRoles.has(role)) {
        delete sharedTargets[role];
      }
    }
  }

  /**
   * Remove the actor entry from resolved targets for downstream consumers.
   *
   * @private
   * @param {object|null} resolvedTargets - Resolved target map including actor when present.
   * @returns {object|null} Sanitised resolved targets.
   */
  #sanitizeResolvedTargets(resolvedTargets) {
    if (!resolvedTargets || typeof resolvedTargets !== 'object') {
      return null;
    }

    const sanitized = {};
    for (const [role, value] of Object.entries(resolvedTargets)) {
      if (role === ACTOR_ROLE) {
        continue;
      }
      sanitized[role] = value;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }
}

export default ContextUpdateEmitter;
