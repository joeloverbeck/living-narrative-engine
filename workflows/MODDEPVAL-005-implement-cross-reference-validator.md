# MODDEPVAL-005: Implement ModCrossReferenceValidator Class

## Overview

Create the `ModCrossReferenceValidator` class that integrates with the existing `ModDependencyValidator` infrastructure to validate cross-mod references against declared dependencies. This class serves as the core validation engine that identifies dependency violations.

## Background

The Living Narrative Engine has sophisticated dependency validation infrastructure, but lacks cross-reference validation. The positioning mod currently violates architectural principles by referencing `intimacy:kissing` without declaring `intimacy` as a dependency.

**Existing infrastructure to leverage:**
- `src/modding/modDependencyValidator.js` - Full dependency validation with semver support
- `src/modding/modLoadOrderResolver.js` - Topological sort for load order
- `src/modding/modManifestLoader.js` - Manifest processing
- `src/validation/` - Established validation patterns

## Technical Specifications

### File Location
- **Primary**: `src/validation/modCrossReferenceValidator.js`
- **Tests**: `tests/unit/validation/modCrossReferenceValidator.test.js`
- **Integration**: Work alongside `src/modding/modDependencyValidator.js`

### Class Architecture

```javascript
/**
 * @file Validates cross-mod references against dependency declarations
 * @see src/modding/modDependencyValidator.js - Existing dependency validation patterns
 * @see src/validation/ajvSchemaValidator.js - Validation infrastructure patterns
 */

import { validateDependency, assertNonBlankString } from '../utils/dependencyUtils.js';
import { ModDependencyError } from '../errors/modDependencyError.js';
import path from 'path';

/** @typedef {import('./types.js').ModReferenceMap} ModReferenceMap */
/** @typedef {import('./types.js').CrossReferenceViolation} CrossReferenceViolation */
/** @typedef {import('./types.js').ValidationReport} ValidationReport */

/**
 * Cross-reference validation error for dependency violations
 */
class CrossReferenceViolationError extends ModDependencyError {
  constructor(violations) {
    const violationMessages = violations.map(v => 
      `${v.file}: ${v.message}`
    ).join('\n');
    
    super(`Cross-reference violations detected:\n${violationMessages}`);
    this.name = 'CrossReferenceViolationError';
    this.violations = violations;
  }
}

/**
 * Validates cross-mod references against declared dependencies
 * Integrates with existing mod dependency infrastructure
 */
class ModCrossReferenceValidator {
  #logger;
  #modDependencyValidator;
  #referenceExtractor;
  
  /**
   * @param {Object} dependencies
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger
   * @param {import('../modding/modDependencyValidator.js')} dependencies.modDependencyValidator
   * @param {import('./modReferenceExtractor.js')} dependencies.referenceExtractor
   */
  constructor({ logger, modDependencyValidator, referenceExtractor }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(modDependencyValidator, 'IModDependencyValidator', logger, {
      requiredMethods: ['validateDependencies', 'resolveDependencies'],
    });
    validateDependency(referenceExtractor, 'IModReferenceExtractor', logger, {
      requiredMethods: ['extractReferences'],
    });
    
    this.#logger = logger;
    this.#modDependencyValidator = modDependencyValidator;
    this.#referenceExtractor = referenceExtractor;
  }

  /**
   * Validates cross-references for a single mod against its declared dependencies
   * @param {string} modPath - Absolute path to mod directory
   * @param {Map<string, Object>} manifestsMap - Map of mod manifests by ID
   * @returns {Promise<ValidationReport>} Validation results with violations
   * @throws {CrossReferenceViolationError} If validation fails critically
   */
  async validateModReferences(modPath, manifestsMap) {
    assertNonBlankString(modPath, 'modPath', 'ModCrossReferenceValidator.validateModReferences', this.#logger);
    
    const modId = path.basename(modPath);
    this.#logger.debug(`Starting cross-reference validation for mod: ${modId}`);
    
    try {
      // Get mod manifest
      const manifest = manifestsMap.get(modId);
      if (!manifest) {
        throw new Error(`Manifest not found for mod: ${modId}`);
      }
      
      // Extract all references from mod files
      const extractedReferences = await this.#referenceExtractor.extractReferences(modPath);
      this.#logger.debug(`Extracted ${extractedReferences.size} referenced mods from ${modId}`);
      
      // Get declared dependencies
      const declaredDependencies = this.#getDeclaredDependencies(manifest);
      this.#logger.debug(`Mod ${modId} declares ${declaredDependencies.size} dependencies`);
      
      // Validate references against dependencies
      const violations = this.#detectViolations(
        modId, 
        modPath,
        extractedReferences, 
        declaredDependencies,
        manifestsMap
      );
      
      // Generate comprehensive report
      const report = this.#generateValidationReport(
        modId,
        extractedReferences,
        declaredDependencies,
        violations
      );
      
      this.#logger.info(`Cross-reference validation for ${modId}: ${violations.length} violations`);
      return report;
      
    } catch (error) {
      this.#logger.error(`Cross-reference validation failed for mod ${modId}`, error);
      throw error;
    }
  }

  /**
   * Validates cross-references for all mods in the ecosystem
   * @param {Map<string, Object>} manifestsMap - Map of all mod manifests
   * @returns {Promise<Map<string, ValidationReport>>} Validation results by mod ID
   */
  async validateAllModReferences(manifestsMap) {
    this.#logger.info(`Starting ecosystem-wide cross-reference validation for ${manifestsMap.size} mods`);
    
    const results = new Map();
    const errors = [];
    
    for (const [modId, manifest] of manifestsMap) {
      try {
        const modPath = this.#resolveModPath(modId, manifest);
        const report = await this.validateModReferences(modPath, manifestsMap);
        results.set(modId, report);
        
        if (report.hasViolations) {
          this.#logger.warn(`Mod ${modId} has ${report.violations.length} cross-reference violations`);
        }
        
      } catch (error) {
        this.#logger.error(`Failed to validate mod ${modId}`, error);
        errors.push({ modId, error: error.message });
      }
    }
    
    // Log ecosystem summary
    const totalViolations = Array.from(results.values())
      .reduce((sum, report) => sum + report.violations.length, 0);
    
    this.#logger.info(`Ecosystem validation complete: ${totalViolations} total violations across ${results.size} mods`);
    
    if (errors.length > 0) {
      this.#logger.warn(`${errors.length} mods failed validation`, { errors });
    }
    
    return results;
  }

  /**
   * Generates a comprehensive violation report for user consumption
   * @param {ValidationReport|Map<string, ValidationReport>} reportOrReports - Single report or ecosystem results
   * @returns {string} Human-readable violation report
   */
  generateReport(reportOrReports) {
    if (reportOrReports instanceof Map) {
      return this.#generateEcosystemReport(reportOrReports);
    } else {
      return this.#generateSingleModReport(reportOrReports);
    }
  }

  /**
   * Extracts declared dependencies from mod manifest
   * @private
   * @param {Object} manifest - Mod manifest object
   * @returns {Set<string>} Set of declared dependency mod IDs
   */
  #getDeclaredDependencies(manifest) {
    const dependencies = new Set(['core']); // Core is always implicit
    
    if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
      manifest.dependencies.forEach(dep => {
        if (dep.id && typeof dep.id === 'string') {
          dependencies.add(dep.id);
        }
      });
    }
    
    return dependencies;
  }

  /**
   * Detects cross-reference violations by comparing references to dependencies
   * @private
   * @param {string} modId - ID of mod being validated
   * @param {string} modPath - Path to mod directory  
   * @param {ModReferenceMap} references - Extracted mod references
   * @param {Set<string>} declaredDeps - Declared dependencies
   * @param {Map<string, Object>} manifestsMap - All mod manifests
   * @returns {CrossReferenceViolation[]} List of violations
   */
  #detectViolations(modId, modPath, references, declaredDeps, manifestsMap) {
    const violations = [];
    
    for (const [referencedModId, components] of references) {
      // Skip self-references (always valid)
      if (referencedModId === modId) {
        continue;
      }
      
      // Check if referenced mod is declared as dependency
      if (!declaredDeps.has(referencedModId)) {
        // Verify referenced mod exists in ecosystem
        if (!manifestsMap.has(referencedModId)) {
          this.#logger.warn(`Referenced mod '${referencedModId}' not found in ecosystem`);
          continue;
        }
        
        // Create violation for each referenced component
        for (const componentId of components) {
          const violation = this.#createViolation(
            modId,
            modPath,
            referencedModId,
            componentId,
            Array.from(declaredDeps)
          );
          violations.push(violation);
        }
      }
    }
    
    return violations;
  }

  /**
   * Creates a detailed violation object
   * @private
   * @param {string} modId - Violating mod ID
   * @param {string} modPath - Path to mod directory
   * @param {string} referencedModId - Referenced mod ID
   * @param {string} componentId - Referenced component ID
   * @param {string[]} declaredDeps - List of declared dependencies
   * @returns {CrossReferenceViolation} Violation details
   */
  #createViolation(modId, modPath, referencedModId, componentId, declaredDeps) {
    return {
      violatingMod: modId,
      referencedMod: referencedModId,
      referencedComponent: componentId,
      file: 'multiple', // TODO: Track specific files in future enhancement
      line: null,       // TODO: Track line numbers in future enhancement
      context: `${referencedModId}:${componentId}`,
      message: `Mod '${modId}' references '${referencedModId}:${componentId}' but doesn't declare '${referencedModId}' as a dependency`,
      declaredDependencies: [...declaredDeps],
      suggestedFix: `Add "${referencedModId}" to dependencies in mod-manifest.json`
    };
  }

  /**
   * Generates comprehensive validation report
   * @private
   * @param {string} modId - Mod ID
   * @param {ModReferenceMap} references - Extracted references
   * @param {Set<string>} declaredDeps - Declared dependencies
   * @param {CrossReferenceViolation[]} violations - Detected violations
   * @returns {ValidationReport} Complete validation report
   */
  #generateValidationReport(modId, references, declaredDeps, violations) {
    const referencedMods = Array.from(references.keys()).sort();
    const missingDependencies = referencedMods.filter(refMod => 
      refMod !== modId && !declaredDeps.has(refMod)
    );
    
    return {
      modId,
      hasViolations: violations.length > 0,
      violations,
      declaredDependencies: Array.from(declaredDeps).sort(),
      referencedMods,
      missingDependencies,
      summary: {
        totalReferences: Array.from(references.values())
          .reduce((sum, components) => sum + components.size, 0),
        uniqueModsReferenced: referencedMods.length,
        violationCount: violations.length,
        missingDependencyCount: missingDependencies.length
      }
    };
  }

  /**
   * Generates human-readable report for single mod
   * @private
   * @param {ValidationReport} report - Validation report
   * @returns {string} Formatted report
   */
  #generateSingleModReport(report) {
    const lines = [];
    
    lines.push(`Cross-Reference Validation Report for '${report.modId}'`);
    lines.push('='.repeat(50));
    lines.push('');
    
    if (!report.hasViolations) {
      lines.push('✅ No cross-reference violations detected');
      lines.push('');
      lines.push(`Summary:`);
      lines.push(`  - References to ${report.referencedMods.length} mods`);
      lines.push(`  - ${report.summary.totalReferences} total component references`);
      lines.push(`  - All references properly declared as dependencies`);
      return lines.join('\n');
    }
    
    lines.push(`❌ ${report.violations.length} cross-reference violations detected`);
    lines.push('');
    
    // Group violations by referenced mod
    const violationsByMod = new Map();
    report.violations.forEach(violation => {
      if (!violationsByMod.has(violation.referencedMod)) {
        violationsByMod.set(violation.referencedMod, []);
      }
      violationsByMod.get(violation.referencedMod).push(violation);
    });
    
    lines.push('Violations:');
    for (const [referencedMod, violations] of violationsByMod) {
      lines.push(`  📦 Missing dependency: ${referencedMod}`);
      violations.forEach(violation => {
        lines.push(`    - References component: ${violation.referencedComponent}`);
      });
      lines.push(`    💡 Fix: Add "${referencedMod}" to dependencies in mod-manifest.json`);
      lines.push('');
    }
    
    lines.push('Current Dependencies:');
    if (report.declaredDependencies.length > 0) {
      report.declaredDependencies.forEach(dep => {
        lines.push(`  - ${dep}`);
      });
    } else {
      lines.push('  (none declared)');
    }
    lines.push('');
    
    lines.push('Referenced Mods:');
    if (report.referencedMods.length > 0) {
      report.referencedMods.forEach(mod => {
        const status = report.declaredDependencies.includes(mod) ? '✅' : '❌';
        lines.push(`  ${status} ${mod}`);
      });
    } else {
      lines.push('  (no external references found)');
    }
    
    return lines.join('\n');
  }

  /**
   * Generates ecosystem-wide violation report
   * @private
   * @param {Map<string, ValidationReport>} results - Validation results by mod
   * @returns {string} Formatted ecosystem report
   */
  #generateEcosystemReport(results) {
    const lines = [];
    const modsWithViolations = Array.from(results.entries())
      .filter(([, report]) => report.hasViolations);
    
    lines.push('Living Narrative Engine - Cross-Reference Validation Report');
    lines.push('='.repeat(60));
    lines.push('');
    
    if (modsWithViolations.length === 0) {
      lines.push('✅ No cross-reference violations detected in ecosystem');
      lines.push(`📊 Validated ${results.size} mods successfully`);
      return lines.join('\n');
    }
    
    const totalViolations = modsWithViolations
      .reduce((sum, [, report]) => sum + report.violations.length, 0);
    
    lines.push(`❌ Found ${totalViolations} violations across ${modsWithViolations.length} mods`);
    lines.push('');
    
    // Summary table
    lines.push('Violation Summary:');
    lines.push('Mod'.padEnd(20) + 'Violations'.padEnd(12) + 'Missing Dependencies');
    lines.push('-'.repeat(60));
    
    modsWithViolations
      .sort((a, b) => b[1].violations.length - a[1].violations.length) // Sort by violation count
      .forEach(([modId, report]) => {
        const violationCount = report.violations.length.toString();
        const missingDeps = report.missingDependencies.join(', ');
        lines.push(
          modId.padEnd(20) + 
          violationCount.padEnd(12) + 
          missingDeps
        );
      });
    
    lines.push('');
    lines.push('Detailed Violations:');
    lines.push('='.repeat(30));
    
    // Detailed violations for each mod
    modsWithViolations.forEach(([modId, report]) => {
      lines.push('');
      lines.push(`📦 ${modId}:`);
      
      const violationsByMod = new Map();
      report.violations.forEach(violation => {
        if (!violationsByMod.has(violation.referencedMod)) {
          violationsByMod.set(violation.referencedMod, []);
        }
        violationsByMod.get(violation.referencedMod).push(violation);
      });
      
      for (const [referencedMod, violations] of violationsByMod) {
        lines.push(`  ❌ Missing dependency: ${referencedMod}`);
        violations.forEach(violation => {
          lines.push(`    - ${violation.referencedComponent}`);
        });
      }
    });
    
    lines.push('');
    lines.push('📋 Next Steps:');
    lines.push('1. Review each mod\'s manifest file (mod-manifest.json)');
    lines.push('2. Add missing dependencies to the dependencies array');
    lines.push('3. Ensure version constraints are appropriate');
    lines.push('4. Re-run validation to confirm fixes');
    
    return lines.join('\n');
  }

  /**
   * Resolves mod path from manifest information
   * @private
   * @param {string} modId - Mod identifier
   * @param {Object} manifest - Mod manifest
   * @returns {string} Resolved mod path
   */
  #resolveModPath(modId, manifest) {
    // TODO: Integrate with existing path resolution logic
    // For now, assume standard structure
    return path.join(process.cwd(), 'data', 'mods', modId);
  }
}

export { ModCrossReferenceValidator, CrossReferenceViolationError };
export default ModCrossReferenceValidator;
```

### Type Definitions Enhancement

```javascript
// src/validation/types.js - Additional type definitions

/**
 * @typedef {Object} CrossReferenceViolation
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
 * @typedef {Object} ValidationReport
 * @property {string} modId - ID of validated mod
 * @property {boolean} hasViolations - Whether violations were found
 * @property {CrossReferenceViolation[]} violations - List of violations
 * @property {string[]} declaredDependencies - Declared dependencies
 * @property {string[]} referencedMods - All referenced mods
 * @property {string[]} missingDependencies - Mods referenced but not declared
 * @property {Object} summary - Summary statistics
 * @property {number} summary.totalReferences - Total component references
 * @property {number} summary.uniqueModsReferenced - Number of unique mods referenced
 * @property {number} summary.violationCount - Number of violations
 * @property {number} summary.missingDependencyCount - Number of missing dependencies
 */
```

## Integration Points

### Dependency Injection Registration

```javascript
// src/dependencyInjection/registrations/validationRegistrations.js

import { tokens } from '../tokens/tokens-core.js';
import ModCrossReferenceValidator from '../../validation/modCrossReferenceValidator.js';
import ModReferenceExtractor from '../../validation/modReferenceExtractor.js';

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
}
```

### Token Definitions

```javascript
// src/dependencyInjection/tokens/tokens-core.js - Additional tokens

export const tokens = {
  // ... existing tokens
  IModReferenceExtractor: 'IModReferenceExtractor',
  IModCrossReferenceValidator: 'IModCrossReferenceValidator',
};
```

### Integration with Existing ModDependencyValidator

```javascript
// Example integration pattern
async function validateModEcosystem(manifestsMap) {
  const logger = container.resolve(tokens.ILogger);
  const modDependencyValidator = container.resolve(tokens.IModDependencyValidator);
  const modCrossRefValidator = container.resolve(tokens.IModCrossReferenceValidator);
  
  try {
    // First run existing dependency validation
    const dependencyResult = await modDependencyValidator.validateDependencies(manifestsMap);
    if (!dependencyResult.isValid) {
      throw new Error('Dependency validation failed - cannot proceed with cross-reference validation');
    }
    
    // Then run cross-reference validation
    const crossRefResult = await modCrossRefValidator.validateAllModReferences(manifestsMap);
    
    return {
      dependencies: dependencyResult,
      crossReferences: crossRefResult
    };
  } catch (error) {
    logger.error('Ecosystem validation failed', error);
    throw error;
  }
}
```

## Testing Requirements

### Unit Test Structure

```javascript
// tests/unit/validation/modCrossReferenceValidator.test.js

describe('ModCrossReferenceValidator - Core Functionality', () => {
  let validator;
  let mockLogger;
  let mockModDependencyValidator;
  let mockReferenceExtractor;

  beforeEach(() => {
    const testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockModDependencyValidator = testBed.createMock('modDependencyValidator', [
      'validateDependencies', 'resolveDependencies'
    ]);
    mockReferenceExtractor = testBed.createMock('referenceExtractor', [
      'extractReferences'
    ]);
    
    validator = new ModCrossReferenceValidator({
      logger: mockLogger,
      modDependencyValidator: mockModDependencyValidator,
      referenceExtractor: mockReferenceExtractor
    });
  });

  describe('Constructor Validation', () => {
    it('should validate all required dependencies', () => {
      expect(() => {
        new ModCrossReferenceValidator({
          logger: null,
          modDependencyValidator: mockModDependencyValidator,
          referenceExtractor: mockReferenceExtractor
        });
      }).toThrow('Logger is required');
    });
  });

  describe('Single Mod Validation', () => {
    it('should detect missing dependencies', async () => {
      // Mock reference extraction
      const extractedRefs = new Map();
      extractedRefs.set('intimacy', new Set(['kissing', 'attraction']));
      extractedRefs.set('violence', new Set(['attacking']));
      
      mockReferenceExtractor.extractReferences.mockResolvedValue(extractedRefs);
      
      // Mock manifest with limited dependencies
      const manifestsMap = new Map();
      manifestsMap.set('positioning', {
        id: 'positioning',
        dependencies: [{ id: 'core', version: '^1.0.0' }]
      });
      manifestsMap.set('intimacy', { id: 'intimacy' });
      manifestsMap.set('violence', { id: 'violence' });
      
      const report = await validator.validateModReferences('/test/positioning', manifestsMap);
      
      expect(report.hasViolations).toBe(true);
      expect(report.violations).toHaveLength(3); // 2 intimacy + 1 violence
      expect(report.missingDependencies).toEqual(['intimacy', 'violence']);
    });
  });
});
```

### Integration Test Requirements

```javascript
describe('ModCrossReferenceValidator - Integration', () => {
  it('should work with real ModDependencyValidator', () => {
    // Test integration with actual dependency validator
  });

  it('should handle the actual positioning/intimacy violation', async () => {
    // Test with real positioning mod structure
    const manifestsMap = new Map();
    manifestsMap.set('positioning', {
      id: 'positioning',
      dependencies: [{ id: 'core', version: '^1.0.0' }]
    });
    manifestsMap.set('intimacy', {
      id: 'intimacy',
      dependencies: [
        { id: 'anatomy', version: '^1.0.0' },
        { id: 'positioning', version: '^1.0.0' }
      ]
    });
    
    // Should detect intimacy:kissing violation
    const report = await validator.validateModReferences('/data/mods/positioning', manifestsMap);
    
    expect(report.hasViolations).toBe(true);
    expect(report.violations.some(v => 
      v.referencedMod === 'intimacy' && v.referencedComponent === 'kissing'
    )).toBe(true);
  });
});
```

## Success Criteria

- [ ] `ModCrossReferenceValidator` class implemented with full dependency injection
- [ ] Integration with existing `ModDependencyValidator` infrastructure complete
- [ ] Single mod validation detects all cross-reference violations
- [ ] Ecosystem-wide validation processes all mods efficiently
- [ ] Comprehensive violation reports generated for users and tooling
- [ ] Error handling follows existing patterns and gracefully handles failures
- [ ] Performance acceptable for large mod ecosystems (<5 seconds for 50 mods)
- [ ] Integration with dependency injection container complete
- [ ] Unit tests achieve >90% code coverage
- [ ] Real-world violation detection validated (positioning→intimacy case)

## Implementation Notes

### Performance Considerations
- **Batch processing**: Validate multiple mods concurrently when possible
- **Caching**: Cache reference extraction results for repeated validations
- **Fail fast**: Stop processing if critical infrastructure validation fails
- **Memory management**: Clean up resources after processing large mod sets

### Error Recovery Strategy
- **Continue on individual failures**: One bad mod shouldn't stop ecosystem validation
- **Detailed error context**: Provide actionable error messages for debugging
- **Graceful degradation**: Partial validation results better than complete failure
- **Consistent error patterns**: Follow existing error handling conventions

### Future Enhancement Hooks
- **File-level tracking**: Track exact files and line numbers for violations
- **Performance metrics**: Measure and report validation performance
- **Custom validation rules**: Support for additional validation rules beyond dependency checking
- **IDE integration**: Provide structured data for IDE/editor integration

## Next Steps

After completion:
1. **MODDEPVAL-006**: Implement violation detection and reporting system
2. **MODDEPVAL-007**: Complete integration with existing ModDependencyValidator
3. **Testing**: Validate with real mod ecosystem data

## References

- **Existing dependency validation**: `src/modding/modDependencyValidator.js`
- **Validation patterns**: `src/validation/ajvSchemaValidator.js`
- **Error handling**: `src/errors/modDependencyError.js`
- **Real violation case**: `data/mods/positioning/actions/turn_around.action.json`