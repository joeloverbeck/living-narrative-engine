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

export {};