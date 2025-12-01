/**
 * @file Configuration for LLM pending approval timeout handling.
 * @description Provides policy and timing settings for auto-resolving LLM suggestions
 *              when human approval is pending. Defaults to disabled.
 */

import { getEnvironmentMode } from '../utils/environmentUtils.js';

export const llmTimeoutConfig = {
  enabled: false,
  timeoutMs: 0,
  policy: 'autoAccept',
  waitActionHints: ['wait', 'idle'],
  environments: {
    test: {
      enabled: false,
    },
  },
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function normalizePolicy(policy) {
  const allowed = new Set(['autoAccept', 'autoWait', 'noop']);
  if (allowed.has(policy)) return policy;
  return 'autoAccept';
}

/**
 * Gets the timeout configuration for the current environment.
 *
 * @returns {{enabled: boolean, timeoutMs: number, policy: 'autoAccept'|'autoWait'|'noop', waitActionHints: string[]}} Sanitized configuration.
 */
export function getLLMTimeoutConfig() {
  const env = getEnvironmentMode();
  const merged = deepMerge(
    llmTimeoutConfig,
    llmTimeoutConfig.environments?.[env] || {}
  );

  const timeoutMs = Number(merged.timeoutMs);
  const enabled =
    merged.enabled === true && Number.isFinite(timeoutMs) && timeoutMs > 0;

  return {
    enabled,
    timeoutMs: enabled ? timeoutMs : 0,
    policy: normalizePolicy(merged.policy),
    waitActionHints: Array.isArray(merged.waitActionHints)
      ? merged.waitActionHints
      : [],
  };
}

export default llmTimeoutConfig;
