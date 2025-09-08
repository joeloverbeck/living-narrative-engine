# MODDEPVAL-001: Implement ModReferenceExtractor Core Class

## Overview

Create the core `ModReferenceExtractor` class that serves as the foundation for extracting mod references from various file types in the Living Narrative Engine mod system. This class will integrate with the existing validation infrastructure and follow established project patterns.

## Background

The positioning mod currently violates architectural principles by referencing `intimacy:kissing` component without declaring `intimacy` as a dependency. This ticket implements the foundational reference extraction system to detect such violations.

**Current violation example:**
```json
// data/mods/positioning/actions/turn_around.action.json
"forbidden_components": {
  "actor": ["intimacy:kissing"]  // ← Undeclared dependency
}
```

## Technical Specifications

### File Location
- **Primary**: `src/validation/modReferenceExtractor.js`
- **Tests**: `tests/unit/validation/modReferenceExtractor.test.js`
- **Integration**: Follow patterns from `src/validation/ajvSchemaValidator.js`

### Class Architecture

```javascript
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
  #ajvValidator;
  
  /**
   * @param {Object} dependencies
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger
   * @param {import('./ajvSchemaValidator.js')} dependencies.ajvValidator
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
      await this.#scanDirectory(modPath, references);
      
      this.#logger.info(`Extracted references for mod '${modId}': ${Array.from(references.keys()).join(', ')}`);
      return references;
      
    } catch (error) {
      this.#logger.error(`Failed to extract references from ${modPath}`, error);
      throw error;
    }
  }

  /**
   * Recursively scans directory for mod files and extracts references
   * @private
   * @param {string} dirPath - Directory to scan
   * @param {ModReferenceMap} references - Reference map to populate
   */
  async #scanDirectory(dirPath, references) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.#scanDirectory(fullPath, references);
      } else if (entry.isFile()) {
        await this.#extractFromFile(fullPath, references);
      }
    }
  }

  /**
   * Extracts references from a single file based on file type
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
   * @private
   * @param {string} filePath - Scope file path  
   * @param {ModReferenceMap} references - Reference map to populate
   */
  async #extractFromScopeFile(filePath, references) {
    // Implementation placeholder - will be completed in MODDEPVAL-003
    this.#logger.debug(`Scope file processing not yet implemented: ${filePath}`);
  }

  /**
   * Recursively extracts mod references from object/array structures
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
   * @private
   * @param {string} str - String to analyze
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractModReferencesFromString(str, references) {
    // Pattern: modId:componentId (but not core:* or none/self)
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
```

### Type Definitions

**Step: Create Type Definitions File**

First, create `src/validation/types.js` for shared type definitions:

```javascript
/**
 * @typedef {Map<string, Set<string>>} ModReferenceMap
 * Map of mod ID to set of referenced component IDs
 * Example: { "intimacy" => Set(["kissing", "hugging"]), "core" => Set(["actor"]) }
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {string} modId - ID of the mod that was analyzed
 * @property {ModReferenceMap} references - Map of referenced mods to components
 * @property {string[]} errors - Any errors encountered during extraction
 * @property {number} filesProcessed - Number of files successfully processed
 */
```

## Integration Points

### Existing Infrastructure Usage
- **Logger**: Use dependency injection pattern from `ajvSchemaValidator.js`
- **Validation**: Leverage `validateDependency` and validation core utilities
- **Error Handling**: Follow patterns from `modDependencyValidator.js`
- **File System**: Use async/await patterns consistent with `updateManifest.js`

### Dependencies
- `src/utils/dependencyUtils.js` - Validation helpers
- `src/utils/validationCore.js` - Core validation functions  
- `src/utils/loggerUtils.js` - Logger interface
- `src/validation/ajvSchemaValidator.js` - Schema validation patterns

## Testing Requirements

### Unit Tests Structure
```javascript
// tests/unit/validation/modReferenceExtractor.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../src/validation/modReferenceExtractor.js';

describe('ModReferenceExtractor - Core Functionality', () => {
  let testBed;
  let extractor;

  beforeEach(() => {
    testBed = createTestBed();
    const mockLogger = testBed.createMockLogger();
    const mockAjvValidator = testBed.createMock('ajvValidator', ['validate']);
    
    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test cases defined in MODDEPVAL-004
});
```

### Test Coverage Requirements
- **Constructor validation**: Invalid dependencies
- **File scanning**: Directory traversal, file filtering
- **Reference extraction**: String pattern matching
- **Error handling**: Malformed JSON, inaccessible files
- **Edge cases**: Empty directories, non-existent paths
- **Performance**: Large directory structures

## Success Criteria

- [ ] `ModReferenceExtractor` class created with full dependency injection
- [ ] Core directory scanning functionality implemented
- [ ] JSON file processing (basic pattern matching) working
- [ ] Integration with existing validation infrastructure complete
- [ ] Unit tests achieve >90% code coverage
- [ ] Follows project naming conventions and patterns
- [ ] Error handling consistent with existing validators
- [ ] Performance acceptable for large mod directories (<1 second)

## Runtime Environment Clarification

**IMPORTANT DECISION REQUIRED**: This workflow assumes Node.js filesystem operations for file processing. Before implementation, clarify:

1. **Build-time Tool**: If this is meant to run during build/validation processes, keep Node.js approach
2. **Runtime Component**: If this needs to work in browser, replace filesystem operations with:
   - `fetch()` calls for loading files
   - Preloaded data structures from build process
   - Browser-compatible path operations

The current implementation is designed for **build-time validation** but can be adapted for browser runtime if needed.

## Implementation Notes

### Phase 1 Scope Limitations
- **JSON processing only**: Scope DSL processing deferred to MODDEPVAL-003
- **Basic pattern matching**: Advanced JSON Logic traversal in MODDEPVAL-002
- **Core architecture focus**: Extensible design for future enhancements

### Performance Considerations
- Use async file operations for non-blocking I/O
- Process files concurrently where possible
- Implement early termination for large directories if needed
- Cache regex patterns for repeated use

### Security Measures
- Validate all file paths to prevent directory traversal
- Limit file sizes to prevent memory exhaustion
- Use safe JSON parsing with error handling
- Sanitize all logged file paths

## Next Steps

After completion:
1. **MODDEPVAL-002**: Enhance JSON file processing for complex structures
2. **MODDEPVAL-003**: Add Scope DSL file parsing support
3. **MODDEPVAL-004**: Create comprehensive test suite

## References

- **Report**: `reports/mod-dependency-validation-implementation.md`
- **Example violation**: `data/mods/positioning/actions/turn_around.action.json:17`
- **Existing patterns**: `src/validation/ajvSchemaValidator.js`
- **Dependency validation**: `src/modding/modDependencyValidator.js`