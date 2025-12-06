/**
 * @file TargetRoleRegistry.js
 * @description Provides canonical role definitions and helper utilities for target validation.
 */

export const LEGACY_TARGET_ROLE = 'target';
export const PRIMARY_ROLE = 'primary';
export const SECONDARY_ROLE = 'secondary';
export const TERTIARY_ROLE = 'tertiary';
export const ACTOR_ROLE = 'actor';

export const ALL_MULTI_TARGET_ROLES = Object.freeze([
  PRIMARY_ROLE,
  SECONDARY_ROLE,
  TERTIARY_ROLE,
]);

export const LEGACY_ROLES = Object.freeze([LEGACY_TARGET_ROLE]);
export const ALL_TARGET_ROLES = Object.freeze([
  LEGACY_TARGET_ROLE,
  ...ALL_MULTI_TARGET_ROLES,
]);

export const ALL_ROLES_WITH_ACTOR = Object.freeze([
  ACTOR_ROLE,
  ...ALL_MULTI_TARGET_ROLES,
]);

/**
 * Determines whether the provided role is supported by the registry.
 *
 * @param {string} role - Target role to validate.
 * @returns {boolean} True when the role is recognized.
 */
export function isSupportedRole(role) {
  return ALL_TARGET_ROLES.includes(role) || role === ACTOR_ROLE;
}

/**
 * Determine the placeholder definition for a role.
 *
 * @param {string} role - Role to inspect.
 * @param {object|undefined|null} placeholderSource - Placeholder metadata collection.
 * @returns {string|undefined} Placeholder identifier when available.
 */
export function getPlaceholderForRole(role, placeholderSource) {
  if (!placeholderSource || typeof placeholderSource !== 'object') {
    return undefined;
  }

  const entry = placeholderSource[role];
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }

  return entry.placeholder;
}

/**
 * Extract roles that define required components.
 *
 * @param {object|undefined|null} requirements - Required components definition.
 * @returns {string[]} Ordered list of roles with requirements.
 */
export function getRolesWithRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object') {
    return [];
  }

  const roles = [];
  if (
    Array.isArray(requirements[LEGACY_TARGET_ROLE]) &&
    requirements[LEGACY_TARGET_ROLE].length > 0
  ) {
    roles.push(LEGACY_TARGET_ROLE);
  }

  for (const role of ALL_MULTI_TARGET_ROLES) {
    if (Array.isArray(requirements[role]) && requirements[role].length > 0) {
      roles.push(role);
    }
  }

  return roles;
}

/**
 * Determine if an action definition represents the legacy target payload.
 *
 * @param {import('../../interfaces/IGameDataRepository.js').ActionDefinition|undefined|null} actionDef - Action definition to inspect.
 * @returns {boolean} True when the action follows the legacy single-target format.
 */
export function isLegacyTargetPayload(actionDef) {
  if (!actionDef) {
    return false;
  }

  if (actionDef.target_entity) {
    return true;
  }

  if (
    actionDef.resolvedTargets &&
    actionDef.resolvedTargets[LEGACY_TARGET_ROLE]
  ) {
    return true;
  }

  if (actionDef.targets && actionDef.targets[LEGACY_TARGET_ROLE]) {
    return true;
  }

  return false;
}

/**
 * Determine if an action definition represents the multi-target payload.
 *
 * @param {import('../../interfaces/IGameDataRepository.js').ActionDefinition|undefined|null} actionDef - Action definition to inspect.
 * @returns {boolean} True when the action exposes multi-target roles.
 */
export function isMultiTargetPayload(actionDef) {
  if (!actionDef) {
    return false;
  }

  if (actionDef.target_entities) {
    return ALL_MULTI_TARGET_ROLES.some(
      (role) => actionDef.target_entities[role]
    );
  }

  if (actionDef.resolvedTargets) {
    return ALL_MULTI_TARGET_ROLES.some(
      (role) => actionDef.resolvedTargets[role]
    );
  }

  if (actionDef.targetDefinitions) {
    return ALL_MULTI_TARGET_ROLES.some(
      (role) => actionDef.targetDefinitions[role]
    );
  }

  return false;
}

export default {
  LEGACY_TARGET_ROLE,
  PRIMARY_ROLE,
  SECONDARY_ROLE,
  TERTIARY_ROLE,
  ACTOR_ROLE,
  ALL_MULTI_TARGET_ROLES,
  ALL_TARGET_ROLES,
  ALL_ROLES_WITH_ACTOR,
  LEGACY_ROLES,
  isSupportedRole,
  getPlaceholderForRole,
  getRolesWithRequirements,
  isLegacyTargetPayload,
  isMultiTargetPayload,
};
