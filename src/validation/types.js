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
 * @property {number|null} column - Column number of violation (if available)
 * @property {string} context - Context of the reference
 * @property {string} message - Human-readable violation message
 * @property {string[]} declaredDependencies - Currently declared dependencies
 * @property {string} suggestedFix - Suggested resolution (legacy field)
 * @property {string} [contextSnippet] - Code snippet showing the violation context
 * @property {string} [contextType] - Type of context: 'action', 'rule', 'scope', 'component', etc.
 * @property {string} [severity] - Violation severity: 'critical', 'high', 'medium', 'low'
 * @property {ViolationImpact} [impact] - Analysis of potential impact
 * @property {FixSuggestion[]} [suggestedFixes] - Array of actionable fix suggestions
 * @property {ViolationMetadata} [metadata] - Additional metadata about the violation
 */

/**
 * @typedef {object} ViolationImpact
 * @property {string} loadingFailure - Risk of loading failure: 'high', 'medium', 'low'
 * @property {string} runtimeFailure - Risk of runtime failure: 'high', 'medium', 'low'
 * @property {string} dataInconsistency - Risk of data inconsistency: 'high', 'medium', 'low'
 * @property {string} userExperience - Impact on user experience: 'high', 'medium', 'low'
 */

/**
 * @typedef {object} FixSuggestion
 * @property {string} type - Type of fix: 'add_dependency', 'remove_reference', etc.
 * @property {string} priority - Fix priority: 'primary', 'alternative'
 * @property {string} description - Human-readable description of the fix
 * @property {FixImplementation} implementation - Implementation details for the fix
 * @property {string} effort - Effort required: 'low', 'medium', 'high'
 * @property {string} risk - Risk of applying fix: 'low', 'medium', 'high'
 */

/**
 * @typedef {object} FixImplementation
 * @property {string} file - File to modify
 * @property {string} action - Action to perform: 'add_to_dependencies_array', 'remove_line_or_replace', etc.
 * @property {number} [line] - Line number to modify (if applicable)
 * @property {any} [value] - Value to add/change (if applicable)
 */

/**
 * @typedef {object} ViolationMetadata
 * @property {string} extractionTimestamp - ISO timestamp when violation was detected
 * @property {string} validatorVersion - Version/name of the validator that detected this
 * @property {string} ruleApplied - Name of the validation rule that was applied
 */

/**
 * @typedef {object} ReferenceContext
 * @property {string} file - Relative path to the file containing the reference
 * @property {number} line - Line number (1-based) where reference appears
 * @property {number} column - Column number (1-based) where reference appears
 * @property {string} snippet - Code snippet showing the reference in context
 * @property {string} type - Context type: 'action', 'rule', 'scope', 'component', etc.
 * @property {boolean} isBlocking - Whether this reference represents a blocking operation
 * @property {boolean} isOptional - Whether this reference could be removed as an alternative fix
 * @property {boolean} isUserFacing - Whether this reference affects user-facing functionality
 */

/**
 * @typedef {object} ComponentWithContext
 * @property {string} componentId - The component ID being referenced
 * @property {ReferenceContext[]} contexts - Array of contexts where this component is referenced
 */

/**
 * @typedef {Map<string, ComponentWithContext[]>} ContextualReferenceMap
 * Map of mod ID to array of components with their usage contexts
 * Example: { "intimacy" => [{ componentId: "kissing", contexts: [...] }] }
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
