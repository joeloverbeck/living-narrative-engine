/**
 * @file Orchestrates all mod validation including dependencies and cross-references
 * @see src/modding/modDependencyValidator.js - Existing dependency validation
 * @see src/modding/modLoadOrderResolver.js - Load order resolution
 */

/* global process */

import { validateDependency } from '../../src/utils/dependencyUtils.js';
import ModDependencyError from '../../src/errors/modDependencyError.js';
import ManifestFileExistenceValidator from './manifestFileExistenceValidator.js';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Comprehensive mod validation error that aggregates multiple validation failures
 */
class ModValidationError extends ModDependencyError {
  constructor(validationResults) {
    const messages = [];

    if (
      validationResults.dependencies &&
      !validationResults.dependencies.isValid
    ) {
      messages.push(
        `Dependency validation failed: ${validationResults.dependencies.errors?.length || 0} errors`
      );
    }

    if (validationResults.crossReferences) {
      const violationCount =
        validationResults.crossReferences instanceof Map
          ? Array.from(validationResults.crossReferences.values()).reduce(
              (sum, r) => sum + r.violations?.length || 0,
              0
            )
          : validationResults.crossReferences.violations?.length || 0;

      if (violationCount > 0) {
        messages.push(
          `Cross-reference validation failed: ${violationCount} violations`
        );
      }
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
  #pathResolver;
  #configuration;
  #fileExistenceValidator;

  /**
   * @param {object} dependencies
   * @param {import('../../src/utils/loggerUtils.js').ILogger} dependencies.logger
   * @param {typeof import('../../src/modding/modDependencyValidator.js').default} dependencies.modDependencyValidator
   * @param {import('./modCrossReferenceValidator.js').default} dependencies.modCrossReferenceValidator
   * @param {import('../../src/modding/modLoadOrderResolver.js').default} dependencies.modLoadOrderResolver
   * @param {import('../../src/modding/modManifestLoader.js').default} dependencies.modManifestLoader
   * @param {import('../../src/interfaces/coreServices.js').IPathResolver} dependencies.pathResolver
   * @param {import('../../src/interfaces/coreServices.js').IConfiguration} dependencies.configuration
   * @param {ManifestFileExistenceValidator} [dependencies.fileExistenceValidator] - Optional file existence validator
   */
  constructor({
    logger,
    modDependencyValidator,
    modCrossReferenceValidator,
    modLoadOrderResolver,
    modManifestLoader,
    pathResolver,
    configuration,
    fileExistenceValidator = null,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // ModDependencyValidator is a class with static methods
    if (
      !modDependencyValidator ||
      typeof modDependencyValidator.validate !== 'function'
    ) {
      throw new Error('ModDependencyValidator must have a validate method');
    }

    validateDependency(
      modCrossReferenceValidator,
      'IModCrossReferenceValidator',
      logger,
      {
        requiredMethods: ['validateModReferences', 'validateAllModReferences'],
      }
    );
    validateDependency(modLoadOrderResolver, 'IModLoadOrderResolver', logger, {
      requiredMethods: ['resolve'],
    });
    validateDependency(modManifestLoader, 'IModManifestLoader', logger, {
      requiredMethods: ['loadRequestedManifests', 'loadModManifests'],
    });
    validateDependency(pathResolver, 'IPathResolver', logger, {
      requiredMethods: ['resolveModManifestPath'],
    });
    validateDependency(configuration, 'IConfiguration', logger, {
      requiredMethods: ['getContentTypeSchemaId'],
    });

    this.#logger = logger;
    this.#modDependencyValidator = modDependencyValidator;
    this.#modCrossReferenceValidator = modCrossReferenceValidator;
    this.#modLoadOrderResolver = modLoadOrderResolver;
    this.#modManifestLoader = modManifestLoader;
    this.#pathResolver = pathResolver;
    this.#configuration = configuration;
    this.#fileExistenceValidator =
      fileExistenceValidator || new ManifestFileExistenceValidator({ logger });
  }

  /**
   * Performs comprehensive validation of the entire mod ecosystem
   *
   * @param {object} options - Validation options
   * @param {boolean} options.skipCrossReferences - Skip cross-reference validation
   * @param {boolean} options.failFast - Stop on first validation failure
   * @param {string[]} options.modsToValidate - Specific mods to validate (default: all)
   * @returns {Promise<ModEcosystemValidationResult>} Complete validation results
   */
  async validateEcosystem(options = {}) {
    const {
      skipCrossReferences = false,
      failFast = false,
      modsToValidate = null,
    } = options;

    this.#logger.info('Starting comprehensive mod ecosystem validation');

    const startTime = performance.now();
    const results = {
      dependencies: null,
      crossReferences: null,
      loadOrder: null,
      performance: {
        startTime,
        phases: new Map(),
      },
      isValid: false,
      errors: [],
      warnings: [],
    };

    try {
      // Phase 1: Load and validate manifests
      const manifestsMap = await this.#loadAndValidateManifests(modsToValidate);
      results.performance.phases.set(
        'manifest-loading',
        performance.now() - startTime
      );

      // Phase 2: Dependency validation (prerequisite for cross-reference validation)
      this.#logger.info('Phase 2: Validating mod dependencies');
      const depStartTime = performance.now();

      // Use static validate method from ModDependencyValidator
      try {
        this.#modDependencyValidator.validate(manifestsMap, this.#logger);
        results.dependencies = {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } catch (error) {
        if (error instanceof ModDependencyError) {
          results.dependencies = {
            isValid: false,
            errors: [error.message],
            warnings: [],
          };
          this.#logger.error('Dependency validation failed', error);
          if (failFast) {
            throw new ModValidationError(results);
          }
          results.errors.push('Dependency validation failed');
        } else {
          throw error;
        }
      }

      results.performance.phases.set(
        'dependency-validation',
        performance.now() - depStartTime
      );

      // Phase 3: Load order resolution (uses dependency validation results)
      if (results.dependencies.isValid) {
        this.#logger.info('Phase 3: Resolving mod load order');
        const loadOrderStartTime = performance.now();

        try {
          // Get mod IDs for load order resolution
          const requestedIds =
            modsToValidate || Array.from(manifestsMap.keys());
          const loadOrder = this.#modLoadOrderResolver.resolve(
            requestedIds,
            manifestsMap
          );
          results.loadOrder = {
            order: loadOrder,
            isValid: true,
          };
          results.performance.phases.set(
            'load-order-resolution',
            performance.now() - loadOrderStartTime
          );
        } catch (error) {
          this.#logger.warn('Load order resolution failed', error);
          results.warnings.push(
            `Load order resolution failed: ${error.message}`
          );
        }
      }

      // Phase 4: Cross-reference validation (depends on valid dependencies)
      if (!skipCrossReferences && results.dependencies.isValid) {
        this.#logger.info('Phase 4: Validating cross-mod references');
        const crossRefStartTime = performance.now();

        try {
          results.crossReferences =
            await this.#modCrossReferenceValidator.validateAllModReferences(
              manifestsMap
            );
          results.performance.phases.set(
            'cross-reference-validation',
            performance.now() - crossRefStartTime
          );

          const hasViolations = Array.from(
            results.crossReferences.values()
          ).some((r) => r.hasViolations);
          if (hasViolations) {
            const totalViolations = Array.from(
              results.crossReferences.values()
            ).reduce((sum, r) => sum + r.violations.length, 0);
            this.#logger.warn(
              `Cross-reference validation found ${totalViolations} violations`
            );

            if (failFast) {
              throw new ModValidationError(results);
            }
            results.warnings.push(
              `Cross-reference validation found ${totalViolations} violations`
            );
          }
        } catch (error) {
          this.#logger.error('Cross-reference validation failed', error);
          results.errors.push(
            `Cross-reference validation failed: ${error.message}`
          );
        }
      } else if (skipCrossReferences) {
        this.#logger.info('Phase 4: Cross-reference validation skipped');
      }

      // Phase 5: File existence validation
      this.#logger.info('Phase 5: Validating manifest file references');
      const fileExistenceStartTime = performance.now();

      try {
        results.fileExistence =
          await this.#fileExistenceValidator.validateAllMods(manifestsMap);
        results.performance.phases.set(
          'file-existence-validation',
          performance.now() - fileExistenceStartTime
        );

        const invalidMods = Array.from(results.fileExistence.values()).filter(
          (r) => !r.isValid
        );
        if (invalidMods.length > 0) {
          const totalIssues = invalidMods.reduce(
            (sum, r) => sum + r.missingFiles.length + r.namingIssues.length,
            0
          );
          this.#logger.warn(
            `File existence validation found ${totalIssues} issues in ${invalidMods.length} mod(s)`
          );

          if (failFast) {
            throw new ModValidationError(results);
          }
          results.warnings.push(
            `File existence validation found ${totalIssues} issues in ${invalidMods.length} mod(s)`
          );
        }
      } catch (error) {
        this.#logger.error('File existence validation failed', error);
        results.errors.push(
          `File existence validation failed: ${error.message}`
        );
      }

      // Phase 6: Unregistered files validation (inverse of Phase 5)
      this.#logger.info('Phase 6: Validating for unregistered files on disk');
      const unregisteredFilesStartTime = performance.now();

      try {
        results.unregisteredFiles =
          await this.#fileExistenceValidator.validateAllModsUnregistered(
            manifestsMap
          );
        results.performance.phases.set(
          'unregistered-files-validation',
          performance.now() - unregisteredFilesStartTime
        );

        const modsWithUnregistered = Array.from(
          results.unregisteredFiles.values()
        ).filter((r) => !r.isValid);
        if (modsWithUnregistered.length > 0) {
          const totalUnregistered = modsWithUnregistered.reduce(
            (sum, r) => sum + r.unregisteredFiles.length,
            0
          );
          this.#logger.warn(
            `Unregistered files validation found ${totalUnregistered} file(s) in ${modsWithUnregistered.length} mod(s)`
          );

          // Unregistered files are warnings, not errors (don't fail validation)
          results.warnings.push(
            `Unregistered files validation found ${totalUnregistered} file(s) in ${modsWithUnregistered.length} mod(s)`
          );
        }
      } catch (error) {
        this.#logger.error('Unregistered files validation failed', error);
        results.errors.push(
          `Unregistered files validation failed: ${error.message}`
        );
      }

      // Determine overall validation status
      results.isValid =
        results.dependencies?.isValid &&
        results.errors.length === 0 &&
        (!results.crossReferences ||
          !Array.from(results.crossReferences.values()).some(
            (r) => r.hasViolations
          )) &&
        (!results.fileExistence ||
          !Array.from(results.fileExistence.values()).some((r) => !r.isValid));

      const totalTime = performance.now() - startTime;
      results.performance.totalTime = totalTime;

      this.#logger.info(
        `Ecosystem validation complete: ${results.isValid ? 'PASSED' : 'FAILED'} (${totalTime.toFixed(2)}ms)`
      );

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
   *
   * @param {string} modId - Mod identifier to validate
   * @param {object} options - Validation options
   * @returns {Promise<ModValidationResult>} Single mod validation results
   */
  async validateMod(modId, options = {}) {
    const { skipCrossReferences = false, includeContext = true } = options;

    this.#logger.info(`Starting validation for mod: ${modId}`);

    try {
      // Load all manifests for context
      const allModIds = await this.#discoverAllModIds();
      const manifestsMap =
        await this.#modManifestLoader.loadRequestedManifests(allModIds);

      if (!manifestsMap.has(modId)) {
        throw new Error(`Mod '${modId}' not found in ecosystem`);
      }

      const results = {
        modId,
        dependencies: null,
        crossReferences: null,
        isValid: false,
        errors: [],
        warnings: [],
      };

      // Validate dependencies for this mod
      const modManifest = manifestsMap.get(modId);
      results.dependencies = await this.#validateModDependencies(
        modId,
        modManifest,
        manifestsMap
      );

      if (!results.dependencies.isValid) {
        results.errors.push('Dependency validation failed');
        if (!includeContext) {
          return results;
        }
      }

      // Cross-reference validation
      if (!skipCrossReferences && results.dependencies.isValid) {
        try {
          const modPath = this._resolveModPath(modId, modManifest);
          results.crossReferences =
            await this.#modCrossReferenceValidator.validateModReferences(
              modPath,
              manifestsMap
            );

          if (results.crossReferences.hasViolations) {
            results.warnings.push(
              `${results.crossReferences.violations.length} cross-reference violations`
            );
          }
        } catch (error) {
          this.#logger.error(
            `Cross-reference validation failed for mod ${modId}`,
            error
          );
          results.errors.push(
            `Cross-reference validation failed: ${error.message}`
          );
        }
      }

      results.isValid =
        results.dependencies.isValid &&
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
   *
   * @param {string[]} modIds - Ordered list of mod IDs to load
   * @param {object} options - Loading options
   * @returns {Promise<LoadValidationResult>} Validation results for loading
   */
  async validateForLoading(modIds, options = {}) {
    const { strictMode = false, allowWarnings = true } = options;

    this.#logger.info(`Validating ${modIds.length} mods for loading`);

    try {
      // Load manifests for all requested mods
      const manifestsMap =
        await this.#modManifestLoader.loadRequestedManifests(modIds);

      // Check dependency validation for loading subset
      const dependencyResult =
        await this.#validateLoadingDependencies(manifestsMap);

      if (!dependencyResult.isValid && strictMode) {
        throw new ModValidationError({ dependencies: dependencyResult });
      }

      // Quick cross-reference check for critical issues
      const crossRefWarnings = [];
      for (const modId of modIds) {
        if (!manifestsMap.has(modId)) continue;

        try {
          const modPath = this._resolveModPath(modId, manifestsMap.get(modId));
          const report =
            await this.#modCrossReferenceValidator.validateModReferences(
              modPath,
              manifestsMap
            );

          if (report.hasViolations) {
            const criticalViolations = report.violations.filter(
              (v) => v.severity === 'critical'
            );
            if (criticalViolations.length > 0 && strictMode) {
              throw new ModValidationError({
                crossReferences: new Map([[modId, report]]),
              });
            }

            if (report.violations.length > 0) {
              crossRefWarnings.push(
                `${modId}: ${report.violations.length} cross-reference issues`
              );
            }
          }
        } catch (error) {
          this.#logger.warn(
            `Cross-reference validation failed for ${modId}`,
            error
          );
          crossRefWarnings.push(
            `${modId}: validation failed - ${error.message}`
          );
        }
      }

      const result = {
        canLoad: dependencyResult.isValid,
        dependencies: dependencyResult,
        warnings: crossRefWarnings,
        loadOrder: modIds,
        recommendations: this.#generateLoadingRecommendations(
          dependencyResult,
          crossRefWarnings
        ),
      };

      return result;
    } catch (error) {
      this.#logger.error('Loading validation failed', error);
      throw error;
    }
  }

  /**
   * Discovers all mod IDs in the mods directory
   *
   * @private
   * @returns {Promise<string[]>} Array of mod IDs
   */
  async #discoverAllModIds() {
    try {
      const modsPath = path.join(process.cwd(), 'data', 'mods');
      const entries = await fs.readdir(modsPath, { withFileTypes: true });

      // Directories to exclude from validation (examples, documentation, etc.)
      const excludedDirs = ['examples'];

      const modIds = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (excludedDirs.includes(entry.name)) {
            this.#logger.debug(`Skipping excluded directory: ${entry.name}`);
            continue;
          }

          // Check if it has a mod-manifest.json
          const manifestPath = path.join(
            modsPath,
            entry.name,
            'mod-manifest.json'
          );
          try {
            await fs.access(manifestPath);
            modIds.push(entry.name);
          } catch {
            // No manifest, skip
          }
        }
      }

      return modIds;
    } catch (error) {
      this.#logger.error('Failed to discover mod IDs', error);
      throw new Error(`Failed to discover mods: ${error.message}`);
    }
  }

  /**
   * Loads and validates manifests with enhanced error handling
   *
   * @private
   * @param {string[]|null} modsToValidate - Specific mods or null for all
   * @returns {Promise<Map<string, object>>} Map of validated manifests
   */
  async #loadAndValidateManifests(modsToValidate) {
    this.#logger.info('Phase 1: Loading and validating mod manifests');

    try {
      // If no specific mods requested, discover all
      const modIds = modsToValidate || (await this.#discoverAllModIds());

      // Load manifests using the loadRequestedManifests method
      const manifestsMap =
        await this.#modManifestLoader.loadRequestedManifests(modIds);

      return manifestsMap;
    } catch (error) {
      this.#logger.error('Manifest loading failed', error);
      throw new ModDependencyError(
        `Failed to load mod manifests: ${error.message}`
      );
    }
  }

  /**
   * Validates dependencies for a specific mod using existing infrastructure
   *
   * @private
   * @param {string} modId - Mod identifier
   * @param {object} manifest - Mod manifest
   * @param {Map<string, object>} manifestsMap - All manifests for context
   * @returns {Promise<object>} Dependency validation results
   */
  async #validateModDependencies(modId, manifest, manifestsMap) {
    try {
      // Build the full dependency closure (mod + all transitive dependencies)
      const singleModMap = new Map([[modId, manifest]]);
      const toVisit = [modId];
      const visited = new Set([modId]);

      while (toVisit.length > 0) {
        const currentId = toVisit.pop();
        const currentManifest = manifestsMap.get(currentId);
        if (!currentManifest?.dependencies) continue;

        currentManifest.dependencies.forEach((dep) => {
          const depId = (typeof dep === 'string' ? dep : dep.id)?.trim();
          if (!depId || visited.has(depId)) {
            return;
          }

          visited.add(depId);
          if (manifestsMap.has(depId)) {
            singleModMap.set(depId, manifestsMap.get(depId));
            toVisit.push(depId);
          }
        });
      }

      // Use static validate method
      try {
        this.#modDependencyValidator.validate(singleModMap, this.#logger);
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } catch (error) {
        return {
          isValid: false,
          errors: [error.message],
          warnings: [],
        };
      }
    } catch (error) {
      this.#logger.error(
        `Dependency validation failed for mod ${modId}`,
        error
      );
      return {
        isValid: false,
        errors: [error.message],
        warnings: [],
      };
    }
  }

  /**
   * Validates dependencies for loading subset of mods
   *
   * @private
   * @param {Map<string, object>} loadingMods - Mods being loaded
   * @returns {Promise<object>} Dependency validation results
   */
  async #validateLoadingDependencies(loadingMods) {
    try {
      // Use static validate method
      try {
        this.#modDependencyValidator.validate(loadingMods, this.#logger);
        return {
          isValid: true,
          errors: [],
          warnings: [],
        };
      } catch (error) {
        return {
          isValid: false,
          errors: [error.message],
          warnings: [],
        };
      }
    } catch (error) {
      this.#logger.error('Loading dependency validation failed', error);
      return {
        isValid: false,
        errors: [error.message],
        warnings: [],
      };
    }
  }

  /**
   * Generates loading recommendations based on validation results
   *
   * @private
   * @param {object} dependencyResult - Dependency validation results
   * @param {string[]} crossRefWarnings - Cross-reference warnings
   * @returns {string[]} List of recommendations
   */
  #generateLoadingRecommendations(dependencyResult, crossRefWarnings) {
    const recommendations = [];

    if (!dependencyResult.isValid) {
      recommendations.push('Resolve dependency issues before loading');
    }

    if (crossRefWarnings.length > 0) {
      recommendations.push(
        'Review cross-reference warnings for potential runtime issues'
      );
      if (crossRefWarnings.length > 5) {
        recommendations.push(
          'Consider running full ecosystem validation to address systemic issues'
        );
      }
    }

    if (dependencyResult.warnings && dependencyResult.warnings.length > 0) {
      recommendations.push('Address dependency warnings for optimal stability');
    }

    return recommendations;
  }

  /**
   * Resolves mod path from manifest
   *
   * @protected
   * @param {string} modId - Mod identifier
   * @param {object} manifest - Mod manifest
   * @returns {string} Resolved mod path
   */
  _resolveModPath(modId, manifest) {
    // Use pathResolver if available, otherwise use default structure
    if (
      this.#pathResolver &&
      typeof this.#pathResolver.resolveModPath === 'function'
    ) {
      return this.#pathResolver.resolveModPath(modId);
    }
    return path.join(process.cwd(), 'data', 'mods', modId);
  }
}

/**
 * @typedef {object} ModEcosystemValidationResult
 * @property {object} dependencies - Dependency validation results
 * @property {Map<string, object> | null} crossReferences - Cross-reference validation results
 * @property {object | null} loadOrder - Load order resolution results
 * @property {object} performance - Performance metrics
 * @property {boolean} isValid - Overall validation status
 * @property {string[]} errors - Critical errors
 * @property {string[]} warnings - Non-critical warnings
 */

/**
 * @typedef {object} ModValidationResult
 * @property {string} modId - Mod identifier
 * @property {object} dependencies - Dependency validation results
 * @property {object | null} crossReferences - Cross-reference validation results
 * @property {boolean} isValid - Validation status
 * @property {string[]} errors - Critical errors
 * @property {string[]} warnings - Non-critical warnings
 */

/**
 * @typedef {object} LoadValidationResult
 * @property {boolean} canLoad - Whether mods can be loaded
 * @property {object} dependencies - Dependency validation results
 * @property {string[]} warnings - Warning messages
 * @property {string[]} loadOrder - Resolved load order
 * @property {string[]} recommendations - Loading recommendations
 */

export { ModValidationOrchestrator, ModValidationError };
export default ModValidationOrchestrator;
