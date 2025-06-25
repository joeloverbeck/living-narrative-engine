/**
 * @module wrapperUtils
 * @description Utilities for resolving prefix/suffix wrappers in prompt elements.
 */

/**
 * Resolves the prefix and suffix strings using the provided resolver and context.
 *
 * @param {{prefix?: string, suffix?: string}|null|undefined} wrappers - Raw prefix/suffix.
 * @param {import('./placeholderResolverUtils.js').PlaceholderResolver} resolver - Placeholder resolver.
 * @param {object} context - Context for resolution.
 * @returns {{ prefix: string, suffix: string }} Resolved prefix & suffix.
 */
export function resolveWrapper(wrappers, resolver, context) {
  const { prefix = '', suffix = '' } = wrappers || {};
  return {
    prefix: resolver.resolve(prefix, context),
    suffix: resolver.resolve(suffix, context),
  };
}
