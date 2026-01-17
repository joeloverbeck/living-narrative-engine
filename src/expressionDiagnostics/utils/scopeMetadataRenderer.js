/**
 * @file Scope metadata renderer utility for Monte Carlo report sections
 * @description Renders scope metadata as markdown header badges for report sections.
 * Provides visual disambiguation between different analysis scopes (axis-only vs full-prereqs).
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 */

/**
 * @typedef {import('../models/AnalysisScopeMetadata.js').AnalysisScopeMetadataEntry} AnalysisScopeMetadataEntry
 */

/**
 * Maps scope type to human-readable badge text.
 *
 * @param {string} scope - The scope value from metadata.
 * @returns {string} Uppercase badge text.
 */
function getScopeBadge(scope) {
  switch (scope) {
    case 'axis_only':
      return 'AXIS-ONLY FIT';
    case 'full_prereqs':
      return 'FULL PREREQS';
    case 'non_axis_subset':
      return 'NON-AXIS ONLY';
    default:
      return scope.toUpperCase();
  }
}

/**
 * Maps population type to human-readable badge text.
 *
 * @param {string} population - The population value from metadata.
 * @returns {string} Uppercase badge text.
 */
function getPopulationBadge(population) {
  switch (population) {
    case 'in_regime':
      return 'IN-REGIME';
    case 'global':
      return 'GLOBAL';
    default:
      return population.toUpperCase();
  }
}

/**
 * Render scope metadata as markdown header with badges.
 *
 * Output format:
 * ```
 * > **[SCOPE-BADGE]** **[POPULATION-BADGE]**
 * > *description*
 *
 * ```
 *
 * @param {AnalysisScopeMetadataEntry} metadata - The scope metadata to render.
 * @returns {string} Markdown blockquote header with scope and population badges.
 */
export function renderScopeMetadataHeader(metadata) {
  const scopeBadge = getScopeBadge(metadata.scope);
  const populationBadge = getPopulationBadge(metadata.population);

  return [
    `> **[${scopeBadge}]** **[${populationBadge}]**`,
    `> *${metadata.description}*`,
    '',
  ].join('\n');
}
