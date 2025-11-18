/**
 * @file ValidationPhase - Comprehensive mod validation phase for the loader pipeline
 * @description Executes cross-reference validation and other comprehensive checks
 * before content loading begins. This phase integrates with ModValidationOrchestrator
 * to ensure all mod references are valid and dependencies are properly declared.
 */

import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';

/**
 * Phase responsible for comprehensive mod validation including cross-references
 */
export default class ValidationPhase extends LoaderPhase {
  /**
   * @param {object} params - Configuration parameters
   * @param {import('../../../cli/validation/modValidationOrchestrator.js').default} params.validationOrchestrator - Validation orchestrator service
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger service
   * @param {object} [params.options] - Validation options
   * @param {boolean} [params.options.skipCrossReferences] - Skip cross-reference validation
   * @param {boolean} [params.options.failFast] - Stop on first validation failure
   */
  constructor({ validationOrchestrator, logger, options = {} }) {
    super('validation');
    this.validationOrchestrator = validationOrchestrator;
    this.logger = logger;
    this.options = options;
  }

  /**
   * Executes the validation phase
   *
   * @param {import('../LoadContext.js').LoadContext} ctx - The load context
   * @returns {Promise<import('../LoadContext.js').LoadContext>}
   * @throws {ModsLoaderPhaseError} When validation fails
   */
  async execute(ctx) {
    this.logger.info('— ValidationPhase starting —');

    // Skip validation if orchestrator is not available
    if (!this.validationOrchestrator) {
      this.logger.debug(
        'ValidationPhase: No validation orchestrator available, skipping'
      );
      return ctx;
    }

    try {
      const { skipCrossReferences = false, failFast = false } = this.options;

      // Validate the loaded mods
      const validationResult =
        await this.validationOrchestrator.validateForLoading(
          ctx.finalModOrder || ctx.requestedMods,
          {
            strictMode: failFast,
            allowWarnings: !failFast,
          }
        );

      // Check if validation passed
      if (!validationResult.canLoad) {
        const errorMessage =
          'Mod validation failed - cannot proceed with loading';
        this.logger.error(errorMessage);

        // Log specific issues
        if (
          validationResult.dependencies &&
          !validationResult.dependencies.isValid
        ) {
          this.logger.error(
            'Dependency validation errors:',
            validationResult.dependencies.errors
          );
        }

        if (validationResult.warnings && validationResult.warnings.length > 0) {
          validationResult.warnings.forEach((warning) => {
            this.logger.warn(`Validation warning: ${warning}`);
          });
        }

        throw new ModsLoaderPhaseError(
          ModsLoaderErrorCode.VALIDATION,
          errorMessage,
          'ValidationPhase',
          new Error(errorMessage)
        );
      }

      // Log warnings if any
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        this.logger.warn(
          `ValidationPhase: ${validationResult.warnings.length} validation warnings found`
        );
        validationResult.warnings.forEach((warning) => {
          this.logger.warn(`  - ${warning}`);
        });
      }

      // Log recommendations if any
      if (
        validationResult.recommendations &&
        validationResult.recommendations.length > 0
      ) {
        this.logger.info('ValidationPhase recommendations:');
        validationResult.recommendations.forEach((rec) => {
          this.logger.info(`  - ${rec}`);
        });
      }

      // Create new frozen context with validation results
      const next = {
        ...ctx,
        validationWarnings: validationResult.warnings || [],
        validationRecommendations: validationResult.recommendations || [],
        validationPassed: true,
      };

      this.logger.info('— ValidationPhase completed successfully —');
      return Object.freeze(next);
    } catch (error) {
      // If it's already a ModsLoaderPhaseError, re-throw
      if (error instanceof ModsLoaderPhaseError) {
        throw error;
      }

      // Wrap other errors
      throw new ModsLoaderPhaseError(
        ModsLoaderErrorCode.VALIDATION,
        error.message,
        'ValidationPhase',
        error
      );
    }
  }
}
