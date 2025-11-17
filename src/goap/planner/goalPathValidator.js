import { deepClone } from '../../utils/cloneUtils.js';

const ACTOR_PREFIX = 'actor.';
const STATE_ACTOR_PREFIX = 'state.actor.';
const SAFE_ACTOR_FIELDS = new Set(['actor', 'actor.id', 'state.actor', 'state.actor.id']);
let goalPathLintOverride = null;

function isString(value) {
  return typeof value === 'string';
}

function normalizeVarOperand(operand) {
  if (isString(operand)) {
    return operand;
  }

  if (Array.isArray(operand) && operand.length > 0 && isString(operand[0])) {
    return operand[0];
  }

  return null;
}

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

function isInvalidActorPath(path) {
  if (!isString(path) || path.length === 0) {
    return false;
  }

  if (SAFE_ACTOR_FIELDS.has(path)) {
    return false;
  }

  return needsComponentsPrefix(path, ACTOR_PREFIX);
}

function isInvalidStateActorPath(path) {
  if (!isString(path) || path.length === 0) {
    return false;
  }

  if (SAFE_ACTOR_FIELDS.has(path)) {
    return false;
  }

  return needsComponentsPrefix(path, STATE_ACTOR_PREFIX);
}

export function validateGoalPaths(goalState, metadata = {}) {
  if (!goalState || typeof goalState !== 'object') {
    return { isValid: true, violations: [] };
  }

  const varPaths = [];
  collectVarPaths(goalState, varPaths);

  const violations = [];
  for (const path of varPaths) {
    if (isInvalidActorPath(path) || isInvalidStateActorPath(path)) {
      violations.push({
        path,
        reason: 'missing-components-prefix',
        metadata: deepClone(metadata),
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

export function shouldEnforceGoalPathLint() {
  if (goalPathLintOverride !== null) {
    return goalPathLintOverride;
  }
  return process.env.GOAP_GOAL_PATH_LINT === '1';
}

export function setGoalPathLintOverride(value) {
  if (value === null || value === undefined) {
    goalPathLintOverride = null;
  } else {
    goalPathLintOverride = Boolean(value);
  }
}

export function rewriteActorPath(path) {
  if (!isString(path) || path.length === 0) {
    return path;
  }

  if (SAFE_ACTOR_FIELDS.has(path)) {
    return path;
  }

  if (path.startsWith('state.actor.components') || path.startsWith('actor.components')) {
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
