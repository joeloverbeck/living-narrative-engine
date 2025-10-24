/**
 * @file TargetCandidatePruner.js
 * @description Provides immutable pruning of resolved target candidates based on required component rules.
 */

import {
  getRolesWithRequirements as defaultGetRolesWithRequirements,
  getPlaceholderForRole as defaultGetPlaceholderForRole,
} from '../../TargetRoleRegistry.js';
import { extractCandidateId } from '../../utils/targetCandidateUtils.js';

const DEFAULT_LOGGER = Object.freeze({
  debug: () => {},
});

/**
 * @typedef {import('../../../validation/TargetRequiredComponentsValidator.js').default} TargetRequiredComponentsValidator
 */

/**
 * @typedef {object} TargetCandidatePrunerParams
 * @property {import('../../../interfaces/IGameDataRepository.js').ActionDefinition|null|undefined} actionDef - Action definition under evaluation.
 * @property {object|null|undefined} resolvedTargets - Resolved target map including actor entries when available.
 * @property {Array<object>|null|undefined} targetContexts - Target context collection for placeholder reconciliation.
 * @property {object} [registry] - Optional registry overrides for testing.
 * @property {Function} [registry.getRolesWithRequirements] - Override for role extraction helper.
 * @property {Function} [registry.getPlaceholderForRole] - Override for placeholder resolution helper.
 * @property {object} [config] - Optional configuration data.
 * @property {object|null|undefined} [config.placeholderSource] - Placeholder definition source.
 */

/**
 * @typedef {object} TargetCandidatePrunerResult
 * @property {object|null} keptTargets - Filtered target collection after pruning.
 * @property {Array<{role: string, targetId: string|null, placeholder: string|null, reason: string|null, reasonCode: string}>} removedTargets - Metadata describing removed candidates.
 * @property {string[]} removalReasons - High level removal reasons for roles left without valid candidates.
 */

/**
 * @class TargetCandidatePruner
 * @description Encapsulates required-component filtering for resolved target candidates while preserving immutable results.
 */
export class TargetCandidatePruner {
  #logger;

  /**
   * Create a TargetCandidatePruner.
   *
   * @param {object} [dependencies] - Optional dependencies.
   * @param {{debug: Function}} [dependencies.logger] - Logger used for debug tracing.
   */
  constructor({ logger } = {}) {
    this.#logger = logger && typeof logger.debug === 'function' ? logger : DEFAULT_LOGGER;
  }

  /**
   * Prune resolved targets using required component definitions.
   *
   * @param {TargetCandidatePrunerParams} params - Pruning parameters.
   * @returns {TargetCandidatePrunerResult} Immutable pruning results.
   */
  prune({ actionDef, resolvedTargets, targetContexts, registry = {}, config = {} }) {
    const requirements = actionDef?.required_components;
    const clonedTargets = this.#cloneResolvedTargets(resolvedTargets);

    if (!requirements || !clonedTargets) {
      return {
        keptTargets: clonedTargets,
        removedTargets: [],
        removalReasons: [],
      };
    }

    const getRolesWithRequirements =
      typeof registry.getRolesWithRequirements === 'function'
        ? registry.getRolesWithRequirements
        : defaultGetRolesWithRequirements;
    const getPlaceholderForRole =
      typeof registry.getPlaceholderForRole === 'function'
        ? registry.getPlaceholderForRole
        : defaultGetPlaceholderForRole;

    const rolesToCheck = getRolesWithRequirements(requirements);
    if (rolesToCheck.length === 0) {
      return {
        keptTargets: clonedTargets,
        removedTargets: [],
        removalReasons: [],
      };
    }

    const placeholderSource =
      config?.placeholderSource ?? actionDef?.targetDefinitions ?? actionDef?.targets ?? null;
    const placeholderMap = new Map();
    for (const role of rolesToCheck) {
      const placeholder = getPlaceholderForRole(role, placeholderSource) ?? null;
      placeholderMap.set(role, placeholder);
    }

    const contextPlaceholderByEntityId = new Map();
    if (Array.isArray(targetContexts)) {
      for (const ctx of targetContexts) {
        if (
          ctx &&
          ctx.type === 'entity' &&
          typeof ctx.entityId === 'string' &&
          ctx.entityId.length > 0
        ) {
          contextPlaceholderByEntityId.set(
            ctx.entityId,
            typeof ctx.placeholder === 'string' && ctx.placeholder.length > 0
              ? ctx.placeholder
              : null
          );
        }
      }
    }

    /** @type {Array<{role: string, targetId: string|null, placeholder: string|null, reason: string|null, reasonCode: string}>} */
    const removedTargets = [];
    const removalReasons = [];

    for (const role of rolesToCheck) {
      const existing = resolvedTargets?.[role];
      if (!existing) {
        continue;
      }

      const candidates = Array.isArray(existing) ? existing.slice() : [existing];
      const requiredComponents = Array.isArray(requirements[role])
        ? requirements[role]
        : [];
      const validCandidates = [];
      let lastRemovalReason = null;

      for (const candidate of candidates) {
        const evaluation = this.#candidateHasRequiredComponents(candidate, requiredComponents, role);

        if (evaluation.valid) {
          validCandidates.push(candidate);
        } else {
          const candidateId = extractCandidateId(candidate);
          const placeholder =
            placeholderMap.get(role) ??
            (candidateId ? contextPlaceholderByEntityId.get(candidateId) ?? null : null);
          removedTargets.push({
            role,
            targetId: candidateId,
            placeholder,
            reason: evaluation.reason ?? null,
            reasonCode: evaluation.reasonCode ?? 'unknown',
          });
          if (evaluation.reason) {
            lastRemovalReason = evaluation.reason;
            this.#logger.debug(evaluation.reason);
          }
        }
      }

      if (Array.isArray(existing)) {
        clonedTargets[role] = validCandidates;
      } else {
        clonedTargets[role] = validCandidates.length > 0 ? validCandidates[0] : null;
      }

      if (validCandidates.length === 0) {
        const placeholder = placeholderMap.get(role) ?? null;
        const reason =
          lastRemovalReason || `No ${role} target available for validation`;
        removalReasons.push(reason);

        if (candidates.length === 0) {
          removedTargets.push({
            role,
            targetId: null,
            placeholder,
            reason,
            reasonCode: 'missing_candidate',
          });
        }
      }
    }

    return {
      keptTargets: clonedTargets,
      removedTargets,
      removalReasons,
    };
  }

  /**
   * Create an immutable shallow clone of resolved targets.
   *
   * @private
   * @param {object|null|undefined} resolvedTargets - Original resolved target map.
   * @returns {object|null} Cloned target map or null when unavailable.
   */
  #cloneResolvedTargets(resolvedTargets) {
    if (!resolvedTargets || typeof resolvedTargets !== 'object') {
      return null;
    }

    const clone = {};
    for (const [role, value] of Object.entries(resolvedTargets)) {
      clone[role] = Array.isArray(value) ? value.slice() : value ?? null;
    }

    return clone;
  }

  /**
   * Determine if a candidate satisfies required component constraints.
   *
   * @private
   * @param {object|null} candidate - Candidate target instance.
   * @param {string[]} requiredComponents - Required component identifiers.
   * @param {string} role - Target role under evaluation.
   * @returns {{valid: boolean, reason?: string, reasonCode?: string}} Validation outcome.
   */
  #candidateHasRequiredComponents(candidate, requiredComponents, role) {
    if (!Array.isArray(requiredComponents) || requiredComponents.length === 0) {
      return { valid: true };
    }

    if (!candidate) {
      return {
        valid: false,
        reason: `No ${role} target available for validation`,
        reasonCode: 'missing_candidate',
      };
    }

    const targetEntity = candidate.entity || candidate;

    for (const componentId of requiredComponents) {
      if (!componentId) {
        continue;
      }

      if (targetEntity.components && targetEntity.components[componentId]) {
        continue;
      }

      if (typeof targetEntity.hasComponent === 'function') {
        try {
          if (targetEntity.hasComponent(componentId)) {
            continue;
          }
        } catch (error) {
          this.#logger.debug(
            `Error checking hasComponent('${componentId}') on ${targetEntity.id || 'unknown'}: ${error.message}`
          );
        }
      }

      const entityId = targetEntity.id || 'unknown';
      this.#logger.debug(
        `Target entity ${entityId} missing required component: ${componentId}`
      );

      return {
        valid: false,
        reason: `Target (${role}) must have component: ${componentId}`,
        reasonCode: 'missing_required_component',
      };
    }

    return { valid: true };
  }
}

export default TargetCandidatePruner;
