/**
 * @file Section generator exports for Monte Carlo reports
 *
 * This barrel exports all section generator classes used by
 * MonteCarloReportGenerator to produce report sections.
 */

// Section generators will be added as they are extracted:
export { default as PrototypeSectionGenerator } from './PrototypeSectionGenerator.js';
export { default as SensitivitySectionGenerator } from './SensitivitySectionGenerator.js';
export { default as BlockerSectionGenerator } from './BlockerSectionGenerator.js';
export { default as CoreSectionGenerator } from './CoreSectionGenerator.js';
export { default as ConflictWarningSectionGenerator } from './ConflictWarningSectionGenerator.js';
export { default as NonAxisFeasibilitySectionGenerator } from './NonAxisFeasibilitySectionGenerator.js';

// Placeholder export until generators are added.
export const SECTION_GENERATORS_VERSION = '1.0.0';
