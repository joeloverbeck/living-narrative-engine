/**
 * @file Helper utilities for tracing scope resolution in tests
 * @description Integrates scope resolution debugging with existing TraceContext infrastructure
 */

import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

/**
 * Create a traced wrapper around a scope resolver that captures evaluation details.
 *
 * @param {object} scopeResolver - The scope resolver to instrument
 * @param {TraceContext} traceContext - Trace context to capture evaluations
 * @returns {object} Instrumented scope resolver
 */
export function createTracedScopeResolver(scopeResolver, traceContext) {
  // Store original resolve method
  const originalResolve = scopeResolver.resolve.bind(scopeResolver);

  // Create instrumented resolver
  return {
    ...scopeResolver,

    resolve(scopeId, context) {
      // Capture start of resolution
      traceContext.step(`Resolving scope: ${scopeId}`, 'ScopeTracer');

      try {
        // Call original resolver
        const result = originalResolve(scopeId, context);

        // Capture successful resolution
        traceContext.captureScopeEvaluation({
          scopeId,
          actorId: context.actor?.id,
          candidateEntities: context.candidates || [],
          resolvedEntities: result || [],
          success: true,
          context: {
            actorId: context.actor?.id,
            hasFilters: context.filters?.length > 0,
          },
        });

        traceContext.success(
          `Resolved ${result?.length || 0} entities for scope '${scopeId}'`,
          'ScopeTracer',
          { resolvedEntities: result }
        );

        return result;
      } catch (error) {
        // Capture failed resolution
        traceContext.captureScopeEvaluation({
          scopeId,
          actorId: context.actor?.id,
          success: false,
          error: error.message,
          context,
        });

        traceContext.error(
          `Scope resolution failed for '${scopeId}': ${error.message}`,
          'ScopeTracer',
          { error }
        );

        throw error;
      }
    },
  };
}

/**
 * Format scope evaluation results into a readable summary.
 *
 * @param {TraceContext} traceContext - Trace context containing scope evaluations
 * @returns {string} Formatted summary
 */
export function formatScopeEvaluationSummary(traceContext) {
  const scopeEvaluations = traceContext.getScopeEvaluations();

  if (scopeEvaluations.length === 0) {
    return 'No scope evaluations captured';
  }

  const lines = ['', '=== Scope Evaluation Summary ===', ''];

  for (const evaluation of scopeEvaluations) {
    lines.push(`Scope: ${evaluation.scopeId}`);
    lines.push(`  Actor: ${evaluation.actorId || 'unknown'}`);

    if (evaluation.success) {
      const candidateCount = evaluation.candidateEntities?.length || 0;
      const resolvedCount = evaluation.resolvedEntities?.length || 0;
      const filteredCount = candidateCount - resolvedCount;

      lines.push(`  Candidates: ${candidateCount}`);
      lines.push(`  Resolved: ${resolvedCount}`);

      if (filteredCount > 0) {
        lines.push(`  Filtered out: ${filteredCount}`);
      }

      if (resolvedCount > 0) {
        lines.push(
          `  Resolved entities: ${evaluation.resolvedEntities.join(', ')}`
        );
      }
    } else {
      lines.push(`  ❌ Failed: ${evaluation.error}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Helper to trace scope resolution for a single scope evaluation.
 *
 * @param {object} options - Configuration options
 * @param {string} options.scopeId - Scope to evaluate
 * @param {object} options.actor - Actor entity
 * @param {object} options.scopeResolver - Scope resolver instance
 * @param {object} [options.context] - Additional context
 * @returns {object} Evaluation result with trace
 */
export function traceScopeEvaluation({
  scopeId,
  actor,
  scopeResolver,
  context = {},
}) {
  const traceContext = new TraceContext();
  const tracedResolver = createTracedScopeResolver(scopeResolver, traceContext);

  try {
    const result = tracedResolver.resolve(scopeId, {
      actor,
      ...context,
    });

    return {
      success: true,
      resolvedEntities: result,
      trace: traceContext,
      summary: formatScopeEvaluationSummary(traceContext),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      trace: traceContext,
      summary: formatScopeEvaluationSummary(traceContext),
    };
  }
}

export default {
  createTracedScopeResolver,
  formatScopeEvaluationSummary,
  traceScopeEvaluation,
};
