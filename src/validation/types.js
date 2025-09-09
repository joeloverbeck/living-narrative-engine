/**
 * @file Type definitions for validation system
 * @description Shared type definitions used across the validation infrastructure
 */

/**
 * @typedef {Map<string, Set<string>>} ModReferenceMap
 * Map of mod ID to set of referenced component IDs
 * Example: { "intimacy" => Set(["kissing", "hugging"]), "core" => Set(["actor"]) }
 */

/**
 * @typedef {object} ExtractionResult
 * @property {string} modId - ID of the mod that was analyzed
 * @property {ModReferenceMap} references - Map of referenced mods to components
 * @property {string[]} errors - Any errors encountered during extraction
 * @property {number} filesProcessed - Number of files successfully processed
 */

/**
 * @typedef {object} CrossReferenceViolation
 * @property {string} violatingMod - ID of mod with the violation
 * @property {string} referencedMod - ID of mod being referenced
 * @property {string} referencedComponent - Component being referenced
 * @property {string} file - File containing the violation
 * @property {number|null} line - Line number of violation (if available)
 * @property {string} context - Context of the reference
 * @property {string} message - Human-readable violation message
 * @property {string[]} declaredDependencies - Currently declared dependencies
 * @property {string} suggestedFix - Suggested resolution
 */

/**
 * @typedef {object} ValidationReport
 * @property {string} modId - ID of validated mod
 * @property {boolean} hasViolations - Whether violations were found
 * @property {CrossReferenceViolation[]} violations - List of violations
 * @property {string[]} declaredDependencies - Declared dependencies
 * @property {string[]} referencedMods - All referenced mods
 * @property {string[]} missingDependencies - Mods referenced but not declared
 * @property {object} summary - Summary statistics
 * @property {number} summary.totalReferences - Total component references
 * @property {number} summary.uniqueModsReferenced - Number of unique mods referenced
 * @property {number} summary.violationCount - Number of violations
 * @property {number} summary.missingDependencyCount - Number of missing dependencies
 */

export {};