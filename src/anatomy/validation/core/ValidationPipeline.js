import ValidationResultBuilder from './ValidationResultBuilder.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */

const LEGACY_SKIP_FLAGS = {
  'pattern-matching': 'skipPatternValidation',
  'descriptor-coverage': 'skipDescriptorChecks',
  'part-availability': 'skipPartAvailabilityChecks',
  'generated-slot-parts': 'skipGeneratedSlotChecks',
  'load-failures': 'skipLoadFailureChecks',
  'recipe-usage': 'skipRecipeUsageCheck',
};

const VALID_SEVERITIES = new Set(['error', 'warning', 'info']);

/**
 * @description Pipeline orchestrator that executes validators from the registry
 * and aggregates their results using ValidationResultBuilder.
 */
export class ValidationPipeline {
  #registry;
  #logger;
  #configuration;

  /**
   * @description Creates a new validation pipeline.
   * @param {object} params - Constructor params
   * @param {object} params.registry - Validator registry implementing getAll()
   * @param {ILogger} params.logger - Logger instance
   * @param {object} [params.configuration] - Pipeline configuration
   */
  constructor({ registry, logger, configuration = {} }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(registry, 'ValidatorRegistry', logger, {
      requiredMethods: ['getAll'],
    });

    this.#registry = registry;
    this.#logger = logger;
    this.#configuration = this.#normalizeConfiguration(configuration);
  }

  /**
   * @description Execute validators and aggregate their results.
   * @param {object} recipe - Recipe to validate
   * @param {object} [options] - Validation options
   * @returns {Promise<object>} Aggregated validation result
   */
  async execute(recipe, options = {}) {
    const builder = new ValidationResultBuilder(
      recipe.recipeId,
      options.recipePath
    );
    const validators = this.#registry.getAll();

    this.#logger.info(
      `ValidationPipeline: Starting execution for recipe '${recipe.recipeId}' with ${validators.length} validators`
    );

    for (const validator of validators) {
      const validatorConfig = this.#getValidatorConfig(validator.name);
      if (!this.#isValidatorEnabled(validator.name, validatorConfig, options)) {
        this.#logger.debug(
          `ValidationPipeline: Skipping validator '${validator.name}' due to configuration`
        );
        continue;
      }

      this.#logger.debug(
        `ValidationPipeline: Executing validator '${validator.name}' (priority: ${validator.priority})`
      );

      let validatorResult;
      try {
        validatorResult = await validator.validate(recipe, options);
      } catch (error) {
        this.#logger.error(
          `ValidationPipeline: Validator '${validator.name}' threw an exception`,
          error
        );
        builder.addError(
          'VALIDATION_ERROR',
          error.message || 'Validator execution failed',
          {
            validatorName: validator.name,
          }
        );
        if (validator.failFast || options.failFast) {
          this.#logger.warn(
            `ValidationPipeline: Halting after '${validator.name}' due to failFast exception`
          );
          break;
        }
        continue;
      }

      this.#aggregateResult(builder, validatorResult, validatorConfig);

      const hasErrors =
        Array.isArray(validatorResult?.errors) &&
        validatorResult.errors.length > 0;

      if (hasErrors && validator.failFast) {
        // Validator-level failFast cannot be overridden by options.failFast; these
        // guards stop the pipeline before downstream validators run.
        this.#logger.warn(
          `ValidationPipeline: Validator '${validator.name}' halted execution due to failFast errors`
        );
        break;
      }

      if (hasErrors && options.failFast) {
        this.#logger.warn(
          `ValidationPipeline: Halting pipeline after '${validator.name}' due to failFast option`
        );
        break;
      }
    }

    const aggregatedResult = builder.build();

    this.#logger.info(
      `ValidationPipeline: Completed execution for recipe '${recipe.recipeId}' with ${aggregatedResult.errors.length} error(s)`
    );

    return aggregatedResult;
  }

  /**
   * Exposes the total number of registered validators for diagnostics.
   * @returns {number} Count of validators registered with the pipeline.
   */
  getValidatorCount() {
    return typeof this.#registry.count === 'function'
      ? this.#registry.count()
      : this.#registry.getAll().length;
  }

  #normalizeConfiguration(configuration = {}) {
    if (!configuration || typeof configuration !== 'object') {
      return { validators: {} };
    }

    const normalized = { validators: {} };
    const validatorConfig = configuration.validators;

    if (validatorConfig && typeof validatorConfig === 'object') {
      for (const [name, definition] of Object.entries(validatorConfig)) {
        if (!definition || typeof definition !== 'object') {
          continue;
        }

        const normalizedDefinition = {};
        if (typeof definition.enabled === 'boolean') {
          normalizedDefinition.enabled = definition.enabled;
        }

        if (
          definition.severityOverrides &&
          typeof definition.severityOverrides === 'object'
        ) {
          normalizedDefinition.severityOverrides = {
            ...definition.severityOverrides,
          };
        }

        normalized.validators[name] = normalizedDefinition;
      }
    }

    return normalized;
  }

  #getValidatorConfig(name) {
    return this.#configuration.validators?.[name] ?? {};
  }

  #isValidatorEnabled(name, validatorConfig, options) {
    if (typeof validatorConfig.enabled === 'boolean') {
      return validatorConfig.enabled;
    }

    const legacyFlag = LEGACY_SKIP_FLAGS[name];
    if (legacyFlag && options[legacyFlag]) {
      return false;
    }

    return true;
  }

  #aggregateResult(builder, validatorResult, validatorConfig) {
    if (!validatorResult || typeof validatorResult !== 'object') {
      return;
    }

    const overrides = validatorConfig.severityOverrides || {};

    this.#addIssues(builder, validatorResult.errors, 'error', overrides);
    this.#addIssues(builder, validatorResult.warnings, 'warning', overrides);
    this.#addSuggestions(builder, validatorResult.suggestions, overrides);
    this.#addPassed(builder, validatorResult.passed);
  }

  #addIssues(builder, issues, defaultSeverity, overrides) {
    if (!Array.isArray(issues) || issues.length === 0) {
      return;
    }

    const normalizedIssues = issues
      .filter(Boolean)
      .map((issue) =>
        this.#applySeverityOverride(issue, defaultSeverity, overrides)
      )
      .filter((issue) => issue.severity && VALID_SEVERITIES.has(issue.severity));

    if (normalizedIssues.length > 0) {
      builder.addIssues(normalizedIssues);
    }
  }

  #addSuggestions(builder, suggestions, overrides) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return;
    }

    for (const suggestion of suggestions) {
      if (!suggestion) {
        continue;
      }

      const override = overrides[suggestion.type];
      if (override && VALID_SEVERITIES.has(override)) {
        const overriddenSuggestion = {
          ...suggestion,
          severity: override,
        };
        builder.addIssues([overriddenSuggestion]);
        continue;
      }

      const { type, message, ...metadata } = suggestion;
      builder.addSuggestion(type, message, metadata);
    }
  }

  #addPassed(builder, passedEntries) {
    if (!Array.isArray(passedEntries) || passedEntries.length === 0) {
      return;
    }

    for (const entry of passedEntries) {
      if (!entry) {
        continue;
      }
      const { message, ...metadata } = entry;
      const normalizedMessage =
        typeof message === 'string' && message.trim().length > 0
          ? message
          : metadata.check
            ? `Validation passed for '${metadata.check}'`
            : 'Validation passed';
      builder.addPassed(normalizedMessage, metadata);
    }
  }

  #applySeverityOverride(issue, defaultSeverity, overrides) {
    const normalizedIssue = { ...issue };
    const override = overrides[issue?.type];

    if (override && VALID_SEVERITIES.has(override)) {
      normalizedIssue.severity = override;
      return normalizedIssue;
    }

    if (!normalizedIssue.severity && defaultSeverity) {
      normalizedIssue.severity = defaultSeverity;
    }

    return normalizedIssue;
  }
}

export default ValidationPipeline;
