/**
 * @file AnalysisScopeMetadata - Scope metadata types and constants for Monte Carlo reports
 * @description Defines the foundational data model for labeling analysis sections with their
 * scope, population, and signal type. Used to disambiguate prototype fit (axis-only) from
 * blockers (full-prereqs) analysis in expression diagnostics reports.
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 */

/**
 * Analysis scope indicating which subset of prerequisites is evaluated.
 *
 * @typedef {'axis_only' | 'full_prereqs' | 'non_axis_subset'} AnalysisScope
 */

/**
 * Population type indicating the sample set being analyzed.
 *
 * @typedef {'global' | 'in_regime'} PopulationType
 */

/**
 * Signal type indicating which value stage is being evaluated.
 *
 * @typedef {'raw' | 'final' | 'delta'} SignalType
 */

/**
 * @typedef {object} AnalysisScopeMetadataEntry
 * @property {AnalysisScope} scope - Which subset of prerequisites is evaluated.
 * @property {PopulationType} population - The sample population being analyzed.
 * @property {SignalType} signal - Which value stage (raw, final, delta) is evaluated.
 * @property {string} description - Human-readable explanation of what this scope represents.
 */

/**
 * Frozen metadata entries for each analysis scope type used in Monte Carlo reports.
 * Each entry defines what data subset is analyzed and what it means.
 *
 * @type {Readonly<{
 *   PROTOTYPE_FIT: Readonly<AnalysisScopeMetadataEntry>,
 *   BLOCKER_GLOBAL: Readonly<AnalysisScopeMetadataEntry>,
 *   BLOCKER_IN_REGIME: Readonly<AnalysisScopeMetadataEntry>,
 *   NON_AXIS_FEASIBILITY: Readonly<AnalysisScopeMetadataEntry>
 * }>}
 */
export const SCOPE_METADATA = Object.freeze({
  PROTOTYPE_FIT: Object.freeze({
    scope: 'axis_only',
    population: 'in_regime',
    signal: 'raw',
    description:
      'Computed from mood-regime axis constraints only (emotion clauses not enforced).',
  }),
  BLOCKER_GLOBAL: Object.freeze({
    scope: 'full_prereqs',
    population: 'global',
    signal: 'final',
    description:
      'Computed from ALL prerequisites using post-gate (final) values.',
  }),
  BLOCKER_IN_REGIME: Object.freeze({
    scope: 'full_prereqs',
    population: 'in_regime',
    signal: 'final',
    description:
      'Computed from ALL prerequisites, restricted to mood-regime samples.',
  }),
  NON_AXIS_FEASIBILITY: Object.freeze({
    scope: 'non_axis_subset',
    population: 'in_regime',
    signal: 'final',
    description:
      'Evaluates emotion/sexual/delta clauses within mood-regime using final values.',
  }),
});
