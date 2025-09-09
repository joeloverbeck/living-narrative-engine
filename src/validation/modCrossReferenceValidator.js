/**
 * @file Validates cross-mod references against dependency declarations
 * @description Core validation engine that identifies dependency violations by comparing
 * cross-mod references to declared dependencies in mod manifests.
 * @see src/modding/modDependencyValidator.js - Existing dependency validation patterns
 * @see src/validation/ajvSchemaValidator.js - Validation infrastructure patterns
 */

import { validateDependency, assertNonBlankString } from '../utils/dependencyUtils.js';
import ModDependencyError from '../errors/modDependencyError.js';
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
  #referenceExtractor;
  #testModBasePath;
  
  /**
   * Creates a new ModCrossReferenceValidator instance
   *
   * @param {object} dependencies - Dependencies for the validator
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance for logging
   * @param {import('../modding/modDependencyValidator.js').default} dependencies.modDependencyValidator - Mod dependency validator class
   * @param {import('./modReferenceExtractor.js').default} dependencies.referenceExtractor - Reference extractor instance
   * @param {string} [dependencies.testModBasePath] - Base path for mods in test environment
   */
  constructor({ logger, modDependencyValidator, referenceExtractor, testModBasePath }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(modDependencyValidator, 'ModDependencyValidator', logger, {
      requiredMethods: ['validate'],
    });
    validateDependency(referenceExtractor, 'IModReferenceExtractor', logger, {
      requiredMethods: ['extractReferences'],
    });
    
    this.#logger = logger;
    this.#referenceExtractor = referenceExtractor;
    this.#testModBasePath = testModBasePath;
  }

  /**
   * Sets the base path for mods in test environment
   * 
   * @param {string} basePath - Base path for test mods
   */
  setTestModBasePath(basePath) {
    this.#testModBasePath = basePath;
  }

  /**
   * Validates cross-references for a single mod against its declared dependencies
   *
   * @param {string} modPath - Absolute path to mod directory
   * @param {Map<string, object>} manifestsMap - Map of mod manifests by ID
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
   *
   * @param {Map<string, object>} manifestsMap - Map of all mod manifests
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
   *
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
   *
   * @private
   * @param {object} manifest - Mod manifest object
   * @returns {Set<string>} Set of declared dependency mod IDs
   */
  #getDeclaredDependencies(manifest) {
    const dependencies = new Set(['core']); // Core is always implicit
    
    if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
      manifest.dependencies.forEach(dep => {
        if (dep && dep.id && typeof dep.id === 'string') {
          dependencies.add(dep.id);
        }
      });
    }
    
    return dependencies;
  }

  /**
   * Detects cross-reference violations by comparing references to dependencies
   *
   * @private
   * @param {string} modId - ID of mod being validated
   * @param {string} modPath - Path to mod directory  
   * @param {ModReferenceMap} references - Extracted mod references
   * @param {Set<string>} declaredDeps - Declared dependencies
   * @param {Map<string, object>} manifestsMap - All mod manifests
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
   *
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
   *
   * @private
   * @param {string} modId - Mod ID
   * @param {ModReferenceMap} references - Extracted references
   * @param {Set<string>} declaredDeps - Declared dependencies
   * @param {CrossReferenceViolation[]} violations - Detected violations
   * @returns {ValidationReport} Complete validation report
   */
  #generateValidationReport(modId, references, declaredDeps, violations) {
    const referencedMods = Array.from(references.keys())
      .filter(refMod => refMod !== modId) // Filter out self-references
      .sort();
    const missingDependencies = referencedMods.filter(refMod => 
      !declaredDeps.has(refMod)
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
   *
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
   *
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
   *
   * @private
   * @param {string} modId - Mod identifier
   * @param {object} _manifest - Mod manifest (reserved for future use)
   * @returns {string} Resolved mod path
   */
  #resolveModPath(modId, _manifest) {
    // Check if we're in a test environment using temporary directories
    if (globalThis.process?.env?.NODE_ENV === 'test' && this.#testModBasePath) {
      return path.join(this.#testModBasePath, modId);
    }
    
    // Use standard project structure
    const cwd = globalThis.process?.cwd?.() || '/tmp';
    return path.join(cwd, 'data', 'mods', modId);
  }
}

export { ModCrossReferenceValidator, CrossReferenceViolationError };
export default ModCrossReferenceValidator;