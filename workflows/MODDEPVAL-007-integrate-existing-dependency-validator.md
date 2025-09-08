# MODDEPVAL-007: Integrate with Existing ModDependencyValidator Infrastructure

## Overview

Complete the integration of the `ModCrossReferenceValidator` with the existing `ModDependencyValidator` infrastructure to create a unified validation system. This ensures consistent behavior, shared error handling, and seamless operation within the current mod loading pipeline.

## Background

The Living Narrative Engine has sophisticated dependency validation infrastructure that needs to work harmoniously with the new cross-reference validation. This integration ensures:

- **Consistent validation flow**: Cross-reference validation runs after dependency validation
- **Shared error handling**: Unified error reporting and recovery patterns  
- **Performance optimization**: Leverage existing caching and optimization
- **Pipeline integration**: Seamless integration with mod loading workflow

**Existing infrastructure to integrate with:**
- `src/modding/modDependencyValidator.js` - Core dependency validation
- `src/modding/modLoadOrderResolver.js` - Topological dependency sorting
- `src/modding/modManifestLoader.js` - Manifest loading and caching
- `src/errors/modDependencyError.js` - Established error patterns

## Technical Specifications

### Unified Validation Orchestrator

```javascript
/**
 * @file Orchestrates all mod validation including dependencies and cross-references
 * @see src/modding/modDependencyValidator.js - Existing dependency validation
 * @see src/modding/modLoadOrderResolver.js - Load order resolution
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ModDependencyError } from '../errors/modDependencyError.js';

/**
 * Comprehensive mod validation error that aggregates multiple validation failures
 */
class ModValidationError extends ModDependencyError {
  constructor(validationResults) {
    const messages = [];
    
    if (validationResults.dependencies && !validationResults.dependencies.isValid) {
      messages.push(`Dependency validation failed: ${validationResults.dependencies.errors.length} errors`);
    }
    
    if (validationResults.crossReferences && validationResults.crossReferences.hasViolations) {
      const violationCount = validationResults.crossReferences instanceof Map
        ? Array.from(validationResults.crossReferences.values()).reduce((sum, r) => sum + r.violations.length, 0)
        : validationResults.crossReferences.violations.length;
      messages.push(`Cross-reference validation failed: ${violationCount} violations`);
    }
    
    super(`Mod ecosystem validation failed:\n${messages.join('\n')}`);
    this.name = 'ModValidationError';
    this.validationResults = validationResults;
  }
}

/**
 * Orchestrates comprehensive mod validation including dependencies and cross-references
 * Integrates seamlessly with existing mod loading infrastructure
 */
class ModValidationOrchestrator {
  #logger;
  #modDependencyValidator;
  #modCrossReferenceValidator;
  #modLoadOrderResolver;
  #modManifestLoader;
  
  /**
   * @param {Object} dependencies
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger
   * @param {import('../modding/modDependencyValidator.js')} dependencies.modDependencyValidator
   * @param {import('../validation/modCrossReferenceValidator.js')} dependencies.modCrossReferenceValidator
   * @param {import('../modding/modLoadOrderResolver.js')} dependencies.modLoadOrderResolver
   * @param {import('../modding/modManifestLoader.js')} dependencies.modManifestLoader
   */
  constructor({ 
    logger, 
    modDependencyValidator, 
    modCrossReferenceValidator, 
    modLoadOrderResolver,
    modManifestLoader
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(modDependencyValidator, 'IModDependencyValidator', logger, {
      requiredMethods: ['validateDependencies', 'resolveDependencies'],
    });
    validateDependency(modCrossReferenceValidator, 'IModCrossReferenceValidator', logger, {
      requiredMethods: ['validateModReferences', 'validateAllModReferences'],
    });
    validateDependency(modLoadOrderResolver, 'IModLoadOrderResolver', logger, {
      requiredMethods: ['resolveLoadOrder'],
    });
    validateDependency(modManifestLoader, 'IModManifestLoader', logger, {
      requiredMethods: ['loadAllManifests', 'loadManifest'],
    });
    
    this.#logger = logger;
    this.#modDependencyValidator = modDependencyValidator;
    this.#modCrossReferenceValidator = modCrossReferenceValidator;
    this.#modLoadOrderResolver = modLoadOrderResolver;
    this.#modManifestLoader = modManifestLoader;
  }

  /**
   * Performs comprehensive validation of the entire mod ecosystem
   * @param {Object} options - Validation options
   * @param {boolean} options.skipCrossReferences - Skip cross-reference validation
   * @param {boolean} options.failFast - Stop on first validation failure
   * @param {string[]} options.modsToValidate - Specific mods to validate (default: all)
   * @returns {Promise<ModEcosystemValidationResult>} Complete validation results
   */
  async validateEcosystem(options = {}) {
    const { 
      skipCrossReferences = false, 
      failFast = false, 
      modsToValidate = null 
    } = options;
    
    this.#logger.info('Starting comprehensive mod ecosystem validation');
    
    const startTime = performance.now();
    const results = {
      dependencies: null,
      crossReferences: null,
      loadOrder: null,
      performance: {
        startTime,
        phases: new Map()
      },
      isValid: false,
      errors: [],
      warnings: []
    };
    
    try {
      // Phase 1: Load and validate manifests
      const manifestsMap = await this.#loadAndValidateManifests(modsToValidate);
      results.performance.phases.set('manifest-loading', performance.now() - startTime);
      
      // Phase 2: Dependency validation (prerequisite for cross-reference validation)
      this.#logger.info('Phase 2: Validating mod dependencies');
      const depStartTime = performance.now();
      
      results.dependencies = await this.#modDependencyValidator.validateDependencies(manifestsMap);
      results.performance.phases.set('dependency-validation', performance.now() - depStartTime);
      
      if (!results.dependencies.isValid) {
        this.#logger.error('Dependency validation failed - cannot proceed with cross-reference validation');
        if (failFast) {
          throw new ModValidationError(results);
        }
        results.errors.push('Dependency validation failed');
      }
      
      // Phase 3: Load order resolution (uses dependency validation results)
      if (results.dependencies.isValid) {
        this.#logger.info('Phase 3: Resolving mod load order');
        const loadOrderStartTime = performance.now();
        
        try {
          results.loadOrder = await this.#modLoadOrderResolver.resolveLoadOrder(manifestsMap);
          results.performance.phases.set('load-order-resolution', performance.now() - loadOrderStartTime);
        } catch (error) {
          this.#logger.warn('Load order resolution failed', error);
          results.warnings.push(`Load order resolution failed: ${error.message}`);
        }
      }
      
      // Phase 4: Cross-reference validation (depends on valid dependencies)
      if (!skipCrossReferences && results.dependencies.isValid) {
        this.#logger.info('Phase 4: Validating cross-mod references');
        const crossRefStartTime = performance.now();
        
        try {
          results.crossReferences = await this.#modCrossReferenceValidator.validateAllModReferences(manifestsMap);
          results.performance.phases.set('cross-reference-validation', performance.now() - crossRefStartTime);
          
          const hasViolations = Array.from(results.crossReferences.values()).some(r => r.hasViolations);
          if (hasViolations) {
            const totalViolations = Array.from(results.crossReferences.values())
              .reduce((sum, r) => sum + r.violations.length, 0);
            this.#logger.warn(`Cross-reference validation found ${totalViolations} violations`);
            
            if (failFast) {
              throw new ModValidationError(results);
            }
            results.warnings.push(`Cross-reference validation found ${totalViolations} violations`);
          }
        } catch (error) {
          this.#logger.error('Cross-reference validation failed', error);
          results.errors.push(`Cross-reference validation failed: ${error.message}`);
        }
      } else if (skipCrossReferences) {
        this.#logger.info('Phase 4: Cross-reference validation skipped');
      }
      
      // Determine overall validation status
      results.isValid = results.dependencies?.isValid && 
                       results.errors.length === 0 && 
                       (!results.crossReferences || 
                        !Array.from(results.crossReferences.values()).some(r => r.hasViolations));
      
      const totalTime = performance.now() - startTime;
      results.performance.totalTime = totalTime;
      
      this.#logger.info(`Ecosystem validation complete: ${results.isValid ? 'PASSED' : 'FAILED'} (${totalTime.toFixed(2)}ms)`);
      
      return results;
      
    } catch (error) {
      const totalTime = performance.now() - startTime;
      results.performance.totalTime = totalTime;
      results.errors.push(error.message);
      
      this.#logger.error('Ecosystem validation failed', error);
      throw error;
    }
  }

  /**
   * Validates a specific mod with integrated validation pipeline
   * @param {string} modId - Mod identifier to validate
   * @param {Object} options - Validation options
   * @returns {Promise<ModValidationResult>} Single mod validation results
   */
  async validateMod(modId, options = {}) {
    const { skipCrossReferences = false, includeContext = true } = options;
    
    this.#logger.info(`Starting validation for mod: ${modId}`);
    
    try {
      // Load full ecosystem for context (needed for dependency resolution)
      const manifestsMap = await this.#modManifestLoader.loadAllManifests();
      
      if (!manifestsMap.has(modId)) {
        throw new Error(`Mod '${modId}' not found in ecosystem`);
      }
      
      const results = {
        modId,
        dependencies: null,
        crossReferences: null,
        isValid: false,
        errors: [],
        warnings: []
      };
      
      // Validate dependencies for this mod
      const modManifest = manifestsMap.get(modId);
      results.dependencies = await this.#validateModDependencies(modId, modManifest, manifestsMap);
      
      if (!results.dependencies.isValid) {
        results.errors.push('Dependency validation failed');
        if (!includeContext) {
          return results;
        }
      }
      
      // Cross-reference validation
      if (!skipCrossReferences && results.dependencies.isValid) {
        try {
          const modPath = this.#resolveModPath(modId, modManifest);
          results.crossReferences = await this.#modCrossReferenceValidator.validateModReferences(
            modPath, 
            manifestsMap
          );
          
          if (results.crossReferences.hasViolations) {
            results.warnings.push(`${results.crossReferences.violations.length} cross-reference violations`);
          }
        } catch (error) {
          this.#logger.error(`Cross-reference validation failed for mod ${modId}`, error);
          results.errors.push(`Cross-reference validation failed: ${error.message}`);
        }
      }
      
      results.isValid = results.dependencies.isValid && 
                       results.errors.length === 0 &&
                       (!results.crossReferences || !results.crossReferences.hasViolations);
      
      return results;
      
    } catch (error) {
      this.#logger.error(`Validation failed for mod ${modId}`, error);
      throw error;
    }
  }

  /**
   * Integrates with existing mod loading pipeline for pre-load validation
   * @param {string[]} modIds - Ordered list of mod IDs to load
   * @param {Object} options - Loading options
   * @returns {Promise<LoadValidationResult>} Validation results for loading
   */
  async validateForLoading(modIds, options = {}) {
    const { strictMode = false, allowWarnings = true } = options;
    
    this.#logger.info(`Validating ${modIds.length} mods for loading`);
    
    try {
      const manifestsMap = await this.#modManifestLoader.loadAllManifests();
      
      // Validate only the mods being loaded
      const loadingModsMap = new Map();
      modIds.forEach(modId => {
        if (manifestsMap.has(modId)) {
          loadingModsMap.set(modId, manifestsMap.get(modId));
        }
      });
      
      // Check dependency validation for loading subset
      const dependencyResult = await this.#validateLoadingDependencies(loadingModsMap, manifestsMap);
      
      if (!dependencyResult.isValid && strictMode) {
        throw new ModValidationError({ dependencies: dependencyResult });
      }
      
      // Quick cross-reference check for critical issues
      const crossRefWarnings = [];
      for (const modId of modIds) {
        if (!loadingModsMap.has(modId)) continue;
        
        try {
          const modPath = this.#resolveModPath(modId, loadingModsMap.get(modId));
          const report = await this.#modCrossReferenceValidator.validateModReferences(
            modPath, 
            manifestsMap
          );
          
          if (report.hasViolations) {
            const criticalViolations = report.violations.filter(v => v.severity === 'critical');
            if (criticalViolations.length > 0 && strictMode) {
              throw new ModValidationError({ 
                crossReferences: new Map([[modId, report]]) 
              });
            }
            
            if (report.violations.length > 0) {
              crossRefWarnings.push(`${modId}: ${report.violations.length} cross-reference issues`);
            }
          }
        } catch (error) {
          this.#logger.warn(`Cross-reference validation failed for ${modId}`, error);
          crossRefWarnings.push(`${modId}: validation failed - ${error.message}`);
        }
      }
      
      const result = {
        canLoad: dependencyResult.isValid,
        dependencies: dependencyResult,
        warnings: crossRefWarnings,
        loadOrder: modIds, // TODO: Re-validate load order if needed
        recommendations: this.#generateLoadingRecommendations(dependencyResult, crossRefWarnings)
      };
      
      return result;
      
    } catch (error) {
      this.#logger.error('Loading validation failed', error);
      throw error;
    }
  }

  /**
   * Loads and validates manifests with enhanced error handling
   * @private
   * @param {string[]|null} modsToValidate - Specific mods or null for all
   * @returns {Promise<Map<string, Object>>} Map of validated manifests
   */
  async #loadAndValidateManifests(modsToValidate) {
    this.#logger.info('Phase 1: Loading and validating mod manifests');
    
    try {
      const manifestsMap = await this.#modManifestLoader.loadAllManifests();
      
      if (modsToValidate) {
        // Filter to specific mods
        const filteredMap = new Map();
        modsToValidate.forEach(modId => {
          if (manifestsMap.has(modId)) {
            filteredMap.set(modId, manifestsMap.get(modId));
          } else {
            throw new Error(`Specified mod '${modId}' not found`);
          }
        });
        return filteredMap;
      }
      
      return manifestsMap;
      
    } catch (error) {
      this.#logger.error('Manifest loading failed', error);
      throw new ModDependencyError(`Failed to load mod manifests: ${error.message}`);
    }
  }

  /**
   * Validates dependencies for a specific mod using existing infrastructure
   * @private
   * @param {string} modId - Mod identifier
   * @param {Object} manifest - Mod manifest
   * @param {Map<string, Object>} manifestsMap - All manifests for context
   * @returns {Promise<Object>} Dependency validation results
   */
  async #validateModDependencies(modId, manifest, manifestsMap) {
    try {
      // Create single-mod context for dependency validation
      const singleModMap = new Map([[modId, manifest]]);
      
      // Add declared dependencies to context
      if (manifest.dependencies) {
        manifest.dependencies.forEach(dep => {
          if (manifestsMap.has(dep.id)) {
            singleModMap.set(dep.id, manifestsMap.get(dep.id));
          }
        });
      }
      
      return await this.#modDependencyValidator.validateDependencies(singleModMap);
      
    } catch (error) {
      this.#logger.error(`Dependency validation failed for mod ${modId}`, error);
      return {
        isValid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Validates dependencies for loading subset of mods
   * @private
   * @param {Map<string, Object>} loadingMods - Mods being loaded
   * @param {Map<string, Object>} allMods - Full ecosystem for context
   * @returns {Promise<Object>} Dependency validation results
   */
  async #validateLoadingDependencies(loadingMods, allMods) {
    try {
      // Build context map with loading mods and their dependencies
      const contextMap = new Map(loadingMods);
      
      // Add dependencies of loading mods to context
      for (const [modId, manifest] of loadingMods) {
        if (manifest.dependencies) {
          manifest.dependencies.forEach(dep => {
            if (allMods.has(dep.id) && !contextMap.has(dep.id)) {
              contextMap.set(dep.id, allMods.get(dep.id));
            }
          });
        }
      }
      
      return await this.#modDependencyValidator.validateDependencies(contextMap);
      
    } catch (error) {
      this.#logger.error('Loading dependency validation failed', error);
      return {
        isValid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Generates loading recommendations based on validation results
   * @private
   * @param {Object} dependencyResult - Dependency validation results
   * @param {string[]} crossRefWarnings - Cross-reference warnings
   * @returns {string[]} List of recommendations
   */
  #generateLoadingRecommendations(dependencyResult, crossRefWarnings) {
    const recommendations = [];
    
    if (!dependencyResult.isValid) {
      recommendations.push('Resolve dependency issues before loading');
    }
    
    if (crossRefWarnings.length > 0) {
      recommendations.push('Review cross-reference warnings for potential runtime issues');
      if (crossRefWarnings.length > 5) {
        recommendations.push('Consider running full ecosystem validation to address systemic issues');
      }
    }
    
    if (dependencyResult.warnings && dependencyResult.warnings.length > 0) {
      recommendations.push('Address dependency warnings for optimal stability');
    }
    
    return recommendations;
  }

  /**
   * Resolves mod path from manifest (integrates with existing path resolution)
   * @private
   * @param {string} modId - Mod identifier
   * @param {Object} manifest - Mod manifest
   * @returns {string} Resolved mod path
   */
  #resolveModPath(modId, manifest) {
    // TODO: Integrate with existing path resolution logic from modManifestLoader
    return path.join(process.cwd(), 'data', 'mods', modId);
  }
}

/**
 * @typedef {Object} ModEcosystemValidationResult
 * @property {Object} dependencies - Dependency validation results
 * @property {Map<string, Object>|null} crossReferences - Cross-reference validation results
 * @property {Object|null} loadOrder - Load order resolution results
 * @property {Object} performance - Performance metrics
 * @property {boolean} isValid - Overall validation status
 * @property {string[]} errors - Critical errors
 * @property {string[]} warnings - Non-critical warnings
 */

/**
 * @typedef {Object} ModValidationResult
 * @property {string} modId - Mod identifier
 * @property {Object} dependencies - Dependency validation results
 * @property {Object|null} crossReferences - Cross-reference validation results
 * @property {boolean} isValid - Validation status
 * @property {string[]} errors - Critical errors
 * @property {string[]} warnings - Non-critical warnings
 */

export { ModValidationOrchestrator, ModValidationError };
export default ModValidationOrchestrator;
```

### Enhanced Dependency Injection Integration

```javascript
// src/dependencyInjection/registrations/validationRegistrations.js - Enhanced

import { tokens } from '../tokens/tokens-core.js';
import ModValidationOrchestrator from '../../validation/modValidationOrchestrator.js';
import ModCrossReferenceValidator from '../../validation/modCrossReferenceValidator.js';
import ModReferenceExtractor from '../../validation/modReferenceExtractor.js';
import { ViolationReporter } from '../../validation/violationReporter.js';

export function registerValidationServices(container) {
  // Register reference extractor
  container.register(tokens.IModReferenceExtractor, ModReferenceExtractor, {
    dependencies: [tokens.ILogger, tokens.IAjvValidator]
  });
  
  // Register cross-reference validator
  container.register(tokens.IModCrossReferenceValidator, ModCrossReferenceValidator, {
    dependencies: [
      tokens.ILogger,
      tokens.IModDependencyValidator,
      tokens.IModReferenceExtractor
    ]
  });
  
  // Register validation orchestrator
  container.register(tokens.IModValidationOrchestrator, ModValidationOrchestrator, {
    dependencies: [
      tokens.ILogger,
      tokens.IModDependencyValidator,
      tokens.IModCrossReferenceValidator,
      tokens.IModLoadOrderResolver,
      tokens.IModManifestLoader
    ]
  });
  
  // Register violation reporter
  container.register(tokens.IViolationReporter, ViolationReporter, {
    dependencies: [tokens.ILogger]
  });
}
```

### Enhanced Token Definitions

```javascript
// src/dependencyInjection/tokens/tokens-core.js - Additional tokens

export const tokens = {
  // ... existing tokens
  IModReferenceExtractor: 'IModReferenceExtractor',
  IModCrossReferenceValidator: 'IModCrossReferenceValidator',
  IModValidationOrchestrator: 'IModValidationOrchestrator',
  IViolationReporter: 'IViolationReporter',
};
```

### Integration with Existing Mod Loading Pipeline

```javascript
// src/modding/modLoader.js - Enhanced integration example

import { container } from '../dependencyInjection/container.js';
import { tokens } from '../dependencyInjection/tokens/tokens-core.js';

class ModLoader {
  #logger;
  #validationOrchestrator;
  
  constructor({ logger, validationOrchestrator }) {
    this.#logger = logger;
    this.#validationOrchestrator = validationOrchestrator;
  }
  
  /**
   * Enhanced mod loading with integrated validation
   * @param {string[]} modIds - Mods to load in order
   * @param {Object} options - Loading options
   */
  async loadMods(modIds, options = {}) {
    const { validateBeforeLoad = true, strictMode = false } = options;
    
    try {
      if (validateBeforeLoad) {
        this.#logger.info('Pre-loading validation enabled');
        
        const validationResult = await this.#validationOrchestrator.validateForLoading(
          modIds, 
          { strictMode, allowWarnings: !strictMode }
        );
        
        if (!validationResult.canLoad) {
          throw new Error('Pre-loading validation failed - cannot load mods');
        }
        
        if (validationResult.warnings.length > 0) {
          this.#logger.warn(`Loading with ${validationResult.warnings.length} validation warnings`);
          validationResult.warnings.forEach(warning => {
            this.#logger.warn(`  - ${warning}`);
          });
        }
        
        if (validationResult.recommendations.length > 0) {
          this.#logger.info('Loading recommendations:');
          validationResult.recommendations.forEach(rec => {
            this.#logger.info(`  - ${rec}`);
          });
        }
      }
      
      // Proceed with existing mod loading logic
      return await this.#loadModsInternal(modIds, options);
      
    } catch (error) {
      this.#logger.error('Mod loading failed', error);
      throw error;
    }
  }
  
  // ... existing mod loading implementation
}

// Factory function for enhanced mod loader
export function createModLoader() {
  return new ModLoader({
    logger: container.resolve(tokens.ILogger),
    validationOrchestrator: container.resolve(tokens.IModValidationOrchestrator)
  });
}
```

### CLI Integration with Existing Scripts

```javascript
// scripts/updateManifest.js - Enhanced with validation integration

import { container } from '../src/dependencyInjection/container.js';
import { tokens } from '../src/dependencyInjection/tokens/tokens-core.js';

// ... existing updateManifest code ...

/**
 * Enhanced manifest update with optional validation
 * @param {string} modName - Mod to update
 * @param {Object} options - Update options
 */
async function updateModManifest(modName, options = {}) {
  const { validateReferences = false, failOnViolations = false } = options;
  
  console.log(`Starting manifest update for mod: "${modName}"`);

  const modPath = path.join(MODS_BASE_PATH, modName);
  const manifestPath = path.join(modPath, MANIFEST_FILENAME);

  try {
    // ... existing manifest update logic ...

    // NEW: Optional cross-reference validation
    if (validateReferences) {
      console.log('🔍 Running cross-reference validation...');
      
      const validationOrchestrator = container.resolve(tokens.IModValidationOrchestrator);
      
      try {
        const result = await validationOrchestrator.validateMod(modName, {
          skipCrossReferences: false,
          includeContext: true
        });
        
        if (result.crossReferences && result.crossReferences.hasViolations) {
          const violationCount = result.crossReferences.violations.length;
          console.log(`⚠️  Found ${violationCount} cross-reference violations:`);
          
          // Report violations
          const reporter = container.resolve(tokens.IViolationReporter);
          const report = reporter.generateReport(result.crossReferences, 'console', {
            colors: true,
            verbose: false,
            showSuggestions: true
          });
          
          console.log(report);
          
          if (failOnViolations) {
            return {
              success: false,
              modName,
              error: {
                type: 'CROSS_REFERENCE_VIOLATION',
                message: `${violationCount} cross-reference violations found`,
                violations: result.crossReferences.violations
              }
            };
          }
        } else {
          console.log('✅ No cross-reference violations found');
        }
        
      } catch (error) {
        console.error('❌ Cross-reference validation failed:', error.message);
        
        if (failOnViolations) {
          return {
            success: false,
            modName,
            error: {
              type: 'VALIDATION_ERROR',
              message: error.message,
              path: modPath
            }
          };
        }
      }
    }

    // ... rest of existing manifest update logic ...
    
    return { success: true, modName };
    
  } catch (error) {
    // ... existing error handling ...
  }
}

// Enhanced CLI argument parsing
function parseOptions() {
  const args = process.argv.slice(2);
  
  return {
    validateReferences: args.includes('--validate-references'),
    failOnViolations: args.includes('--fail-on-violations'),
    // ... existing options ...
  };
}

// Usage:
// npm run update-manifest positioning --validate-references
// npm run update-manifest positioning --validate-references --fail-on-violations
```

### Package.json Script Integration

```json
{
  "scripts": {
    "update-manifest": "node scripts/updateManifest.js",
    "update-manifest:validate": "node scripts/updateManifest.js --validate-references",
    "update-manifest:strict": "node scripts/updateManifest.js --validate-references --fail-on-violations",
    "validate:ecosystem": "node scripts/validateModReferences.js --format=console",
    "validate:ecosystem:json": "node scripts/validateModReferences.js --format=json --output=validation-report.json",
    "validate:mod": "node scripts/validateModReferences.js --mod=",
    "test:mods": "npm run validate:ecosystem && echo 'Mod validation passed'",
    "build:with-validation": "npm run validate:ecosystem && npm run build"
  }
}
```

## Testing Requirements

### Integration Testing

```javascript
// tests/integration/validation/modValidationOrchestrator.integration.test.js

describe('ModValidationOrchestrator - Integration Tests', () => {
  let orchestrator;
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    
    // Use real components for integration testing
    orchestrator = container.resolve(tokens.IModValidationOrchestrator);
  });

  describe('Ecosystem Validation Integration', () => {
    it('should integrate with existing ModDependencyValidator', async () => {
      // Create test mod ecosystem
      await testBed.createModEcosystem({
        'core': { id: 'core', version: '1.0.0', dependencies: [] },
        'positioning': { 
          id: 'positioning', 
          version: '1.0.0', 
          dependencies: [{ id: 'core', version: '^1.0.0' }]
        },
        'intimacy': {
          id: 'intimacy',
          version: '1.0.0',
          dependencies: [
            { id: 'core', version: '^1.0.0' },
            { id: 'positioning', version: '^1.0.0' }
          ]
        }
      });
      
      // Add the actual violation case
      await testBed.createFileInMod('positioning', 'actions/turn_around.action.json', {
        forbidden_components: {
          actor: ['intimacy:kissing'] // Violation: intimacy not declared
        }
      });
      
      const results = await orchestrator.validateEcosystem();
      
      // Should pass dependency validation but fail cross-reference
      expect(results.dependencies.isValid).toBe(true);
      expect(results.crossReferences.get('positioning').hasViolations).toBe(true);
      expect(results.isValid).toBe(false); // Overall should fail due to violations
    });

    it('should integrate with ModLoadOrderResolver', async () => {
      await testBed.createModEcosystem({
        'core': { id: 'core', version: '1.0.0', dependencies: [] },
        'anatomy': { 
          id: 'anatomy', 
          version: '1.0.0', 
          dependencies: [{ id: 'core', version: '^1.0.0' }]
        },
        'positioning': { 
          id: 'positioning', 
          version: '1.0.0', 
          dependencies: [
            { id: 'core', version: '^1.0.0' },
            { id: 'anatomy', version: '^1.0.0' }
          ]
        },
        'intimacy': {
          id: 'intimacy',
          version: '1.0.0',
          dependencies: [
            { id: 'anatomy', version: '^1.0.0' },
            { id: 'positioning', version: '^1.0.0' }
          ]
        }
      });
      
      const results = await orchestrator.validateEcosystem();
      
      expect(results.loadOrder).toBeDefined();
      expect(results.loadOrder.order).toEqual(['core', 'anatomy', 'positioning', 'intimacy']);
    });
  });

  describe('Loading Validation Integration', () => {
    it('should validate mods for loading with existing pipeline', async () => {
      await testBed.createModEcosystem({
        'core': { id: 'core', version: '1.0.0', dependencies: [] },
        'positioning': { 
          id: 'positioning', 
          version: '1.0.0', 
          dependencies: [{ id: 'core', version: '^1.0.0' }]
        }
      });
      
      const loadResult = await orchestrator.validateForLoading(['positioning'], {
        strictMode: false,
        allowWarnings: true
      });
      
      expect(loadResult.canLoad).toBe(true);
      expect(loadResult.dependencies.isValid).toBe(true);
      expect(loadResult.loadOrder).toEqual(['positioning']);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle ModDependencyValidator failures gracefully', async () => {
      // Create mods with circular dependencies
      await testBed.createModEcosystem({
        'mod-a': { 
          id: 'mod-a', 
          version: '1.0.0', 
          dependencies: [{ id: 'mod-b', version: '^1.0.0' }]
        },
        'mod-b': { 
          id: 'mod-b', 
          version: '1.0.0', 
          dependencies: [{ id: 'mod-a', version: '^1.0.0' }]
        }
      });
      
      await expect(orchestrator.validateEcosystem({ failFast: true }))
        .rejects.toThrow(ModValidationError);
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance with large mod ecosystems', async () => {
      // Create large ecosystem (50 mods)
      const ecosystem = {};
      for (let i = 0; i < 50; i++) {
        ecosystem[`mod-${i}`] = {
          id: `mod-${i}`,
          version: '1.0.0',
          dependencies: [{ id: 'core', version: '^1.0.0' }]
        };
      }
      ecosystem.core = { id: 'core', version: '1.0.0', dependencies: [] };
      
      await testBed.createModEcosystem(ecosystem);
      
      const startTime = performance.now();
      const results = await orchestrator.validateEcosystem();
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(10000); // <10 seconds for 50 mods
      expect(results.performance.totalTime).toBeLessThan(10000);
    });
  });
});
```

### CLI Integration Testing

```javascript
// tests/integration/scripts/updateManifest.integration.test.js

describe('UpdateManifest CLI Integration', () => {
  it('should integrate cross-reference validation with manifest updates', async () => {
    await testBed.createTestMod('positioning', {
      manifest: {
        id: 'positioning',
        dependencies: [{ id: 'core', version: '^1.0.0' }]
      },
      files: {
        'actions/turn_around.action.json': {
          forbidden_components: {
            actor: ['intimacy:kissing']
          }
        }
      }
    });
    
    // Run update-manifest with validation
    const result = await testBed.runScript('updateManifest.js', [
      'positioning', 
      '--validate-references', 
      '--fail-on-violations'
    ]);
    
    expect(result.success).toBe(false);
    expect(result.error.type).toBe('CROSS_REFERENCE_VIOLATION');
    expect(result.output).toContain('intimacy:kissing');
  });
});
```

## Success Criteria

- [ ] `ModValidationOrchestrator` integrates seamlessly with existing dependency infrastructure
- [ ] Unified validation flow processes dependencies before cross-references
- [ ] Existing mod loading pipeline enhanced with validation hooks
- [ ] CLI integration provides validation options in existing scripts
- [ ] Error handling follows established patterns and provides consistent experience
- [ ] Performance maintains or improves upon existing validation speed
- [ ] Integration testing validates real-world scenarios with existing infrastructure
- [ ] Package.json scripts provide convenient access to integrated validation
- [ ] Backward compatibility maintained with existing validation workflows
- [ ] Documentation explains integration points and usage patterns

## Implementation Notes

### Integration Strategy
- **Phased integration**: Gradual integration with existing systems
- **Backward compatibility**: Ensure existing functionality continues to work
- **Performance optimization**: Leverage existing caching and optimization
- **Error consistency**: Use established error patterns and recovery strategies

### Testing Strategy  
- **Integration testing**: Test with real existing components
- **Regression testing**: Ensure existing functionality not broken
- **Performance testing**: Validate performance with integrated system
- **End-to-end testing**: Test complete workflows including CLI

### Documentation Updates
- **API documentation**: Update existing docs with new integration points
- **Usage guides**: Provide examples of integrated workflows
- **Migration guide**: Help users adopt enhanced validation
- **Troubleshooting**: Common integration issues and solutions

## Next Steps

After completion:
1. **MODDEPVAL-008**: Enhance updateManifest.js with full validation integration
2. **MODDEPVAL-009**: Add CLI validation flags and backward compatibility
3. **Performance testing**: Validate integrated system performance

## References

- **Existing dependency validation**: `src/modding/modDependencyValidator.js`
- **Load order resolution**: `src/modding/modLoadOrderResolver.js`
- **Manifest loading**: `src/modding/modManifestLoader.js`
- **Error patterns**: `src/errors/modDependencyError.js`
- **Dependency injection**: `src/dependencyInjection/` patterns