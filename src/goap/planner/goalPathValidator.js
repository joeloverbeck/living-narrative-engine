import { deepClone } from '../../utils/cloneUtils.js';

const ACTOR_PREFIX = 'actor.';
const STATE_ACTOR_PREFIX = 'state.actor.';
const SAFE_ACTOR_FIELDS = new Set([
  'actor',
  'actor.id',
  'state.actor',
  'state.actor.id',
]);
const LITERAL_ACTOR_ID_PATTERN = /^actor(?:(?:[_:-]\w+)|(?:\d+))[\w:_-]*$/i;
let goalPathLintOverride = null;

/**
 *
 * @param value
 */
function isString(value) {
  return typeof value === 'string';
}

/**
 *
 * @param operand
 */
function normalizeVarOperand(operand) {
  if (isString(operand)) {
    return operand;
  }

  if (Array.isArray(operand) && operand.length > 0 && isString(operand[0])) {
    return operand[0];
  }

  return null;
}

/**
 *
 * @param node
 * @param collector
 */
function collectVarPaths(node, collector) {
  if (node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const value of node) {
      collectVarPaths(value, collector);
    }
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'var') {
      const normalized = normalizeVarOperand(value);
      if (normalized) {
        collector.push(normalized);
      }
    } else {
      collectVarPaths(value, collector);
    }
  }
}

/**
 * Collect entity references passed to has_component operations.
 *
 * @param node
 * @param collector
 */
function collectHasComponentEntityRefs(node, collector) {
  if (node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const value of node) {
      collectHasComponentEntityRefs(value, collector);
    }
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'has_component' && Array.isArray(value) && value.length > 0) {
      collector.push({ entityPath: value[0] });
    } else {
      collectHasComponentEntityRefs(value, collector);
    }
  }
}

/**
 *
 * @param path
 * @param prefix
 */
function needsComponentsPrefix(path, prefix) {
  if (!path.startsWith(prefix)) {
    return false;
  }

  const suffix = path.slice(prefix.length);
  if (!suffix) {
    return false;
  }

  if (suffix.startsWith('components') || suffix.startsWith('components[')) {
    return false;
  }

  if (suffix.startsWith('id')) {
    return false;
  }

  return true;
}

/**
 *
 * @param path
 */
function isInvalidActorPath(path) {
  if (!isString(path) || path.length === 0) {
    return false;
  }

  if (SAFE_ACTOR_FIELDS.has(path)) {
    return false;
  }

  return needsComponentsPrefix(path, ACTOR_PREFIX);
}

/**
 * Detect literal actor entity IDs inside has_component clauses.
 *
 * @param {unknown} entityPath
 * @returns {boolean}
 */
function isLiteralActorIdReference(entityPath) {
  if (!isString(entityPath) || entityPath.length === 0) {
    return false;
  }

  const trimmed = entityPath.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (trimmed === 'actor' || trimmed === 'state.actor') {
    return false;
  }

  if (trimmed.includes('.')) {
    return false;
  }

  return LITERAL_ACTOR_ID_PATTERN.test(trimmed);
}

/**
 *
 * @param path
 */
function isInvalidStateActorPath(path) {
  if (!isString(path) || path.length === 0) {
    return false;
  }

  if (SAFE_ACTOR_FIELDS.has(path)) {
    return false;
  }

  return needsComponentsPrefix(path, STATE_ACTOR_PREFIX);
}

/**
 *
 * @param goalState
 * @param metadata
 */
export function validateGoalPaths(goalState, metadata = {}) {
  const { goalState: normalizedGoalState, rewrites } =
    normalizeGoalState(goalState);

  if (!goalState || typeof goalState !== 'object') {
    return {
      isValid: true,
      violations: [],
      normalizedGoalState,
    };
  }

  const varPaths = [];
  collectVarPaths(normalizedGoalState, varPaths);

  const hasComponentRefs = [];
  collectHasComponentEntityRefs(normalizedGoalState, hasComponentRefs);

  const violations = [];

  for (const rewrite of rewrites) {
    violations.push({
      path: rewrite.original,
      reason: 'missing-components-prefix',
      metadata: deepClone(metadata),
    });
  }

  for (const path of varPaths) {
    if (isInvalidActorPath(path) || isInvalidStateActorPath(path)) {
      violations.push({
        path,
        reason: 'missing-components-prefix',
        metadata: deepClone(metadata),
      });
    }
  }

  for (const ref of hasComponentRefs) {
    if (isLiteralActorIdReference(ref.entityPath)) {
      violations.push({
        path: ref.entityPath,
        reason: 'literal-actor-id',
        metadata: deepClone(metadata),
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    normalizedGoalState,
  };
}

/**
 *
 */
export function shouldEnforceGoalPathLint() {
  if (goalPathLintOverride !== null) {
    return goalPathLintOverride;
  }
  return process.env.GOAP_GOAL_PATH_LINT === '1';
}

/**
 *
 * @param value
 */
export function setGoalPathLintOverride(value) {
  if (value === null || value === undefined) {
    goalPathLintOverride = null;
  } else {
    goalPathLintOverride = Boolean(value);
  }
}

/**
 *
 * @param path
 */
export function rewriteActorPath(path) {
  if (!isString(path) || path.length === 0) {
    return path;
  }

  if (SAFE_ACTOR_FIELDS.has(path)) {
    return path;
  }

  if (
    path.startsWith('state.actor.components') ||
    path.startsWith('actor.components')
  ) {
    return path;
  }

  if (path.startsWith(STATE_ACTOR_PREFIX)) {
    if (isInvalidStateActorPath(path)) {
      const suffix = path.slice(STATE_ACTOR_PREFIX.length);
      return `${STATE_ACTOR_PREFIX}components.${suffix}`;
    }
    return path;
  }

  if (path.startsWith(ACTOR_PREFIX) && isInvalidActorPath(path)) {
    const suffix = path.slice(ACTOR_PREFIX.length);
    return `${STATE_ACTOR_PREFIX}components.${suffix}`;
  }

  return path;
}

/**
 * Normalize JSON Logic goal state by rewriting actor.* references to
 * state.actor.components.* and recording every rewrite for diagnostics.
 *
 * @param {object} goalState
 * @returns {{goalState: object|null, rewrites: Array<{original: string, normalized: string}>}}
 */
export function normalizeGoalState(goalState) {
  if (!goalState || typeof goalState !== 'object') {
    return { goalState, rewrites: [] };
  }

  const normalizedGoalState = deepClone(goalState);
  const rewrites = [];
  rewriteGoalStateVars(normalizedGoalState, rewrites);
  return {
    goalState: normalizedGoalState,
    rewrites,
  };
}

/**
 * Recursively rewrite every var operand to ensure actor references point at
 * state.actor.components.* snapshots.
 *
 * @param {unknown} node
 * @param {Array<{original: string, normalized: string}>} rewrites
 */
function rewriteGoalStateVars(node, rewrites) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((value) => rewriteGoalStateVars(value, rewrites));
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'var') {
      if (typeof value === 'string') {
        const rewritten = rewriteActorPath(value);
        if (rewritten !== value) {
          node.var = rewritten;
          rewrites.push({ original: value, normalized: rewritten });
        }
      } else if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === 'string'
      ) {
        const original = value[0];
        const rewritten = rewriteActorPath(original);
        if (rewritten !== original) {
          value[0] = rewritten;
          rewrites.push({ original, normalized: rewritten });
        }
      }
    } else {
      rewriteGoalStateVars(value, rewrites);
    }
  }
}
