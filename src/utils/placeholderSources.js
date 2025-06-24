/**
 * @module placeholderSources
 * @description Functions for assembling placeholder resolution sources.
 */

import { resolveEntityNameFallback } from './entityNameFallbackUtils.js';

/**
 * Builds the data sources for placeholder resolution.
 *
 * @param {object} executionContext - Execution context supplying actor, target,
 *   and evaluationContext data.
 * @returns {{sources: object[], fallback: object}} Sources array and fallback
 *   object for use with PlaceholderResolver.
 */
export function buildResolutionSources(executionContext) {
  const contextSource = {
    context:
      executionContext?.evaluationContext?.context &&
      typeof executionContext.evaluationContext.context === 'object'
        ? executionContext.evaluationContext.context
        : {},
  };

  const fallback = {};
  const actorName = resolveEntityNameFallback('actor.name', executionContext);
  if (actorName !== undefined) {
    fallback.actor = { name: actorName };
  }
  const targetName = resolveEntityNameFallback('target.name', executionContext);
  if (targetName !== undefined) {
    if (!fallback.target) fallback.target = {};
    fallback.target.name = targetName;
  }

  const baseSource = { ...(executionContext ?? {}) };
  delete baseSource.context;
  const rootContextSource =
    executionContext &&
    Object.prototype.hasOwnProperty.call(executionContext, 'context')
      ? { context: executionContext.context }
      : {};
  const sources = [rootContextSource, baseSource, contextSource];

  return { sources, fallback };
}
