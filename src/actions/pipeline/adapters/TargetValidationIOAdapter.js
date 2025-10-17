/**
 * @file TargetValidationIOAdapter.js
 * @description Normalizes pipeline context for the target validation stage and
 * provides utilities to rebuild the original structure after validation.
 */

import {
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  LEGACY_TARGET_ROLE,
} from '../TargetRoleRegistry.js';
import { deepClone } from '../../../utils/cloneUtils.js';

/**
 * @typedef {import('../../../entities/entity.js').default} Entity
 */

/**
 * @typedef {import('../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */

/**
 * @typedef {object} TargetValidationItem
 * @property {ActionDefinition} actionDef - Action definition under validation.
 * @property {object|null} resolvedTargets - Canonical resolved targets map including actor when available.
 * @property {object|null} targetDefinitions - Target definition metadata for placeholder lookups.
 * @property {Array<object>} targetContexts - Target context entries associated with the action.
 * @property {object|null} placeholderSource - Source collection for placeholder metadata.
 * @property {'actionsWithTargets'|'candidateActions'} sourceFormat - Source collection identifier.
 * @property {number} originalIndex - Index of the action in the original collection.
 * @property {object|null} originalRef - Reference to the original `actionsWithTargets` entry when applicable.
 */

/**
 * @typedef {object} TargetValidationMetadata
 * @property {Entity|null} actor - The actor entity provided to the stage.
 * @property {object|null} sharedResolvedTargetsRef - Shared resolved targets reference from the context.
 */

/**
 * @typedef {object} NormalizedTargetValidation
 * @property {'actionsWithTargets'|'candidateActions'|'empty'} format - Source format identifier.
 * @property {TargetValidationItem[]} items - Canonical item collection.
 * @property {TargetValidationMetadata} metadata - Shared metadata required for rebuild.
 */

/**
 * @typedef {object} RebuildParams
 * @property {'actionsWithTargets'|'candidateActions'|'empty'} format - Original format identifier.
 * @property {TargetValidationItem[]} items - Original normalized items (ordered).
 * @property {TargetValidationMetadata} metadata - Shared metadata captured during normalization.
 * @property {TargetValidationItem[]} validatedItems - Items that passed validation.
 */

/**
 * @typedef {object} RebuildResult
 * @property {{actionsWithTargets?: object[], candidateActions?: ActionDefinition[]}} data - Restored payload.
 * @property {boolean} continueProcessing - Indicates if downstream stages should continue processing.
 */

/**
 * IO adapter that converts pipeline context into a canonical representation for
 * the target validation stage.
 */
export class TargetValidationIOAdapter {
  /**
   * Normalize the pipeline context into canonical validation items.
   *
   * @param {object} pipelineContext - Raw pipeline context passed to the stage.
   * @returns {NormalizedTargetValidation} Canonical representation for validation.
   */
  normalize(pipelineContext) {
    const actionsWithTargets = Array.isArray(pipelineContext?.actionsWithTargets)
      ? pipelineContext.actionsWithTargets
      : [];
    const candidateActions = Array.isArray(pipelineContext?.candidateActions)
      ? pipelineContext.candidateActions
      : [];

    /** @type {'actionsWithTargets'|'candidateActions'|'empty'} */
    let format = 'empty';
    let sources = [];

    if (actionsWithTargets.length > 0) {
      format = 'actionsWithTargets';
      sources = actionsWithTargets;
    } else if (candidateActions.length > 0) {
      format = 'candidateActions';
      sources = candidateActions;
    }

    const actor = pipelineContext?.actor ?? null;
    const sharedResolvedTargetsRef = pipelineContext?.resolvedTargets ?? null;

    /** @type {TargetValidationItem[]} */
    const items = sources.map((source, index) => {
      const { actionDef } = this.#extractActionDefinition(source, format);
      const placeholderSource =
        this.#extractPlaceholderSource(source, actionDef) ?? null;
      const targetDefinitions = placeholderSource ?? null;

      const resolvedTargets = this.#buildResolvedTargets({
        source,
        actionDef,
        actor,
        format,
        sharedResolvedTargetsRef,
      });

      const targetContexts = this.#extractTargetContexts(source);

      return {
        actionDef,
        resolvedTargets,
        targetDefinitions,
        targetContexts,
        placeholderSource,
        sourceFormat: format === 'empty' ? 'candidateActions' : format,
        originalIndex: index,
        originalRef: format === 'actionsWithTargets' ? source : null,
      };
    });

    return {
      format,
      items,
      metadata: {
        actor,
        sharedResolvedTargetsRef,
      },
    };
  }

  /**
   * Rebuild the original payload structure from validated items.
   *
   * @param {RebuildParams} params - Parameters used to rebuild the payload.
   * @returns {RebuildResult} Restored data payload and continuation flag.
   */
  rebuild({ format, items, metadata, validatedItems }) {
    if (format === 'empty') {
      return {
        data: { candidateActions: [] },
        continueProcessing: false,
      };
    }

    const validatedSet = new Set(validatedItems);
    const orderedValidatedItems = items.filter((item) => validatedSet.has(item));
    const continueProcessing = orderedValidatedItems.length > 0;

    if (format === 'actionsWithTargets') {
      const rebuiltActions = orderedValidatedItems.map((item) => {
        const base = item.originalRef ? { ...item.originalRef } : { actionDef: item.actionDef };
        const sanitizedTargets = this.#sanitizeResolvedTargets(item.resolvedTargets);

        return {
          ...base,
          actionDef: item.actionDef,
          resolvedTargets: sanitizedTargets ? deepClone(sanitizedTargets) : sanitizedTargets,
          targetDefinitions: item.targetDefinitions ?? base.targetDefinitions ?? null,
          targetContexts: Array.isArray(item.targetContexts)
            ? [...item.targetContexts]
            : base.targetContexts,
        };
      });

      return {
        data: { actionsWithTargets: rebuiltActions },
        continueProcessing,
      };
    }

    // Legacy format rebuild
    const rebuiltCandidateActions = orderedValidatedItems.map((item) => item.actionDef);

    return {
      data: { candidateActions: rebuiltCandidateActions },
      continueProcessing,
    };
  }

  /**
   * Extract the action definition from the source item.
   *
   * @param {object} source - Source entry from pipeline context.
   * @param {'actionsWithTargets'|'candidateActions'|'empty'} format - Input format.
   * @returns {{ actionDef: ActionDefinition }} Extracted action definition.
   */
  #extractActionDefinition(source, format) {
    if (format === 'actionsWithTargets' && source && source.actionDef) {
      return { actionDef: source.actionDef };
    }

    return { actionDef: source };
  }

  /**
   * Extract placeholder source metadata from the source entry or action definition.
   *
   * @param {object} source - Source entry from pipeline context.
   * @param {ActionDefinition} actionDef - Action definition under normalization.
   * @returns {object|undefined} Placeholder source metadata.
   */
  #extractPlaceholderSource(source, actionDef) {
    if (source?.targetDefinitions) {
      return source.targetDefinitions;
    }

    if (actionDef?.targetDefinitions) {
      return actionDef.targetDefinitions;
    }

    if (actionDef?.targets) {
      return actionDef.targets;
    }

    return undefined;
  }

  /**
   * Build resolved targets map for the action.
   *
   * @param {object} params - Parameters required to build resolved targets.
   * @param {object} params.source - Original source entry.
   * @param {ActionDefinition} params.actionDef - Action definition being normalized.
   * @param {Entity|null} params.actor - Actor entity for the stage.
   * @param {'actionsWithTargets'|'candidateActions'|'empty'} params.format - Source format identifier.
   * @param {object|null} params.sharedResolvedTargetsRef - Shared context resolved targets reference.
   * @returns {object|null} Canonical resolved targets including actor when available.
   */
  #buildResolvedTargets({
    source,
    actionDef,
    actor,
    format,
    sharedResolvedTargetsRef,
  }) {
    const resolvedFromSource =
      (format === 'actionsWithTargets' ? source?.resolvedTargets : null) ??
      actionDef?.resolvedTargets ??
      sharedResolvedTargetsRef ??
      null;

    const cloned = resolvedFromSource ? deepClone(resolvedFromSource) : null;

    if (cloned) {
      if (actor) {
        cloned[ACTOR_ROLE] = actor;
      }
      return cloned;
    }

    if (actionDef?.target_entity) {
      const targets = { [LEGACY_TARGET_ROLE]: deepClone(actionDef.target_entity) };
      if (actor) {
        targets[ACTOR_ROLE] = actor;
      }
      return targets;
    }

    if (actionDef?.target_entities) {
      const targets = {};
      for (const role of ALL_MULTI_TARGET_ROLES) {
        if (actionDef.target_entities[role]) {
          targets[role] = deepClone(actionDef.target_entities[role]);
        }
      }
      if (actor) {
        targets[ACTOR_ROLE] = actor;
      }
      return Object.keys(targets).length > 0 ? targets : actor ? { [ACTOR_ROLE]: actor } : null;
    }

    if (actor) {
      return { [ACTOR_ROLE]: actor };
    }

    return null;
  }

  /**
   * Extract target contexts from the source entry when available.
   *
   * @param {object} source - Source entry from pipeline context.
   * @returns {Array<object>} Target context array.
   */
  #extractTargetContexts(source) {
    if (Array.isArray(source?.targetContexts)) {
      return source.targetContexts.map((contextEntry) => deepClone(contextEntry));
    }

    return [];
  }

  /**
   * Remove actor role from resolved targets when persisting back to action definitions.
   *
   * @param {object|null} resolvedTargets - Resolved targets including actor.
   * @returns {object|null} Sanitized resolved targets without actor entry.
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

export default TargetValidationIOAdapter;
