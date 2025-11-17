import fs from 'fs/promises';
import path from 'path';
import { deepFreeze } from '../../../utils/cloneUtils.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */

const SCHEMA_ID =
  'schema://living-narrative-engine/validation-config.schema.json';
const DEFAULT_CONFIG_PATH = 'config/validation-config.json';
const VALID_SEVERITIES = new Set(['error', 'warning', 'info']);

/**
 * @description Loads, validates, and merges validation pipeline configuration.
 */
export class ConfigurationLoader {
  #schemaValidator;
  #logger;
  #defaultConfigPath;

  /**
   * @param {object} params - Constructor parameters.
   * @param {ISchemaValidator} params.schemaValidator - Schema validator dependency.
   * @param {ILogger} params.logger - Logger implementation.
   * @param {string} [params.defaultConfigPath] - Path to the default config file.
   */
  constructor({ schemaValidator, logger, defaultConfigPath = DEFAULT_CONFIG_PATH }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });

    this.#logger = logger;
    this.#schemaValidator = schemaValidator;
    this.#defaultConfigPath = defaultConfigPath;
  }

  /**
   * @description Loads configuration, merges defaults + overrides, and returns immutable payloads.
   * @param {string} [configPath] - Optional path to user configuration.
   * @param {object} [overrides] - Programmatic overrides to merge in last.
   * @returns {Promise<{rawConfig: object, pipelineConfig: object}>}
   */
  async load(configPath, overrides = {}) {
    const defaultPath = this.#resolvePath(this.#defaultConfigPath);
    const requestedPath = configPath
      ? this.#resolvePath(configPath)
      : defaultPath;

    const defaultConfig = await this.#loadConfigFromFile(defaultPath);
    const normalizedDefault = this.merge({}, defaultConfig);

    let userConfigNormalized = null;
    if (requestedPath !== defaultPath) {
      const userConfig = await this.#loadConfigFromFile(requestedPath);
      userConfigNormalized = this.merge({}, userConfig);
    }

    const baseConfig = userConfigNormalized
      ? this.merge(normalizedDefault, userConfigNormalized)
      : normalizedDefault;

    const finalConfig =
      overrides && Object.keys(overrides).length > 0
        ? this.merge(baseConfig, overrides, { overrideHasDefaults: false })
        : baseConfig;

    // Schema validation occurs at file load time (before normalization)
    // No need to re-validate the merged config since all inputs were pre-validated
    const pipelineConfig = this.#buildPipelineConfig(finalConfig);

    return Object.freeze({
      rawConfig: deepFreeze(finalConfig),
      pipelineConfig: deepFreeze(pipelineConfig),
    });
  }

  /**
   * @description Merge base config with overrides using user precedence.
   * @param {object} baseConfig - Default configuration.
   * @param {object} overrideConfig - User overrides.
   * @param options
   * @returns {object} merged configuration.
   */
  merge(baseConfig = {}, overrideConfig = {}, options = {}) {
    const { overrideHasDefaults = true } = options;
    const base = this.#normalizeConfig(baseConfig, true);
    const override = this.#normalizeConfig(overrideConfig, overrideHasDefaults);

    return {
      mods: this.#mergeMods(base.mods, override.mods),
      validators: this.#mergeValidators(base.validators, override.validators),
      errorHandling: this.#mergeErrorHandling(
        base.errorHandling,
        override.errorHandling
      ),
      output: this.#mergeOutput(base.output, override.output),
      features: this.#mergeFeatures(base.features, override.features),
    };
  }

  #normalizeConfig(config, useDefaults) {
    if (!config || typeof config !== 'object') {
      return {
        mods: {},
        validators: [],
        errorHandling: {},
        output: {},
        features: {},
      };
    }

    return {
      mods: this.#cloneIfObject(config.mods) ?? {},
      validators: Array.isArray(config.validators)
        ? config.validators
            .map((validator) =>
              this.#normalizeValidatorEntry(validator, useDefaults)
            )
            .filter(Boolean)
        : [],
      errorHandling: this.#cloneIfObject(config.errorHandling) ?? {},
      output: this.#cloneIfObject(config.output) ?? {},
      features: this.#cloneIfObject(config.features) ?? {},
    };
  }

  #mergeMods(baseMods = {}, overrideMods = {}) {
    const essential = Array.isArray(overrideMods.essential)
      ? [...overrideMods.essential]
      : Array.isArray(baseMods.essential)
        ? [...baseMods.essential]
        : [];

    const optional = Array.isArray(overrideMods.optional)
      ? [...overrideMods.optional]
      : Array.isArray(baseMods.optional)
        ? [...baseMods.optional]
        : [];

    const autoDetect =
      typeof overrideMods.autoDetect === 'boolean'
        ? overrideMods.autoDetect
        : typeof baseMods.autoDetect === 'boolean'
          ? baseMods.autoDetect
          : false;

    return { essential, optional, autoDetect };
  }

  #mergeOutput(baseOutput = {}, overrideOutput = {}) {
    return {
      ...baseOutput,
      ...overrideOutput,
    };
  }

  #mergeErrorHandling(baseErrorHandling = {}, overrideErrorHandling = {}) {
    const merged = {
      ...baseErrorHandling,
      ...overrideErrorHandling,
    };

    merged.severityOverrides = this.#mergeSeverityOverrides(
      baseErrorHandling.severityOverrides,
      overrideErrorHandling.severityOverrides
    );

    if (typeof merged.continueOnError !== 'boolean') {
      merged.continueOnError = false;
    }

    return merged;
  }

  #mergeSeverityOverrides(baseOverrides = {}, overrideOverrides = {}) {
    const merged = new Map();

    for (const [key, severity] of Object.entries(baseOverrides || {})) {
      const normalizedKey = this.#normalizeValidatorName(key);
      if (normalizedKey && VALID_SEVERITIES.has(severity)) {
        merged.set(normalizedKey, severity);
      }
    }

    for (const [key, severity] of Object.entries(overrideOverrides || {})) {
      const normalizedKey = this.#normalizeValidatorName(key);
      if (normalizedKey && VALID_SEVERITIES.has(severity)) {
        merged.set(normalizedKey, severity);
      }
    }

    return Object.fromEntries(merged.entries());
  }

  #mergeValidators(baseValidators = [], overrideValidators = []) {
    const merged = new Map();

    const ingest = (candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return;
      }

      const existing = merged.get(candidate.name);
      if (!existing) {
        merged.set(candidate.name, { ...candidate });
        return;
      }

      const updated = { ...existing };
      if (Object.prototype.hasOwnProperty.call(candidate, 'enabled')) {
        updated.enabled = candidate.enabled;
      }
      if (Object.prototype.hasOwnProperty.call(candidate, 'priority')) {
        updated.priority = candidate.priority;
      }
      if (Object.prototype.hasOwnProperty.call(candidate, 'failFast')) {
        updated.failFast = candidate.failFast;
      }
      if (Object.prototype.hasOwnProperty.call(candidate, 'config')) {
        updated.config = candidate.config;
      }
      merged.set(candidate.name, updated);
    };

    for (const validator of baseValidators || []) {
      ingest(validator);
    }

    for (const validator of overrideValidators || []) {
      ingest(validator);
    }

    return Array.from(merged.values()).sort((a, b) => {
      const priorityA = typeof a.priority === 'number' ? a.priority : Infinity;
      const priorityB = typeof b.priority === 'number' ? b.priority : Infinity;
      if (priorityA === priorityB) {
        return a.name.localeCompare(b.name);
      }
      return priorityA - priorityB;
    });
  }

  #normalizeValidatorEntry(entry, useDefaults) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const normalizedName = this.#normalizeValidatorName(entry.name);
    if (!normalizedName) {
      return null;
    }

    const normalized = { name: normalizedName };

    if (typeof entry.enabled === 'boolean') {
      normalized.enabled = entry.enabled;
    } else if (useDefaults) {
      normalized.enabled = entry.enabled !== false;
    }

    if (typeof entry.priority === 'number') {
      normalized.priority = entry.priority;
    } else if (useDefaults) {
      normalized.priority = Infinity;
    }

    if (typeof entry.failFast === 'boolean') {
      normalized.failFast = entry.failFast;
    } else if (useDefaults) {
      normalized.failFast = entry.failFast === true;
    }

    if (entry.config && typeof entry.config === 'object') {
      normalized.config = this.#cloneIfObject(entry.config);
    }

    return normalized;
  }

  #buildPipelineConfig(config) {
    const severityOverrides = config?.errorHandling?.severityOverrides || {};
    const validators = {};

    for (const validator of config.validators || []) {
      const validatorConfig = {
        enabled: validator.enabled !== false,
        failFast: validator.failFast === true,
      };

      const severityOverride = severityOverrides[validator.name];
      if (severityOverride) {
        validatorConfig.severityOverrides = {
          [validator.name]: severityOverride,
        };
      }

      validators[validator.name] = validatorConfig;
    }

    const pipelineConfig = { validators };

    if (config.errorHandling) {
      pipelineConfig.errorHandling =
        this.#cloneIfObject(config.errorHandling) ?? {};
    }

    if (config.output) {
      pipelineConfig.output = this.#cloneIfObject(config.output) ?? {};
    }

    pipelineConfig.guards = {
      enabled: this.#shouldEnableGuardrails(config),
    };

    return pipelineConfig;
  }

  #mergeFeatures(baseFeatures = {}, overrideFeatures = {}) {
    const merged = {};

    if (typeof baseFeatures.validationPipelineGuards === 'boolean') {
      merged.validationPipelineGuards = baseFeatures.validationPipelineGuards;
    }

    if (typeof overrideFeatures.validationPipelineGuards === 'boolean') {
      merged.validationPipelineGuards = overrideFeatures.validationPipelineGuards;
    }

    return merged;
  }

  #shouldEnableGuardrails(config) {
    if (config?.features && typeof config.features.validationPipelineGuards === 'boolean') {
      return config.features.validationPipelineGuards;
    }

    const envFlag = this.#parseEnvGuardFlag(process?.env?.VALIDATION_PIPELINE_GUARDS);
    if (envFlag !== null) {
      return envFlag;
    }

    if (process?.env?.NODE_ENV === 'test') {
      return true;
    }

    return true;
  }

  #parseEnvGuardFlag(value) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') {
      return true;
    }
    if (normalized === '0' || normalized === 'false') {
      return false;
    }
    return null;
  }

  async #loadConfigFromFile(filePath) {
    try {
      this.#logger.info(
        `ConfigurationLoader: Loading validation config from '${filePath}'`
      );
      const fileContents = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(fileContents);
      await this.#assertSchemaCompliance(parsed, filePath);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        const message = `ConfigurationLoader: Config file not found at '${filePath}'`;
        this.#logger.error(message);
        throw new Error(message);
      }

      if (error instanceof SyntaxError) {
        const message = `ConfigurationLoader: Invalid JSON in '${filePath}': ${error.message}`;
        this.#logger.error(message);
        throw new Error(message);
      }

      throw error;
    }
  }

  async #assertSchemaCompliance(config, sourceLabel) {
    const validationResult = await this.#schemaValidator.validate(
      SCHEMA_ID,
      config
    );

    if (!validationResult?.isValid) {
      const errorDetails = validationResult?.errors || [];
      this.#logger.error(
        `ConfigurationLoader: Schema validation failed for ${sourceLabel}`,
        { errors: errorDetails }
      );
      throw new Error(
        `ConfigurationLoader: Schema validation failed for ${sourceLabel}`
      );
    }
  }

  #resolvePath(candidatePath) {
    if (!candidatePath || typeof candidatePath !== 'string') {
      throw new Error('ConfigurationLoader: config path must be a string');
    }

    return path.isAbsolute(candidatePath)
      ? candidatePath
      : path.resolve(process.cwd(), candidatePath);
  }

  #normalizeValidatorName(name) {
    if (!name || typeof name !== 'string') {
      return null;
    }

    const normalized = name.trim().toLowerCase().replace(/_/g, '-');
    return normalized.length > 0 ? normalized : null;
  }

  #cloneIfObject(value) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value));
  }
}

export default ConfigurationLoader;
