/**
 * @file Extracts mod references from various file types to detect undeclared dependencies
 * @see src/validation/ajvSchemaValidator.js - Similar validation infrastructure pattern
 * @see src/modding/modDependencyValidator.js - Existing dependency validation
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { string } from '../utils/validationCore.js';
// Runtime Environment Note: This implementation assumes Node.js environment with filesystem access
// If intended for browser runtime, replace fs/path imports with fetch-based approaches
import path from 'path';
import fs from 'fs/promises';

/** @typedef {import('./types.js').ModReferenceMap} ModReferenceMap */
/** @typedef {import('./types.js').ExtractionResult} ExtractionResult */

/**
 * Extracts mod references from various file types to identify cross-mod dependencies
 * Integrates with existing validation infrastructure for consistent error handling
 */
class ModReferenceExtractor {
  #logger;
  // eslint-disable-next-line no-unused-private-class-members
  #ajvValidator; // Reserved for future schema validation in MODDEPVAL-002
  
  /**
   * Creates a new ModReferenceExtractor instance
   *
   * @param {object} dependencies - Dependencies for the extractor
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger - Logger instance for debug/info/warn/error logging
   * @param {import('./ajvSchemaValidator.js')} dependencies.ajvValidator - AJV validator instance for schema validation
   */
  constructor({ logger, ajvValidator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(ajvValidator, 'IAjvValidator', logger, {
      requiredMethods: ['validate'],
    });
    
    this.#logger = logger;
    this.#ajvValidator = ajvValidator;
  }

  /**
   * Extracts all mod references from a given mod directory
   *
   * @param {string} modPath - Absolute path to mod directory
   * @returns {Promise<ModReferenceMap>} Map of referenced mod IDs to component sets
   * @throws {Error} If modPath is invalid or inaccessible
   */
  async extractReferences(modPath) {
    string.assertNonBlank(modPath, 'modPath', 'ModReferenceExtractor.extractReferences', this.#logger);
    
    try {
      const modId = path.basename(modPath);
      this.#logger.debug(`Starting reference extraction for mod: ${modId}`);
      
      const references = new Map();
      await this.#scanDirectory(modPath, references, modId);
      
      // Remove self-references (references to the mod being analyzed)
      references.delete(modId);
      
      this.#logger.info(`Extracted references for mod '${modId}': ${Array.from(references.keys()).join(', ')}`);
      return references;
      
    } catch (error) {
      this.#logger.error(`Failed to extract references from ${modPath}`, error);
      throw error;
    }
  }

  /**
   * Recursively scans directory for mod files and extracts references
   *
   * @private
   * @param {string} dirPath - Directory to scan
   * @param {ModReferenceMap} references - Reference map to populate
   * @param {string} modId - ID of the mod being analyzed (for filtering self-references)
   */
  async #scanDirectory(dirPath, references, modId) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.#scanDirectory(fullPath, references, modId);
      } else if (entry.isFile()) {
        await this.#extractFromFile(fullPath, references);
      }
    }
  }

  /**
   * Extracts references from a single file based on file type
   *
   * @private
   * @param {string} filePath - File to process
   * @param {ModReferenceMap} references - Reference map to populate
   */
  async #extractFromFile(filePath, references) {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);
    
    try {
      switch (ext) {
        case '.json':
          await this.#extractFromJsonFile(filePath, references);
          break;
        case '.scope':
          await this.#extractFromScopeFile(filePath, references);
          break;
        default:
          // Skip non-relevant file types
          this.#logger.debug(`Skipping file with unsupported extension: ${filePath}`);
          break;
      }
    } catch (error) {
      this.#logger.warn(`Failed to process file ${basename}: ${error.message}`);
      // Continue processing other files rather than failing completely
    }
  }

  /**
   * Extracts references from JSON files (actions, rules, conditions, components, events)
   *
   * @private
   * @param {string} filePath - JSON file path
   * @param {ModReferenceMap} references - Reference map to populate
   */
  async #extractFromJsonFile(filePath, references) {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    const fileType = this.#detectJsonFileType(filePath);
    const extractedRefs = this.#extractReferencesFromObject(data, fileType);
    
    // Merge extracted references into main map
    for (const [modId, components] of extractedRefs) {
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      for (const component of components) {
        references.get(modId).add(component);
      }
    }
  }

  /**
   * Extracts references from Scope DSL files (.scope)
   *
   * @private
   * @param {string} filePath - Scope file path  
   * @param {ModReferenceMap} _references - Reference map to populate (unused in placeholder)
   */
  async #extractFromScopeFile(filePath, _references) {
    // Implementation placeholder - will be completed in MODDEPVAL-003
    this.#logger.debug(`Scope file processing not yet implemented: ${filePath}`);
  }

  /**
   * Recursively extracts mod references from object/array structures
   *
   * @private
   * @param {any} obj - Object to scan
   * @param {string} fileType - Type of file being processed
   * @returns {ModReferenceMap} Extracted references
   */
  #extractReferencesFromObject(obj, fileType) {
    const references = new Map();
    this.#traverseObject(obj, '', references, fileType);
    return references;
  }

  /**
   * Deep traversal of object structures to find mod reference patterns
   *
   * @private
   * @param {any} obj - Current object/value
   * @param {string} path - Current object path for context
   * @param {ModReferenceMap} references - Reference map to populate
   * @param {string} fileType - Type of file being processed
   */
  #traverseObject(obj, path, references, fileType) {
    if (typeof obj === 'string') {
      this.#extractModReferencesFromString(obj, references);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.#traverseObject(item, `${path}[${index}]`, references, fileType);
      });
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        this.#traverseObject(value, `${path}.${key}`, references, fileType);
      }
    }
  }

  /**
   * Extracts mod references from string values using pattern matching
   *
   * @private
   * @param {string} str - String to analyze
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractModReferencesFromString(str, references) {
    // Pattern: modId:componentId (but not core:* or none/self)
    // Match valid mod:component pairs with word boundaries to avoid matching parts of larger identifiers
    const MOD_REFERENCE_PATTERN = /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\b/g;
    
    let match;
    while ((match = MOD_REFERENCE_PATTERN.exec(str)) !== null) {
      const [, modId, componentId] = match;
      
      // Skip core references (always valid) and special cases
      if (modId === 'core' || modId === 'none' || modId === 'self') {
        continue;
      }
      
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      references.get(modId).add(componentId);
    }
  }

  /**
   * Determines JSON file type based on filename patterns
   *
   * @private
   * @param {string} filePath - File path to analyze
   * @returns {string} File type identifier
   */
  #detectJsonFileType(filePath) {
    const basename = path.basename(filePath);
    
    if (basename.endsWith('.action.json')) return 'action';
    if (basename.endsWith('.rule.json')) return 'rule';  
    if (basename.endsWith('.condition.json')) return 'condition';
    if (basename.endsWith('.component.json')) return 'component';
    if (basename.endsWith('.event.json')) return 'event';
    if (basename.endsWith('.blueprint.json')) return 'blueprint';
    if (basename.endsWith('.recipe.json')) return 'recipe';
    
    return 'unknown';
  }
}

export default ModReferenceExtractor;