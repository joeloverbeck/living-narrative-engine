/**
 * @module wrapperUtils
 * @description Utilities for resolving prefix/suffix wrappers in prompt elements.
 */

/**
 * Resolves the prefix and suffix strings using the provided resolver and context.
 *
 * @param {{prefix?: string, suffix?: string}} wrappers - Raw prefix/suffix.
 * @param {import('./placeholderResolverUtils.js').PlaceholderResolver} resolver - Placeholder resolver.
 * @param {object} ctx - Context for resolution.
 * @returns {{ prefix: string, suffix: string }} Resolved prefix & suffix.
 */
export function resolveWrapper({ prefix = '', suffix = '' }, resolver, ctx) {
  return {
    prefix: resolver.resolve(prefix, ctx),
    suffix: resolver.resolve(suffix, ctx),
  };
}
