import { BaseValidator } from './BaseValidator.js';
import { createValidatorLogger } from '../utils/validatorLoggingUtils.js';

/**
 * @file LoadFailureValidator - reports entity definition load failures recorded during mod loading.
 */

/**
 * Validator that surfaces entity definition load failures captured by the loader totals snapshot.
 *
 * @augments BaseValidator
 */
export class LoadFailureValidator extends BaseValidator {
  #logger;
  #logValidatorError;

  /**
   * Initializes validator dependencies for reporting load failures.
   *
   * @description Creates a LoadFailureValidator instance.
   * @param {object} params - Constructor parameters.
   * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger implementation.
   */
  constructor({ logger }) {
    super({
      name: 'load-failures',
      priority: 50,
      failFast: false,
      logger,
    });

    this.#logger = logger;
    this.#logValidatorError = createValidatorLogger({
      logger,
      validatorName: this.name,
    });
  }

  /**
   * Executes validation using loader totals for entity definition failures.
   *
   * @description Performs validation by reading loader totals for entity definition failures.
   * @param {object} recipe - Recipe under validation.
   * @param {object} [options] - Validation options.
   * @param {object} [options.loadFailures] - Loader totals snapshot.
   * @param {import('../core/ValidationResultBuilder.js').default} builder - Validation result builder.
   * @returns {Promise<void>}
   */
  async performValidation(recipe, options, builder) {
    try {
      const failureEntries =
        options?.loadFailures?.entityDefinitions?.failures ?? [];

      if (!Array.isArray(failureEntries) || failureEntries.length === 0) {
        return;
      }

      for (const failure of failureEntries) {
        if (!failure || typeof failure !== 'object') {
          continue;
        }

        const filename =
          typeof failure.file === 'string'
            ? failure.file
            : 'unknown entity definition file';
        const baseId =
          typeof failure.file === 'string'
            ? failure.file.replace('.entity.json', '')
            : recipe.recipeId;
        const error = failure.error;

        const componentValidationMatch = error?.message?.match(
          /Invalid components: \[(.*?)\]/
        );

        if (componentValidationMatch) {
          const failedComponents = componentValidationMatch[1]
            .split(', ')
            .map((component) => component.trim())
            .filter(Boolean);

          const validationDetails = this.#extractComponentValidationDetails(
            error,
            failedComponents
          );

          const fixSuggestion =
            validationDetails.length > 0
              ? `Fix validation errors:\n    ${validationDetails
                  .map((detail) => `${detail.component}: ${detail.issue}`)
                  .join('\n    ')}`
              : `Check component values in ${filename} for: ${
                  failedComponents.join(', ') || 'unknown components'
                }`;

          builder.addError(
            'ENTITY_LOAD_FAILURE',
            `Entity definition '${baseId}' failed to load due to component validation errors`,
            {
              location: { type: 'entity_definition', file: filename },
              details: {
                file: filename,
                failedComponents,
                error: error?.message,
                validationDetails,
              },
              fix: fixSuggestion,
            }
          );
        } else {
          const fallbackMessage =
            typeof error?.message === 'string'
              ? error.message
              : error !== undefined
              ? String(error)
              : 'Unknown error';

          builder.addError(
            'ENTITY_LOAD_FAILURE',
            `Entity definition '${baseId}' failed to load`,
            {
              location: { type: 'entity_definition', file: filename },
              details: {
                file: filename,
                error: fallbackMessage,
              },
              fix: `Review ${filename} for validation errors`,
            }
          );
        }
      }

      this.#logger.debug(
        `LoadFailureValidator: Found ${failureEntries.length} entity definition load failures`
      );
    } catch (error) {
      this.#logValidatorError(error);
    }
  }

  /**
   * Builds detail entries for component validation failures.
   *
   * @description Extracts detailed component validation information from error payloads.
   * @param {Error|object} error - Error object produced during loading.
   * @param {string[]} failedComponents - List of failed component identifiers.
   * @returns {Array<{component: string, issue: string}>} Component validation details.
   */
  #extractComponentValidationDetails(error, failedComponents) {
    if (!Array.isArray(failedComponents) || failedComponents.length === 0) {
      return [];
    }

    const errorString = typeof error?.message === 'string' ? error.message : '';
    const details = [];

    for (const componentId of failedComponents) {
      if (!componentId) {
        continue;
      }

      const enumErrorMatch = errorString.match(
        new RegExp(
          `data/(\\w+) must be equal to one of the allowed values`,
          'i'
        )
      );

      if (enumErrorMatch) {
        details.push({
          component: componentId,
          issue: `Property '${enumErrorMatch[1]}' has an invalid value. Check allowed enum values in the component schema.`,
        });
      } else {
        details.push({
          component: componentId,
          issue: 'Component validation failed. Check schema requirements.',
        });
      }
    }

    return details;
  }
}
