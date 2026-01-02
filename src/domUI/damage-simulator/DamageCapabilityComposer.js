/**
 * @file DamageCapabilityComposer - UI for composing damage capability entries
 * @see damage-capability-entry.schema.json
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../validation/ajvSchemaValidator.js').default} ISchemaValidator */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').default} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/ILogger.js').default} ILogger */

// Schema ID for validation
const DAMAGE_ENTRY_SCHEMA_ID =
  'schema://living-narrative-engine/damage-capability-entry.schema.json';

/**
 * Element IDs for form controls
 *
 * @type {Readonly<Record<string, string>>}
 */
const ELEMENT_IDS = Object.freeze({
  damageType: 'damage-type',
  damageAmount: 'damage-amount',
  damageAmountDisplay: 'damage-amount-display',
  penetrationSlider: 'penetration-slider',
  penetrationValue: 'penetration-value',
  damageMultiplier: 'damage-multiplier',
  customFlags: 'custom-flags',
  validationErrors: 'validation-errors',
  // Effect checkboxes
  effectBleed: 'effect-bleed',
  effectFracture: 'effect-fracture',
  effectBurn: 'effect-burn',
  effectPoison: 'effect-poison',
  effectDismember: 'effect-dismember',
  // Effect configurations
  bleedSeverity: 'bleed-severity',
  bleedDuration: 'bleed-duration',
  fractureThreshold: 'fracture-threshold',
  fractureStunChance: 'fracture-stun-chance',
  burnDps: 'burn-dps',
  burnDuration: 'burn-duration',
  burnCanStack: 'burn-can-stack',
  poisonTickDamage: 'poison-tick-damage',
  poisonDuration: 'poison-duration',
  poisonScope: 'poison-scope',
  dismemberThreshold: 'dismember-threshold',
});

/**
 * CSS classes used by the component
 *
 * @type {Readonly<Record<string, string>>}
 */
const CSS_CLASSES = Object.freeze({
  effectToggle: 'ds-effect-toggle',
  effectConfig: 'ds-effect-config',
  effectConfigExpanded: 'expanded',
  validationErrors: 'ds-validation-errors',
  fieldError: 'ds-field-error',
  formGroup: 'ds-form-group',
});

/**
 * Available damage types
 *
 * @type {Readonly<string[]>}
 */
const DAMAGE_TYPES = Object.freeze([
  'slashing',
  'piercing',
  'blunt',
  'fire',
  'cold',
  'lightning',
  'acid',
  'poison',
  'necrotic',
  'radiant',
]);

/**
 * Bleed severity options
 *
 * @type {Readonly<string[]>}
 */
const BLEED_SEVERITIES = Object.freeze(['minor', 'moderate', 'severe']);

/**
 * Poison scope options
 *
 * @type {Readonly<string[]>}
 */
const POISON_SCOPES = Object.freeze(['part', 'entity']);

/**
 * Event types emitted by the composer
 *
 * @type {Readonly<Record<string, string>>}
 */
const COMPOSER_EVENTS = Object.freeze({
  CONFIG_CHANGED: 'core:damage_composer_config_changed',
  VALIDATION_ERROR: 'core:damage_composer_validation_error',
  VALIDATION_SUCCESS: 'core:damage_composer_validation_success',
});

/**
 * Default configuration matching schema defaults
 *
 * @type {Readonly<object>}
 */
const DEFAULT_CONFIG = Object.freeze({
  name: 'slashing',
  amount: 10,
  penetration: 0.3,
  multiplier: 1,
  flags: [],
  bleed: Object.freeze({
    enabled: false,
    severity: 'minor',
    baseDurationTurns: 2,
  }),
  fracture: Object.freeze({
    enabled: false,
    thresholdFraction: 0.5,
    stunChance: 0.2,
  }),
  burn: Object.freeze({
    enabled: false,
    dps: 1,
    durationTurns: 2,
    canStack: false,
  }),
  poison: Object.freeze({
    enabled: false,
    tickDamage: 1,
    durationTurns: 3,
    scope: 'part',
  }),
  dismember: Object.freeze({
    enabled: false,
    thresholdFraction: 0.8,
  }),
});

/**
 * Effect configurations for building effect config sections
 *
 * @type {Readonly<object[]>}
 */
const EFFECT_CONFIGS = Object.freeze([
  {
    name: 'bleed',
    label: 'Bleed',
    checkboxId: ELEMENT_IDS.effectBleed,
    fields: [
      {
        id: ELEMENT_IDS.bleedSeverity,
        type: 'select',
        label: 'Severity',
        options: BLEED_SEVERITIES,
      },
      {
        id: ELEMENT_IDS.bleedDuration,
        type: 'number',
        label: 'Duration (turns)',
        min: 1,
        defaultValue: 2,
      },
    ],
  },
  {
    name: 'fracture',
    label: 'Fracture',
    checkboxId: ELEMENT_IDS.effectFracture,
    fields: [
      {
        id: ELEMENT_IDS.fractureThreshold,
        type: 'range',
        label: 'Threshold',
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.5,
      },
      {
        id: ELEMENT_IDS.fractureStunChance,
        type: 'range',
        label: 'Stun Chance',
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.2,
      },
    ],
  },
  {
    name: 'burn',
    label: 'Burn',
    checkboxId: ELEMENT_IDS.effectBurn,
    fields: [
      {
        id: ELEMENT_IDS.burnDps,
        type: 'number',
        label: 'DPS',
        min: 0,
        step: 0.1,
        defaultValue: 1,
      },
      {
        id: ELEMENT_IDS.burnDuration,
        type: 'number',
        label: 'Duration (turns)',
        min: 1,
        defaultValue: 2,
      },
      {
        id: ELEMENT_IDS.burnCanStack,
        type: 'checkbox',
        label: 'Can Stack',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'poison',
    label: 'Poison',
    checkboxId: ELEMENT_IDS.effectPoison,
    fields: [
      {
        id: ELEMENT_IDS.poisonTickDamage,
        type: 'number',
        label: 'Tick Damage',
        min: 0,
        step: 0.1,
        defaultValue: 1,
      },
      {
        id: ELEMENT_IDS.poisonDuration,
        type: 'number',
        label: 'Duration (turns)',
        min: 1,
        defaultValue: 3,
      },
      {
        id: ELEMENT_IDS.poisonScope,
        type: 'select',
        label: 'Scope',
        options: POISON_SCOPES,
      },
    ],
  },
  {
    name: 'dismember',
    label: 'Dismember',
    checkboxId: ELEMENT_IDS.effectDismember,
    fields: [
      {
        id: ELEMENT_IDS.dismemberThreshold,
        type: 'range',
        label: 'Threshold',
        min: 0,
        max: 1,
        step: 0.1,
        defaultValue: 0.8,
      },
    ],
  },
]);

/**
 * UI component for composing damage capability entries with real-time schema validation.
 */
class DamageCapabilityComposer {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {ISchemaValidator} */
  #schemaValidator;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {object} */
  #config;

  /** @type {Map<string, HTMLElement>} */
  #elements;

  /** @type {Array<string>} */
  #validationErrors;

  /** @type {number} */
  #multiplier;

  /** @type {boolean} */
  #initialized;

  /**
   * Expose constants for testing
   */
  static ELEMENT_IDS = ELEMENT_IDS;
  static CSS_CLASSES = CSS_CLASSES;
  static DAMAGE_TYPES = DAMAGE_TYPES;
  static COMPOSER_EVENTS = COMPOSER_EVENTS;
  static DEFAULT_CONFIG = DEFAULT_CONFIG;

  /**
   * Create a DamageCapabilityComposer instance.
   *
   * @param {object} dependencies
   * @param {HTMLElement} dependencies.containerElement - Container DOM element for the form
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event bus for communication
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ containerElement, schemaValidator, eventBus, logger }) {
    if (!containerElement || !(containerElement instanceof HTMLElement)) {
      throw new Error(
        'DamageCapabilityComposer: containerElement must be a valid HTMLElement'
      );
    }
    validateDependency(schemaValidator, 'ISchemaValidator', console, {
      requiredMethods: ['validate'],
    });
    validateDependency(eventBus, 'ISafeEventDispatcher', console, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#containerElement = containerElement;
    this.#schemaValidator = schemaValidator;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#config = this.#deepClone(DEFAULT_CONFIG);
    this.#elements = new Map();
    this.#validationErrors = [];
    this.#multiplier = 1;
    this.#initialized = false;
  }

  /**
   * Initialize the form controls.
   * Binds DOM elements, sets up event listeners, and creates effect configuration sections.
   */
  initialize() {
    this.#logger.debug('[DamageCapabilityComposer] Initializing...');

    this.#bindElements();
    this.#populateDamageTypeSelect();
    this.#createEffectConfigSections();
    this.#setupEventListeners();
    this.#updateFormFromConfig();
    this.#createValidationErrorsContainer();

    this.#initialized = true;
    this.#logger.info('[DamageCapabilityComposer] Initialized');
  }

  /**
   * Get the current damage entry configuration.
   * Returns the validated damage entry matching the schema.
   *
   * @returns {object} Validated damage entry
   * @throws {Error} If configuration is invalid
   */
  getDamageEntry() {
    if (!this.#initialized) {
      throw new Error(
        'DamageCapabilityComposer must be initialized before calling getDamageEntry()'
      );
    }
    this.#updateConfigFromForm();

    // Build damage entry (without multiplier and enabled flags)
    const entry = this.#buildDamageEntry();

    // Validate before returning
    const validationResult = this.#schemaValidator.validate(
      DAMAGE_ENTRY_SCHEMA_ID,
      entry
    );

    if (!validationResult.isValid) {
      const errors = validationResult.errors ?? [];
      const errorMessages =
        errors.length > 0
          ? errors.map((e) => e.message).join(', ')
          : 'Unknown validation error';
      const errorMessage = `Invalid damage configuration: ${errorMessages}`;
      this.#logger.error(
        '[DamageCapabilityComposer] getDamageEntry validation failed',
        validationResult.errors
      );
      throw new Error(errorMessage);
    }

    return entry;
  }

  /**
   * Get the damage multiplier value.
   *
   * @returns {number} The current multiplier
   */
  getDamageMultiplier() {
    return this.#multiplier;
  }

  /**
   * Set configuration from external source (e.g., presets).
   * Partial configurations are merged with defaults.
   *
   * @param {object} config - Configuration object to apply
   */
  setConfiguration(config) {
    this.#logger.debug(
      '[DamageCapabilityComposer] Setting configuration',
      config
    );

    // Deep merge with defaults
    this.#config = this.#mergeConfig(this.#deepClone(DEFAULT_CONFIG), config);

    // Extract multiplier if provided
    if (typeof config.multiplier === 'number') {
      this.#multiplier = config.multiplier;
    }

    this.#updateFormFromConfig();
    this.#validate();
    this.#dispatchChange();
  }

  /**
   * Reset form to default values.
   */
  reset() {
    this.#logger.debug('[DamageCapabilityComposer] Resetting to defaults');

    this.#config = this.#deepClone(DEFAULT_CONFIG);
    this.#multiplier = 1;
    this.#validationErrors = [];

    this.#updateFormFromConfig();
    this.#clearValidationErrors();
    this.#dispatchChange();
  }

  /**
   * Check if current configuration is valid.
   *
   * @returns {boolean} True if valid
   */
  isValid() {
    this.#updateConfigFromForm();
    const entry = this.#buildDamageEntry();
    const result = this.#schemaValidator.validate(DAMAGE_ENTRY_SCHEMA_ID, entry);
    return result.isValid;
  }

  /**
   * Get current validation errors.
   *
   * @returns {Array<string>} Array of error messages
   */
  getValidationErrors() {
    return [...this.#validationErrors];
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Bind DOM elements from existing HTML structure.
   *
   * @private
   */
  #bindElements() {
    const findElement = (id) => {
      const element =
        this.#containerElement.querySelector(`#${id}`) ||
        document.getElementById(id);
      if (element) {
        this.#elements.set(id, element);
      }
      return element;
    };

    // Find existing elements
    findElement(ELEMENT_IDS.damageType);
    findElement(ELEMENT_IDS.damageAmount);
    findElement(ELEMENT_IDS.damageAmountDisplay);
    findElement(ELEMENT_IDS.penetrationSlider);
    findElement(ELEMENT_IDS.damageMultiplier);
    findElement(ELEMENT_IDS.customFlags);

    this.#logger.debug(
      `[DamageCapabilityComposer] Bound ${this.#elements.size} existing elements`
    );
  }

  /**
   * Populate the damage type select with options.
   *
   * @private
   */
  #populateDamageTypeSelect() {
    const select = this.#elements.get(ELEMENT_IDS.damageType);
    if (!select) {
      this.#logger.warn(
        '[DamageCapabilityComposer] Damage type select not found'
      );
      return;
    }

    // Clear existing options
    select.innerHTML = '';

    // Add damage type options
    for (const type of DAMAGE_TYPES) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      select.appendChild(option);
    }

    select.disabled = false;
  }

  /**
   * Create expandable effect configuration sections.
   *
   * @private
   */
  #createEffectConfigSections() {
    const effectsFieldset = this.#containerElement.querySelector('fieldset');
    if (!effectsFieldset) {
      this.#logger.warn('[DamageCapabilityComposer] Effects fieldset not found');
      return;
    }

    // Get checkbox group container
    const checkboxGroup = effectsFieldset.querySelector('.ds-checkbox-group');
    if (!checkboxGroup) {
      this.#logger.warn(
        '[DamageCapabilityComposer] Checkbox group not found, using fieldset'
      );
    }

    const container = checkboxGroup || effectsFieldset;

    // Clear existing content and rebuild with configurations
    container.innerHTML = '';

    for (const effectConfig of EFFECT_CONFIGS) {
      const toggleDiv = this.#createEffectToggle(effectConfig);
      container.appendChild(toggleDiv);
    }
  }

  /**
   * Create a single effect toggle with configuration section.
   *
   * @private
   * @param {object} effectConfig - Effect configuration object
   * @returns {HTMLElement} The toggle container element
   */
  #createEffectToggle(effectConfig) {
    const toggleDiv = document.createElement('div');
    toggleDiv.className = CSS_CLASSES.effectToggle;

    // Checkbox label
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = effectConfig.checkboxId;
    checkbox.name = 'effect';
    checkbox.value = effectConfig.name;
    this.#elements.set(effectConfig.checkboxId, checkbox);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${effectConfig.label}`));
    toggleDiv.appendChild(label);

    // Configuration section (hidden by default)
    const configDiv = document.createElement('div');
    configDiv.className = CSS_CLASSES.effectConfig;
    configDiv.setAttribute('data-for', effectConfig.name);

    for (const field of effectConfig.fields) {
      const fieldDiv = this.#createFormField(field);
      configDiv.appendChild(fieldDiv);
    }

    toggleDiv.appendChild(configDiv);

    return toggleDiv;
  }

  /**
   * Create a form field element.
   *
   * @private
   * @param {object} field - Field configuration
   * @returns {HTMLElement} The field container element
   */
  #createFormField(field) {
    const div = document.createElement('div');
    div.className = CSS_CLASSES.formGroup;

    const label = document.createElement('label');
    label.htmlFor = field.id;
    label.textContent = field.label + ': ';

    let input;

    switch (field.type) {
      case 'select': {
        input = document.createElement('select');
        for (const optValue of field.options) {
          const option = document.createElement('option');
          option.value = optValue;
          option.textContent = optValue.charAt(0).toUpperCase() + optValue.slice(1);
          input.appendChild(option);
        }
        break;
      }
      case 'range': {
        input = document.createElement('input');
        input.type = 'range';
        input.min = String(field.min);
        input.max = String(field.max);
        input.step = String(field.step);
        input.value = String(field.defaultValue);

        // Add value display
        const valueDisplay = document.createElement('span');
        valueDisplay.id = `${field.id}-value`;
        valueDisplay.className = 'ds-value-display';
        valueDisplay.textContent = String(field.defaultValue);
        this.#elements.set(`${field.id}-value`, valueDisplay);
        label.appendChild(valueDisplay);
        break;
      }
      case 'checkbox': {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = field.defaultValue;
        break;
      }
      case 'number':
      default: {
        input = document.createElement('input');
        input.type = 'number';
        // All number fields in EFFECT_CONFIGS have min and step defined
        input.min = String(field.min);
        input.step = String(field.step);
        input.value = String(field.defaultValue);
        break;
      }
    }

    input.id = field.id;
    this.#elements.set(field.id, input);

    div.appendChild(label);
    div.appendChild(input);

    return div;
  }

  /**
   * Create the validation errors container.
   *
   * @private
   */
  #createValidationErrorsContainer() {
    // Check if validation errors container already exists
    let errorsDiv = this.#containerElement.querySelector(
      `#${ELEMENT_IDS.validationErrors}`
    );

    if (!errorsDiv) {
      errorsDiv = document.createElement('div');
      errorsDiv.id = ELEMENT_IDS.validationErrors;
      errorsDiv.className = CSS_CLASSES.validationErrors;
      this.#containerElement.appendChild(errorsDiv);
    }

    this.#elements.set(ELEMENT_IDS.validationErrors, errorsDiv);
  }

  /**
   * Setup event listeners for form controls.
   *
   * @private
   */
  #setupEventListeners() {
    // Damage type change
    const damageType = this.#elements.get(ELEMENT_IDS.damageType);
    if (damageType) {
      damageType.addEventListener('change', () => this.#handleInputChange());
    }

    // Damage amount change
    const damageAmount = this.#elements.get(ELEMENT_IDS.damageAmount);
    if (damageAmount) {
      damageAmount.addEventListener('input', () => {
        this.#updateAmountDisplay();
        this.#handleInputChange();
      });
    }

    // Effect checkboxes
    for (const effectConfig of EFFECT_CONFIGS) {
      const checkbox = this.#elements.get(effectConfig.checkboxId);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          this.#toggleEffectConfig(effectConfig.name, e.target.checked);
          this.#handleInputChange();
        });
      }

      // Effect field changes
      for (const field of effectConfig.fields) {
        const element = this.#elements.get(field.id);
        if (element) {
          element.addEventListener('input', () => {
            if (field.type === 'range') {
              this.#updateRangeDisplay(field.id);
            }
            this.#handleInputChange();
          });
          element.addEventListener('change', () => this.#handleInputChange());
        }
      }
    }

    // Penetration slider
    const penetration = this.#elements.get(ELEMENT_IDS.penetrationSlider);
    if (penetration) {
      penetration.addEventListener('input', () => {
        this.#updateRangeDisplay(ELEMENT_IDS.penetrationSlider);
        this.#handleInputChange();
      });
    }

    // Multiplier
    const multiplier = this.#elements.get(ELEMENT_IDS.damageMultiplier);
    if (multiplier) {
      multiplier.addEventListener('input', () => this.#handleInputChange());
    }

    // Custom flags
    const flags = this.#elements.get(ELEMENT_IDS.customFlags);
    if (flags) {
      flags.addEventListener('input', () => this.#handleInputChange());
    }
  }

  /**
   * Handle any input change event.
   *
   * @private
   */
  #handleInputChange() {
    this.#updateConfigFromForm();
    this.#validate();
    this.#dispatchChange();
  }

  /**
   * Update the amount display element.
   *
   * @private
   */
  #updateAmountDisplay() {
    const slider = this.#elements.get(ELEMENT_IDS.damageAmount);
    const display = this.#elements.get(ELEMENT_IDS.damageAmountDisplay);
    if (slider && display) {
      display.textContent = slider.value;
    }
  }

  /**
   * Update a range slider's value display.
   *
   * @private
   * @param {string} sliderId - ID of the range slider
   */
  #updateRangeDisplay(sliderId) {
    const slider = this.#elements.get(sliderId);
    const display = this.#elements.get(`${sliderId}-value`);
    if (slider && display) {
      display.textContent = slider.value;
    }
  }

  /**
   * Update form controls from internal config.
   *
   * @private
   */
  #updateFormFromConfig() {
    // Damage type
    const damageType = this.#elements.get(ELEMENT_IDS.damageType);
    if (damageType) {
      damageType.value = this.#config.name;
    }

    // Damage amount
    const damageAmount = this.#elements.get(ELEMENT_IDS.damageAmount);
    if (damageAmount) {
      damageAmount.value = String(this.#config.amount);
      damageAmount.disabled = false;
      this.#updateAmountDisplay();
    }

    // Penetration
    const penetration = this.#elements.get(ELEMENT_IDS.penetrationSlider);
    if (penetration) {
      penetration.value = String(this.#config.penetration);
      this.#updateRangeDisplay(ELEMENT_IDS.penetrationSlider);
    }

    // Multiplier
    const multiplier = this.#elements.get(ELEMENT_IDS.damageMultiplier);
    if (multiplier) {
      multiplier.value = String(this.#multiplier);
    }

    // Custom flags
    const flags = this.#elements.get(ELEMENT_IDS.customFlags);
    if (flags && this.#config.flags) {
      flags.value = this.#config.flags.join(', ');
    }

    // Effects
    this.#updateEffectFromConfig('bleed', {
      severity: ELEMENT_IDS.bleedSeverity,
      baseDurationTurns: ELEMENT_IDS.bleedDuration,
    });

    this.#updateEffectFromConfig('fracture', {
      thresholdFraction: ELEMENT_IDS.fractureThreshold,
      stunChance: ELEMENT_IDS.fractureStunChance,
    });

    this.#updateEffectFromConfig('burn', {
      dps: ELEMENT_IDS.burnDps,
      durationTurns: ELEMENT_IDS.burnDuration,
      canStack: ELEMENT_IDS.burnCanStack,
    });

    this.#updateEffectFromConfig('poison', {
      tickDamage: ELEMENT_IDS.poisonTickDamage,
      durationTurns: ELEMENT_IDS.poisonDuration,
      scope: ELEMENT_IDS.poisonScope,
    });

    this.#updateEffectFromConfig('dismember', {
      thresholdFraction: ELEMENT_IDS.dismemberThreshold,
    });

    // Enable the apply button
    const applyBtn = this.#containerElement.querySelector('#apply-damage-btn');
    if (applyBtn) {
      applyBtn.disabled = false;
    }

    // Enable the effects fieldset
    const fieldset = this.#containerElement.querySelector('fieldset');
    if (fieldset) {
      fieldset.disabled = false;
    }
  }

  /**
   * Update a single effect's form controls from config.
   *
   * @private
   * @param {string} effectName - Effect name
   * @param {object} fieldMap - Map of config property to element ID
   */
  #updateEffectFromConfig(effectName, fieldMap) {
    // effectConfig is guaranteed to exist - initialized from DEFAULT_CONFIG
    const effectConfig = this.#config[effectName];

    // effectDef is guaranteed to exist - only called with hardcoded valid effect names
    const effectDef = EFFECT_CONFIGS.find((e) => e.name === effectName);

    // Update checkbox
    const checkbox = this.#elements.get(effectDef.checkboxId);
    if (checkbox) {
      checkbox.checked = effectConfig.enabled;
      this.#toggleEffectConfig(effectName, effectConfig.enabled);
    }

    // Update fields
    for (const [configKey, elementId] of Object.entries(fieldMap)) {
      const element = this.#elements.get(elementId);
      if (element && effectConfig[configKey] !== undefined) {
        if (element.type === 'checkbox') {
          element.checked = effectConfig[configKey];
        } else {
          element.value = String(effectConfig[configKey]);
          // Update range display if applicable
          if (element.type === 'range') {
            this.#updateRangeDisplay(elementId);
          }
        }
      }
    }
  }

  /**
   * Update internal config from form controls.
   *
   * @private
   */
  #updateConfigFromForm() {
    // Damage type
    const damageType = this.#elements.get(ELEMENT_IDS.damageType);
    if (damageType) {
      this.#config.name = damageType.value;
    }

    // Damage amount
    const damageAmount = this.#elements.get(ELEMENT_IDS.damageAmount);
    if (damageAmount) {
      this.#config.amount = parseFloat(damageAmount.value) || 0;
    }

    // Penetration
    const penetration = this.#elements.get(ELEMENT_IDS.penetrationSlider);
    if (penetration) {
      this.#config.penetration = parseFloat(penetration.value) || 0;
    }

    // Multiplier
    const multiplier = this.#elements.get(ELEMENT_IDS.damageMultiplier);
    if (multiplier) {
      this.#multiplier = parseFloat(multiplier.value) || 1;
    }

    // Custom flags
    const flags = this.#elements.get(ELEMENT_IDS.customFlags);
    if (flags) {
      this.#config.flags = this.#parseFlags(flags.value);
    }

    // Effects
    this.#updateEffectConfigFromForm('bleed', {
      severity: ELEMENT_IDS.bleedSeverity,
      baseDurationTurns: ELEMENT_IDS.bleedDuration,
    });

    this.#updateEffectConfigFromForm('fracture', {
      thresholdFraction: ELEMENT_IDS.fractureThreshold,
      stunChance: ELEMENT_IDS.fractureStunChance,
    });

    this.#updateEffectConfigFromForm('burn', {
      dps: ELEMENT_IDS.burnDps,
      durationTurns: ELEMENT_IDS.burnDuration,
      canStack: ELEMENT_IDS.burnCanStack,
    });

    this.#updateEffectConfigFromForm('poison', {
      tickDamage: ELEMENT_IDS.poisonTickDamage,
      durationTurns: ELEMENT_IDS.poisonDuration,
      scope: ELEMENT_IDS.poisonScope,
    });

    this.#updateEffectConfigFromForm('dismember', {
      thresholdFraction: ELEMENT_IDS.dismemberThreshold,
    });
  }

  /**
   * Update a single effect config from form controls.
   *
   * @private
   * @param {string} effectName - Effect name
   * @param {object} fieldMap - Map of config property to element ID
   */
  #updateEffectConfigFromForm(effectName, fieldMap) {
    // effectDef is guaranteed to exist - only called with hardcoded valid effect names
    const effectDef = EFFECT_CONFIGS.find((e) => e.name === effectName);

    // Guard against missing checkbox (defensive programming)
    const checkbox = this.#elements.get(effectDef.checkboxId);
    if (!checkbox) {
      this.#logger.warn(
        `[DamageCapabilityComposer] Missing checkbox for effect: ${effectName}`
      );
      return; // Skip this effect if element not found
    }
    // Note: this.#config[effectName] is always populated from DEFAULT_CONFIG
    // via constructor, reset(), or setConfiguration()
    this.#config[effectName].enabled = checkbox.checked;

    for (const [configKey, elementId] of Object.entries(fieldMap)) {
      // Guard against missing element (defensive programming)
      const element = this.#elements.get(elementId);
      if (!element) {
        this.#logger.warn(
          `[DamageCapabilityComposer] Missing element for ${effectName}.${configKey}: ${elementId}`
        );
        continue; // Skip this field if element not found
      }
      if (element.type === 'checkbox') {
        this.#config[effectName][configKey] = element.checked;
      } else if (element.tagName === 'SELECT') {
        this.#config[effectName][configKey] = element.value;
      } else {
        // Number or range
        const parsed = parseFloat(element.value);
        // For integer fields, ensure integer type
        if (
          configKey === 'baseDurationTurns' ||
          configKey === 'durationTurns'
        ) {
          this.#config[effectName][configKey] = Math.round(parsed) || 1;
        } else {
          this.#config[effectName][configKey] = parsed || 0;
        }
      }
    }
  }

  /**
   * Parse comma-separated flags string.
   *
   * @private
   * @param {string} value - Comma-separated flags
   * @returns {string[]} Array of trimmed, non-empty flags
   */
  #parseFlags(value) {
    if (!value || typeof value !== 'string') {
      return [];
    }
    return value
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  /**
   * Build the damage entry object from config.
   *
   * @private
   * @returns {object} Damage entry matching schema
   */
  #buildDamageEntry() {
    const entry = {
      name: this.#config.name,
      amount: this.#config.amount,
    };

    // Only include penetration if non-zero (optional in schema)
    if (this.#config.penetration > 0) {
      entry.penetration = this.#config.penetration;
    }

    // Include effects only if enabled
    if (this.#config.bleed?.enabled) {
      entry.bleed = {
        enabled: true,
        severity: this.#config.bleed.severity,
        baseDurationTurns: this.#config.bleed.baseDurationTurns,
      };
    }

    if (this.#config.fracture?.enabled) {
      entry.fracture = {
        enabled: true,
        thresholdFraction: this.#config.fracture.thresholdFraction,
        stunChance: this.#config.fracture.stunChance,
      };
    }

    if (this.#config.burn?.enabled) {
      entry.burn = {
        enabled: true,
        dps: this.#config.burn.dps,
        durationTurns: this.#config.burn.durationTurns,
        canStack: this.#config.burn.canStack,
      };
    }

    if (this.#config.poison?.enabled) {
      entry.poison = {
        enabled: true,
        tickDamage: this.#config.poison.tickDamage,
        durationTurns: this.#config.poison.durationTurns,
        scope: this.#config.poison.scope,
      };
    }

    if (this.#config.dismember?.enabled) {
      entry.dismember = {
        enabled: true,
        thresholdFraction: this.#config.dismember.thresholdFraction,
      };
    }

    // Include flags only if non-empty
    if (this.#config.flags && this.#config.flags.length > 0) {
      entry.flags = [...this.#config.flags];
    }

    return entry;
  }

  /**
   * Validate current configuration against schema.
   *
   * @private
   */
  #validate() {
    const entry = this.#buildDamageEntry();
    const result = this.#schemaValidator.validate(DAMAGE_ENTRY_SCHEMA_ID, entry);

    if (result.isValid) {
      this.#validationErrors = [];
      this.#clearValidationErrors();
      this.#eventBus.dispatch(COMPOSER_EVENTS.VALIDATION_SUCCESS, { entry });
    } else {
      this.#validationErrors = result.errors?.map((e) => e.message) || [];
      this.#showValidationErrors(this.#validationErrors);
      this.#eventBus.dispatch(COMPOSER_EVENTS.VALIDATION_ERROR, {
        errors: this.#validationErrors,
      });
    }
  }

  /**
   * Dispatch config changed event.
   *
   * @private
   */
  #dispatchChange() {
    this.#eventBus.dispatch(COMPOSER_EVENTS.CONFIG_CHANGED, {
      config: this.#deepClone(this.#config),
      multiplier: this.#multiplier,
      isValid: this.#validationErrors.length === 0,
    });
  }

  /**
   * Show validation errors in the UI.
   *
   * @private
   * @param {string[]} errors - Error messages
   */
  #showValidationErrors(errors) {
    // Container is guaranteed to exist - created during initialize()
    const container = this.#elements.get(ELEMENT_IDS.validationErrors);

    container.innerHTML = '';

    for (const error of errors) {
      const errorDiv = document.createElement('div');
      errorDiv.textContent = error;
      container.appendChild(errorDiv);
    }
  }

  /**
   * Clear validation errors from the UI.
   *
   * @private
   */
  #clearValidationErrors() {
    // Container is guaranteed to exist - created during initialize()
    const container = this.#elements.get(ELEMENT_IDS.validationErrors);
    container.innerHTML = '';
  }

  /**
   * Toggle effect configuration visibility.
   *
   * @private
   * @param {string} effectName - Effect name
   * @param {boolean} enabled - Whether effect is enabled
   */
  #toggleEffectConfig(effectName, enabled) {
    const configDiv = this.#containerElement.querySelector(
      `.${CSS_CLASSES.effectConfig}[data-for="${effectName}"]`
    );

    if (configDiv) {
      if (enabled) {
        configDiv.classList.add(CSS_CLASSES.effectConfigExpanded);
      } else {
        configDiv.classList.remove(CSS_CLASSES.effectConfigExpanded);
      }
    }
  }

  /**
   * Deep clone an object.
   *
   * @private
   * @param {object} obj - Object to clone
   * @returns {object} Cloned object
   */
  #deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Deep merge two objects.
   *
   * @private
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  #mergeConfig(target, source) {
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) {
          target[key] = {};
        }
        this.#mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
}

export default DamageCapabilityComposer;
