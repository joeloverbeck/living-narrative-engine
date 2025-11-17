function getEnvPreference() {
  if (typeof process === 'undefined') {
    return null;
  }

  const envValue =
    process.env?.SCOPE_DSL_ENTITY_LOOKUP_DEBUG ??
    process.env?.SCOPE_DSL_LOOKUP_DEBUG ??
    null;

  if (envValue === 'true') {
    return true;
  }
  if (envValue === 'false') {
    return false;
  }
  return null;
}

function defaultEnabledOutsideProduction() {
  if (typeof process === 'undefined') {
    return false;
  }

  const nodeEnv = process.env?.NODE_ENV || 'production';
  return nodeEnv !== 'production';
}

/**
 * Normalizes the runtime flag that enables ScopeDSL entity lookup debugging.
 *
 * The flag can be declared as:
 * - `true` to enable with defaults.
 * - An object with `{ enabled?: boolean, cacheEvents?: Function, strategyFactory?: Function }`.
 * - `false`/`null` to disable all debug instrumentation.
 * - Undefined/null uses environment defaults (enabled in non-production, overridable via env vars).
 *
 * @param {boolean|object|null|undefined} rawConfig - Value passed through the runtime context.
 * @returns {{enabled: boolean, cacheEvents?: Function, strategyFactory?: Function}|null}
 */
export function normalizeEntityLookupDebugConfig(rawConfig) {
  if (rawConfig === false || rawConfig === null) {
    return null;
  }

  if (rawConfig === true) {
    return { enabled: true };
  }

  if (typeof rawConfig === 'object') {
    if (rawConfig.enabled === false) {
      return null;
    }

    return {
      ...rawConfig,
      enabled: rawConfig.enabled !== false,
    };
  }

  const envPreference = getEnvPreference();
  if (envPreference !== null) {
    return envPreference ? { enabled: true } : null;
  }

  return defaultEnabledOutsideProduction() ? { enabled: true } : null;
}

export default normalizeEntityLookupDebugConfig;
