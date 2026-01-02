/**
 * @file DamageCapabilityComposer.test.js
 * @description Unit tests for DamageCapabilityComposer component
 */

import DamageCapabilityComposer from '../../../../src/domUI/damage-simulator/DamageCapabilityComposer.js';
import { jest } from '@jest/globals';

describe('DamageCapabilityComposer', () => {
  let mockLogger;
  let mockSchemaValidator;
  let mockEventBus;
  let mockContainer;
  let composer;

  // Constants from the class
  const { ELEMENT_IDS, CSS_CLASSES, DAMAGE_TYPES, COMPOSER_EVENTS, DEFAULT_CONFIG } =
    DamageCapabilityComposer;

  /**
   * Create a complete mock DOM structure for the composer
   */
  const createMockContainer = () => {
    const container = document.createElement('div');
    container.id = 'damage-form';

    // Create basic form elements
    const damageTypeSelect = document.createElement('select');
    damageTypeSelect.id = ELEMENT_IDS.damageType;
    container.appendChild(damageTypeSelect);

    const damageAmountInput = document.createElement('input');
    damageAmountInput.type = 'range';
    damageAmountInput.id = ELEMENT_IDS.damageAmount;
    damageAmountInput.min = '0';
    damageAmountInput.max = '100';
    damageAmountInput.value = '10';
    container.appendChild(damageAmountInput);

    const damageAmountDisplay = document.createElement('span');
    damageAmountDisplay.id = ELEMENT_IDS.damageAmountDisplay;
    container.appendChild(damageAmountDisplay);

    const penetrationSlider = document.createElement('input');
    penetrationSlider.type = 'range';
    penetrationSlider.id = ELEMENT_IDS.penetrationSlider;
    penetrationSlider.min = '0';
    penetrationSlider.max = '1';
    penetrationSlider.step = '0.1';
    penetrationSlider.value = '0.3';
    container.appendChild(penetrationSlider);

    const penetrationValue = document.createElement('span');
    penetrationValue.id = ELEMENT_IDS.penetrationValue;
    container.appendChild(penetrationValue);

    const damageMultiplier = document.createElement('input');
    damageMultiplier.type = 'number';
    damageMultiplier.id = ELEMENT_IDS.damageMultiplier;
    damageMultiplier.min = '0';
    damageMultiplier.step = '0.1';
    damageMultiplier.value = '1';
    container.appendChild(damageMultiplier);

    const customFlags = document.createElement('input');
    customFlags.type = 'text';
    customFlags.id = ELEMENT_IDS.customFlags;
    container.appendChild(customFlags);

    // Create effects group container for dynamic effect configs
    // Note: The composer will create its own effect checkboxes inside this fieldset
    const effectsGroup = document.createElement('fieldset');
    effectsGroup.className = 'ds-effects-group';
    container.appendChild(effectsGroup);

    return container;
  };

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock schema validator - valid by default
    mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true, errors: null }),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Create mock container with all required elements
    mockContainer = createMockContainer();
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    if (mockContainer?.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should validate dependencies in constructor', () => {
      // Missing containerElement
      expect(
        () =>
          new DamageCapabilityComposer({
            schemaValidator: mockSchemaValidator,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow('containerElement must be a valid HTMLElement');

      // Null containerElement
      expect(
        () =>
          new DamageCapabilityComposer({
            containerElement: null,
            schemaValidator: mockSchemaValidator,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow('containerElement must be a valid HTMLElement');

      // Invalid containerElement (not HTMLElement)
      expect(
        () =>
          new DamageCapabilityComposer({
            containerElement: 'not-an-element',
            schemaValidator: mockSchemaValidator,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow('containerElement must be a valid HTMLElement');

      // Missing schemaValidator
      expect(
        () =>
          new DamageCapabilityComposer({
            containerElement: mockContainer,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();

      // Missing eventBus
      expect(
        () =>
          new DamageCapabilityComposer({
            containerElement: mockContainer,
            schemaValidator: mockSchemaValidator,
            logger: mockLogger,
          })
      ).toThrow();

      // Missing logger
      expect(
        () =>
          new DamageCapabilityComposer({
            containerElement: mockContainer,
            schemaValidator: mockSchemaValidator,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create instance with valid dependencies', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      expect(composer).toBeInstanceOf(DamageCapabilityComposer);
    });
  });

  describe('initialize()', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
    });

    it('should render all form controls', () => {
      composer.initialize();

      // Check that damage type select is populated
      const damageTypeSelect = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageType}`
      );
      expect(damageTypeSelect).not.toBeNull();
      expect(damageTypeSelect.children.length).toBe(DAMAGE_TYPES.length);

      // Check that damage amount controls exist
      const damageAmount = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      expect(damageAmount).not.toBeNull();

      // Check that penetration controls exist
      const penetration = mockContainer.querySelector(
        `#${ELEMENT_IDS.penetrationSlider}`
      );
      expect(penetration).not.toBeNull();

      // Check that effect checkboxes exist
      expect(
        mockContainer.querySelector(`#${ELEMENT_IDS.effectBleed}`)
      ).not.toBeNull();
      expect(
        mockContainer.querySelector(`#${ELEMENT_IDS.effectFracture}`)
      ).not.toBeNull();
      expect(
        mockContainer.querySelector(`#${ELEMENT_IDS.effectBurn}`)
      ).not.toBeNull();
      expect(
        mockContainer.querySelector(`#${ELEMENT_IDS.effectPoison}`)
      ).not.toBeNull();
      expect(
        mockContainer.querySelector(`#${ELEMENT_IDS.effectDismember}`)
      ).not.toBeNull();

      // Check logger was called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Initializing')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialized')
      );
    });

    it('should populate damage type select with all damage types', () => {
      composer.initialize();

      const damageTypeSelect = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageType}`
      );
      const options = Array.from(damageTypeSelect.options);

      expect(options.length).toBe(DAMAGE_TYPES.length);
      DAMAGE_TYPES.forEach((type, index) => {
        expect(options[index].value).toBe(type);
      });
    });
  });

  describe('Event emission', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should emit change event on any input change', () => {
      // Get damage amount input and change it
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '50';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.CONFIG_CHANGED,
        expect.any(Object)
      );
    });

    it('should dispatch validation-success when config is valid', () => {
      // Trigger a change to cause validation
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '25';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.VALIDATION_SUCCESS,
        expect.any(Object)
      );
    });

    it('should dispatch validation-error when config is invalid', () => {
      // Configure schema validator to return invalid
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid field' }],
      });

      // Trigger a change to cause validation
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '50';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.VALIDATION_ERROR,
        expect.any(Object)
      );
    });
  });

  describe('Schema validation', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should validate against damage-capability-entry schema', () => {
      // Trigger validation by getting damage entry
      composer.getDamageEntry();

      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/damage-capability-entry.schema.json',
        expect.any(Object)
      );
    });

    it('should show validation errors for invalid config', () => {
      // Configure schema validator to return invalid
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ message: 'amount must be a number' }],
      });

      // Trigger a change to cause validation
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '50';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Check that validation errors are displayed
      const errors = composer.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(composer.isValid()).toBe(false);
    });
  });

  describe('Effect toggle configuration', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should expand effect configuration when effect enabled', () => {
      // Get bleed checkbox and enable it
      const bleedCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectBleed}`
      );
      bleedCheckbox.checked = true;
      bleedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Check that the config section is expanded
      const bleedConfig = mockContainer.querySelector('[data-for="bleed"]');
      expect(bleedConfig).toBeTruthy();
      expect(
        bleedConfig.classList.contains(CSS_CLASSES.effectConfigExpanded)
      ).toBe(true);

      // Verify event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.CONFIG_CHANGED,
        expect.any(Object)
      );
    });

    it('should collapse effect configuration when effect disabled', () => {
      // Enable then disable bleed
      const bleedCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectBleed}`
      );

      // Enable
      bleedCheckbox.checked = true;
      bleedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Disable
      bleedCheckbox.checked = false;
      bleedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Check that the config section is collapsed
      const bleedConfig = mockContainer.querySelector('[data-for="bleed"]');
      expect(bleedConfig).toBeTruthy();
      expect(
        bleedConfig.classList.contains(CSS_CLASSES.effectConfigExpanded)
      ).toBe(false);
    });
  });

  describe('getDamageEntry()', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should provide valid damage entry on getDamageEntry()', () => {
      const entry = composer.getDamageEntry();

      expect(entry).toHaveProperty('name', DEFAULT_CONFIG.name);
      expect(entry).toHaveProperty('amount', DEFAULT_CONFIG.amount);
      expect(entry).toHaveProperty('penetration');
      expect(mockSchemaValidator.validate).toHaveBeenCalled();
    });

    it('should throw error when configuration is invalid', () => {
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid configuration' }],
      });

      expect(() => composer.getDamageEntry()).toThrow(
        'Invalid damage configuration'
      );
    });

    it('should handle edge cases (0 damage, 0 penetration)', () => {
      // Set damage to 0
      const damageInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageInput.value = '0';
      damageInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Set penetration to 0
      const penetrationSlider = mockContainer.querySelector(
        `#${ELEMENT_IDS.penetrationSlider}`
      );
      penetrationSlider.value = '0';
      penetrationSlider.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();

      expect(entry.amount).toBe(0);
      // Penetration is omitted from entry when 0 (optional in schema)
      expect(entry.penetration).toBeUndefined();
    });
  });

  describe('Custom flags parsing', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should parse custom flags from comma-separated input', () => {
      const customFlagsInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.customFlags}`
      );
      customFlagsInput.value = 'magical, silver, holy';
      customFlagsInput.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();

      expect(entry.flags).toEqual(['magical', 'silver', 'holy']);
    });

    it('should handle empty custom flags', () => {
      const customFlagsInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.customFlags}`
      );
      customFlagsInput.value = '';
      customFlagsInput.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();

      // flags should be undefined or empty array when no flags
      expect(entry.flags === undefined || entry.flags.length === 0).toBe(true);
    });

    it('should trim whitespace from custom flags', () => {
      const customFlagsInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.customFlags}`
      );
      customFlagsInput.value = '  fire  ,   ice  ,  lightning  ';
      customFlagsInput.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();

      expect(entry.flags).toEqual(['fire', 'ice', 'lightning']);
    });
  });

  describe('Damage multiplier', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should apply damage multiplier correctly', () => {
      const multiplierInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageMultiplier}`
      );
      multiplierInput.value = '2.5';
      multiplierInput.dispatchEvent(new Event('input', { bubbles: true }));

      const multiplier = composer.getDamageMultiplier();

      expect(multiplier).toBe(2.5);
    });

    it('should default multiplier to 1', () => {
      const multiplier = composer.getDamageMultiplier();
      expect(multiplier).toBe(1);
    });
  });

  describe('setConfiguration()', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should handle setConfiguration with partial config', () => {
      const partialConfig = {
        name: 'fire',
        amount: 50,
      };

      composer.setConfiguration(partialConfig);

      const entry = composer.getDamageEntry();

      expect(entry.name).toBe('fire');
      expect(entry.amount).toBe(50);
      // Other values should remain at defaults
      expect(entry.penetration).toBe(DEFAULT_CONFIG.penetration);
    });

    it('should handle setConfiguration with effect configs', () => {
      const configWithEffects = {
        name: 'slashing',
        amount: 25,
        bleed: {
          enabled: true,
          severity: 'severe',
          baseDurationTurns: 5,
        },
      };

      composer.setConfiguration(configWithEffects);

      const entry = composer.getDamageEntry();

      expect(entry.bleed).toBeDefined();
      expect(entry.bleed.severity).toBe('severe');
      expect(entry.bleed.baseDurationTurns).toBe(5);
    });
  });

  describe('reset()', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should reset to defaults on reset()', () => {
      // Change some values
      const damageInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageInput.value = '75';
      damageInput.dispatchEvent(new Event('input', { bubbles: true }));

      const damageTypeSelect = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageType}`
      );
      damageTypeSelect.value = 'fire';
      damageTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Reset
      composer.reset();

      const entry = composer.getDamageEntry();

      expect(entry.name).toBe(DEFAULT_CONFIG.name);
      expect(entry.amount).toBe(DEFAULT_CONFIG.amount);
      expect(entry.penetration).toBe(DEFAULT_CONFIG.penetration);
    });

    it('should clear validation errors on reset', () => {
      // Force validation error
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ message: 'Error' }],
      });

      const damageInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageInput.value = '50';
      damageInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(composer.getValidationErrors().length).toBeGreaterThan(0);

      // Reset validator to valid state and reset composer
      mockSchemaValidator.validate.mockReturnValue({ valid: true, errors: null });
      composer.reset();

      expect(composer.getValidationErrors()).toEqual([]);
    });

    it('should reset multiplier to 1 on reset()', () => {
      const multiplierInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageMultiplier}`
      );
      multiplierInput.value = '3';
      multiplierInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(composer.getDamageMultiplier()).toBe(3);

      composer.reset();

      expect(composer.getDamageMultiplier()).toBe(1);
    });
  });

  describe('isValid() and getValidationErrors()', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should return true when configuration is valid', () => {
      expect(composer.isValid()).toBe(true);
      expect(composer.getValidationErrors()).toEqual([]);
    });

    it('should return false when configuration is invalid', () => {
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ message: 'Test error' }],
      });

      // Trigger validation
      const damageInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageInput.value = '50';
      damageInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(composer.isValid()).toBe(false);
      expect(composer.getValidationErrors().length).toBeGreaterThan(0);
    });
  });

  describe('Static exports', () => {
    it('should expose ELEMENT_IDS constant', () => {
      expect(DamageCapabilityComposer.ELEMENT_IDS).toBeDefined();
      expect(DamageCapabilityComposer.ELEMENT_IDS.damageType).toBe('damage-type');
    });

    it('should expose CSS_CLASSES constant', () => {
      expect(DamageCapabilityComposer.CSS_CLASSES).toBeDefined();
      expect(DamageCapabilityComposer.CSS_CLASSES.effectToggle).toBe(
        'ds-effect-toggle'
      );
    });

    it('should expose DAMAGE_TYPES constant', () => {
      expect(DamageCapabilityComposer.DAMAGE_TYPES).toBeDefined();
      expect(DamageCapabilityComposer.DAMAGE_TYPES).toContain('slashing');
      expect(DamageCapabilityComposer.DAMAGE_TYPES).toContain('fire');
    });

    it('should expose COMPOSER_EVENTS constant', () => {
      expect(DamageCapabilityComposer.COMPOSER_EVENTS).toBeDefined();
      expect(DamageCapabilityComposer.COMPOSER_EVENTS.CONFIG_CHANGED).toBe(
        'damage-composer:config-changed'
      );
    });

    it('should expose DEFAULT_CONFIG constant', () => {
      expect(DamageCapabilityComposer.DEFAULT_CONFIG).toBeDefined();
      expect(DamageCapabilityComposer.DEFAULT_CONFIG.name).toBe('slashing');
      expect(DamageCapabilityComposer.DEFAULT_CONFIG.amount).toBe(10);
      expect(DamageCapabilityComposer.DEFAULT_CONFIG.penetration).toBe(0.3);
    });
  });

  describe('DEFAULT_CONFIG matches schema defaults', () => {
    it('should have correct bleed defaults from schema', () => {
      expect(DEFAULT_CONFIG.bleed.baseDurationTurns).toBe(2);
      expect(DEFAULT_CONFIG.bleed.severity).toBe('minor');
    });

    it('should have correct fracture defaults from schema', () => {
      expect(DEFAULT_CONFIG.fracture.stunChance).toBe(0.2);
      expect(DEFAULT_CONFIG.fracture.thresholdFraction).toBe(0.5);
    });

    it('should have correct burn defaults from schema', () => {
      expect(DEFAULT_CONFIG.burn.durationTurns).toBe(2);
      expect(DEFAULT_CONFIG.burn.dps).toBe(1);
      expect(DEFAULT_CONFIG.burn.canStack).toBe(false);
    });

    it('should have correct poison defaults from schema', () => {
      expect(DEFAULT_CONFIG.poison.durationTurns).toBe(3);
      expect(DEFAULT_CONFIG.poison.tickDamage).toBe(1);
      expect(DEFAULT_CONFIG.poison.scope).toBe('part');
    });

    it('should have correct dismember defaults from schema', () => {
      expect(DEFAULT_CONFIG.dismember.thresholdFraction).toBe(0.8);
    });
  });

  // ========================================
  // NEW TESTS FOR 100% COVERAGE
  // ========================================

  describe('Missing DOM elements handling', () => {
    it('should handle missing damage type select gracefully', () => {
      // IMPORTANT: Remove the main mockContainer to prevent document.getElementById fallback
      // from finding the damageType select that exists in the global mock container
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      // Create container with only a fieldset (no damage type select)
      const minimalContainer = document.createElement('div');
      const fieldset = document.createElement('fieldset');
      minimalContainer.appendChild(fieldset);
      document.body.appendChild(minimalContainer);

      // Create fresh logger mock to check specific warnings
      const testLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };

      const minimalComposer = new DamageCapabilityComposer({
        containerElement: minimalContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: testLogger,
      });

      expect(() => minimalComposer.initialize()).not.toThrow();
      // Check that the specific warning was logged
      const warnCalls = testLogger.warn.mock.calls.map((call) => call[0]);
      expect(warnCalls).toContain(
        '[DamageCapabilityComposer] Damage type select not found'
      );

      document.body.removeChild(minimalContainer);
    });

    it('should handle missing effects fieldset gracefully', () => {
      // Create container with damage type select but no fieldset
      const noFieldsetContainer = document.createElement('div');
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      noFieldsetContainer.appendChild(damageTypeSelect);
      document.body.appendChild(noFieldsetContainer);

      const noFieldsetComposer = new DamageCapabilityComposer({
        containerElement: noFieldsetContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      expect(() => noFieldsetComposer.initialize()).not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[DamageCapabilityComposer] Effects fieldset not found'
      );

      document.body.removeChild(noFieldsetContainer);
    });
  });

  describe('setConfiguration() with multiplier', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should set multiplier from configuration when provided as number', () => {
      composer.setConfiguration({
        name: 'fire',
        amount: 50,
        multiplier: 2.5,
      });

      expect(composer.getDamageMultiplier()).toBe(2.5);
    });

    it('should not set multiplier when not a number', () => {
      composer.setConfiguration({
        name: 'fire',
        amount: 50,
        multiplier: '3', // string, not number
      });

      // Should remain at default
      expect(composer.getDamageMultiplier()).toBe(1);
    });
  });

  describe('Effect field input listeners', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should update range display when range effect field input changes', () => {
      // Enable fracture effect to make its fields active
      const fractureCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectFracture}`
      );
      fractureCheckbox.checked = true;
      fractureCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Get the fracture threshold range input
      const fractureThreshold = mockContainer.querySelector(
        `#${ELEMENT_IDS.fractureThreshold}`
      );
      expect(fractureThreshold).not.toBeNull();

      fractureThreshold.value = '0.7';
      fractureThreshold.dispatchEvent(new Event('input', { bubbles: true }));

      // Verify range display is updated
      const displayElement = mockContainer.querySelector(
        `#${ELEMENT_IDS.fractureThreshold}-value`
      );
      expect(displayElement).not.toBeNull();
      expect(displayElement.textContent).toBe('0.7');
    });

    it('should dispatch change event when effect field changes', () => {
      // Enable burn effect
      const burnCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectBurn}`
      );
      burnCheckbox.checked = true;
      burnCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Clear previous dispatch calls
      mockEventBus.dispatch.mockClear();

      // Get the burn DPS input and trigger change event
      const burnDps = mockContainer.querySelector(`#${ELEMENT_IDS.burnDps}`);
      expect(burnDps).not.toBeNull();

      burnDps.value = '5';
      burnDps.dispatchEvent(new Event('change', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.CONFIG_CHANGED,
        expect.any(Object)
      );
    });

    it('should handle input event on non-range effect fields', () => {
      // Enable poison effect
      const poisonCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectPoison}`
      );
      poisonCheckbox.checked = true;
      poisonCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Clear previous dispatch calls
      mockEventBus.dispatch.mockClear();

      // Get the poison tick damage input and trigger input event
      const poisonTickDamage = mockContainer.querySelector(
        `#${ELEMENT_IDS.poisonTickDamage}`
      );
      expect(poisonTickDamage).not.toBeNull();

      poisonTickDamage.value = '3';
      poisonTickDamage.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.CONFIG_CHANGED,
        expect.any(Object)
      );
    });
  });

  describe('Apply button state management', () => {
    it('should enable apply button during initialization', () => {
      // Add apply button to container before initializing
      const applyBtn = document.createElement('button');
      applyBtn.id = 'apply-damage-btn';
      applyBtn.disabled = true;
      mockContainer.appendChild(applyBtn);

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      expect(applyBtn.disabled).toBe(false);
    });

    it('should enable apply button when setConfiguration is called', () => {
      // Add apply button to container
      const applyBtn = document.createElement('button');
      applyBtn.id = 'apply-damage-btn';
      applyBtn.disabled = true;
      mockContainer.appendChild(applyBtn);

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Set disabled again to test setConfiguration
      applyBtn.disabled = true;

      composer.setConfiguration({ name: 'fire', amount: 50 });

      expect(applyBtn.disabled).toBe(false);
    });
  });

  describe('Effect building in getDamageEntry()', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should include fracture effect in damage entry when enabled', () => {
      composer.setConfiguration({
        fracture: { enabled: true, thresholdFraction: 0.6, stunChance: 0.3 },
      });

      const entry = composer.getDamageEntry();

      expect(entry.fracture).toBeDefined();
      expect(entry.fracture.enabled).toBe(true);
      expect(entry.fracture.thresholdFraction).toBe(0.6);
      expect(entry.fracture.stunChance).toBe(0.3);
    });

    it('should include burn effect in damage entry when enabled', () => {
      composer.setConfiguration({
        burn: { enabled: true, dps: 5, durationTurns: 4, canStack: true },
      });

      const entry = composer.getDamageEntry();

      expect(entry.burn).toBeDefined();
      expect(entry.burn.enabled).toBe(true);
      expect(entry.burn.dps).toBe(5);
      expect(entry.burn.durationTurns).toBe(4);
      expect(entry.burn.canStack).toBe(true);
    });

    it('should include poison effect in damage entry when enabled', () => {
      // Note: POISON_SCOPES is ['part', 'entity'], not ['body']
      composer.setConfiguration({
        poison: {
          enabled: true,
          tickDamage: 3,
          durationTurns: 5,
          scope: 'entity',
        },
      });

      const entry = composer.getDamageEntry();

      expect(entry.poison).toBeDefined();
      expect(entry.poison.enabled).toBe(true);
      expect(entry.poison.tickDamage).toBe(3);
      expect(entry.poison.durationTurns).toBe(5);
      expect(entry.poison.scope).toBe('entity');
    });

    it('should include dismember effect in damage entry when enabled', () => {
      composer.setConfiguration({
        dismember: { enabled: true, thresholdFraction: 0.9 },
      });

      const entry = composer.getDamageEntry();

      expect(entry.dismember).toBeDefined();
      expect(entry.dismember.enabled).toBe(true);
      expect(entry.dismember.thresholdFraction).toBe(0.9);
    });

    it('should include multiple effects when multiple are enabled', () => {
      composer.setConfiguration({
        fracture: { enabled: true, thresholdFraction: 0.5, stunChance: 0.2 },
        burn: { enabled: true, dps: 2, durationTurns: 3, canStack: false },
        poison: { enabled: true, tickDamage: 1, durationTurns: 4, scope: 'part' },
        dismember: { enabled: true, thresholdFraction: 0.8 },
      });

      const entry = composer.getDamageEntry();

      expect(entry.fracture).toBeDefined();
      expect(entry.burn).toBeDefined();
      expect(entry.poison).toBeDefined();
      expect(entry.dismember).toBeDefined();
    });
  });

  describe('Deep config merging', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should create nested objects during deep merge', () => {
      // First configuration with burn enabled
      composer.setConfiguration({
        burn: {
          enabled: true,
          dps: 10,
          durationTurns: 3,
          canStack: true,
        },
      });

      // Second configuration with fracture enabled (targets different nested path)
      composer.setConfiguration({
        fracture: {
          enabled: true,
          thresholdFraction: 0.7,
          stunChance: 0.4,
        },
      });

      const entry = composer.getDamageEntry();
      expect(entry.fracture).toBeDefined();
      expect(entry.fracture.enabled).toBe(true);
      expect(entry.fracture.thresholdFraction).toBe(0.7);
      expect(entry.fracture.stunChance).toBe(0.4);
    });

    it('should preserve existing nested properties during merge', () => {
      // Set initial config with specific nested values
      composer.setConfiguration({
        name: 'fire',
        amount: 30,
        bleed: {
          enabled: true,
          severity: 'severe',
          baseDurationTurns: 4,
        },
      });

      // Merge another config that adds to bleed without replacing
      composer.setConfiguration({
        name: 'fire',
        amount: 30,
        bleed: {
          enabled: true,
          severity: 'minor', // This should update
        },
      });

      const entry = composer.getDamageEntry();
      expect(entry.bleed.severity).toBe('minor');
      // baseDurationTurns should still be present from first config merged with defaults
      expect(entry.bleed.baseDurationTurns).toBeDefined();
    });

    it('should create new nested object for property not in DEFAULT_CONFIG', () => {
      // Set a completely new nested property that doesn't exist in DEFAULT_CONFIG
      // This should trigger line 1181: target[key] = {} when target doesn't have the key
      composer.setConfiguration({
        customExtension: {
          newProperty: 'value',
          nestedData: {
            level2: true,
          },
        },
      });

      // The setConfiguration should not throw and should merge the new property
      expect(() => composer.isValid()).not.toThrow();
    });
  });

  describe('Effect config initialization from form', () => {
    beforeEach(() => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();
    });

    it('should initialize effect config object when enabling effect via checkbox', () => {
      // Enable dismember effect via checkbox
      const dismemberCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectDismember}`
      );
      dismemberCheckbox.checked = true;
      dismemberCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      const entry = composer.getDamageEntry();
      expect(entry.dismember).toBeDefined();
      expect(entry.dismember.enabled).toBe(true);
    });

    it('should handle enabling poison effect and updating its fields', () => {
      // Enable poison effect via checkbox
      const poisonCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectPoison}`
      );
      poisonCheckbox.checked = true;
      poisonCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Get the poison scope select and change it
      const poisonScope = mockContainer.querySelector(`#${ELEMENT_IDS.poisonScope}`);
      if (poisonScope) {
        poisonScope.value = 'body';
        poisonScope.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const entry = composer.getDamageEntry();
      expect(entry.poison).toBeDefined();
      expect(entry.poison.enabled).toBe(true);
    });
  });

  describe('Missing checkbox group fallback (line 525)', () => {
    it('should fall back to fieldset when checkbox group not found', () => {
      // Remove the existing mock container to avoid interference
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      // Create container with fieldset but no ds-checkbox-group div
      const testContainer = document.createElement('div');

      // Add damage type select
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      testContainer.appendChild(damageTypeSelect);

      // Add fieldset WITHOUT a checkbox-group div
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      // Intentionally NOT adding a div.ds-checkbox-group
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      const testLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: testLogger,
      });

      expect(() => testComposer.initialize()).not.toThrow();

      // Check that the warning about missing checkbox group was logged
      const warnCalls = testLogger.warn.mock.calls.map((call) => call[0]);
      expect(warnCalls).toContain(
        '[DamageCapabilityComposer] Checkbox group not found, using fieldset'
      );

      document.body.removeChild(testContainer);
    });
  });

  describe('Validation errors container already exists (line 660)', () => {
    it('should reuse existing validation errors container', () => {
      // Remove the existing mock container to avoid interference
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      // Create container with pre-existing validation errors div
      const testContainer = document.createElement('div');

      // Add damage type select
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      testContainer.appendChild(damageTypeSelect);

      // Add fieldset
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      testContainer.appendChild(fieldset);

      // Pre-create validation errors container
      const validationErrors = document.createElement('div');
      validationErrors.id = ELEMENT_IDS.validationErrors;
      validationErrors.className = 'existing-class'; // Different class to verify it's reused
      validationErrors.textContent = 'Existing errors';
      testContainer.appendChild(validationErrors);

      document.body.appendChild(testContainer);

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      expect(() => testComposer.initialize()).not.toThrow();

      // Verify the existing container was reused (same element in DOM)
      const existingContainer = testContainer.querySelector(
        `#${ELEMENT_IDS.validationErrors}`
      );
      expect(existingContainer).not.toBeNull();
      // There should only be one validation errors container
      const allValidationContainers = testContainer.querySelectorAll(
        `#${ELEMENT_IDS.validationErrors}`
      );
      expect(allValidationContainers.length).toBe(1);

      document.body.removeChild(testContainer);
    });
  });

  describe('Partial DOM elements during form update (lines 895-914)', () => {
    it('should handle missing damage type element during getDamageEntry', () => {
      // Create minimal container without damage type
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      const testContainer = document.createElement('div');

      // Add fieldset with checkbox group
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'ds-checkbox-group';
      fieldset.appendChild(checkboxGroup);
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      testComposer.initialize();

      // getDamageEntry should still work using defaults
      const entry = testComposer.getDamageEntry();
      expect(entry.name).toBe(DEFAULT_CONFIG.name);

      document.body.removeChild(testContainer);
    });

    it('should handle missing damage amount element', () => {
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      const testContainer = document.createElement('div');

      // Add damage type select
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      DAMAGE_TYPES.forEach((type) => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        damageTypeSelect.appendChild(option);
      });
      damageTypeSelect.value = 'fire';
      testContainer.appendChild(damageTypeSelect);

      // Add fieldset with checkbox group
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'ds-checkbox-group';
      fieldset.appendChild(checkboxGroup);
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      testComposer.initialize();

      // getDamageEntry will call updateConfigFromForm which tests the missing element branch
      // Since amount element is missing, it should use the stored config value
      const entry = testComposer.getDamageEntry();
      // Damage type comes from DEFAULT_CONFIG since initialize() sets form values from config
      // Even though we set value='fire' before, #updateFormFromConfig overrides it
      expect(entry.name).toBe(DEFAULT_CONFIG.name);
      // Amount also comes from DEFAULT_CONFIG since the amount element is missing
      // This tests the branch at line 901: if (damageAmount) {...}
      expect(entry.amount).toBe(DEFAULT_CONFIG.amount);

      document.body.removeChild(testContainer);
    });

    it('should handle missing penetration slider', () => {
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      const testContainer = document.createElement('div');

      // Add damage type select
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      testContainer.appendChild(damageTypeSelect);

      // Add damage amount (but no penetration)
      const damageAmount = document.createElement('input');
      damageAmount.type = 'range';
      damageAmount.id = ELEMENT_IDS.damageAmount;
      damageAmount.value = '50';
      testContainer.appendChild(damageAmount);

      // Add fieldset
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'ds-checkbox-group';
      fieldset.appendChild(checkboxGroup);
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      testComposer.initialize();

      const entry = testComposer.getDamageEntry();
      // Amount comes from DEFAULT_CONFIG since initialize() sets form values from config
      expect(entry.amount).toBe(DEFAULT_CONFIG.amount);
      // Penetration should also be the default since the element is missing
      // This tests the branch at line 907: if (penetration) {...}
      expect(entry.penetration).toBe(DEFAULT_CONFIG.penetration);

      document.body.removeChild(testContainer);
    });

    it('should handle missing multiplier input', () => {
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      const testContainer = document.createElement('div');

      // Add required elements but NOT multiplier
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      testContainer.appendChild(damageTypeSelect);

      const damageAmount = document.createElement('input');
      damageAmount.id = ELEMENT_IDS.damageAmount;
      damageAmount.value = '25';
      testContainer.appendChild(damageAmount);

      const penetration = document.createElement('input');
      penetration.id = ELEMENT_IDS.penetrationSlider;
      penetration.value = '0.5';
      testContainer.appendChild(penetration);

      // Add fieldset
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'ds-checkbox-group';
      fieldset.appendChild(checkboxGroup);
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      testComposer.initialize();

      // Multiplier should remain at default
      expect(testComposer.getDamageMultiplier()).toBe(1);
      testComposer.getDamageEntry(); // Force update from form
      expect(testComposer.getDamageMultiplier()).toBe(1);

      document.body.removeChild(testContainer);
    });

    it('should handle missing custom flags input', () => {
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      const testContainer = document.createElement('div');

      // Add elements but NOT custom flags
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      testContainer.appendChild(damageTypeSelect);

      const damageAmount = document.createElement('input');
      damageAmount.id = ELEMENT_IDS.damageAmount;
      damageAmount.value = '25';
      testContainer.appendChild(damageAmount);

      const penetration = document.createElement('input');
      penetration.id = ELEMENT_IDS.penetrationSlider;
      penetration.value = '0.5';
      testContainer.appendChild(penetration);

      const multiplier = document.createElement('input');
      multiplier.id = ELEMENT_IDS.damageMultiplier;
      multiplier.value = '2';
      testContainer.appendChild(multiplier);

      // Add fieldset
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'ds-checkbox-group';
      fieldset.appendChild(checkboxGroup);
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      testComposer.initialize();

      const entry = testComposer.getDamageEntry();
      // When flags are empty/missing, they are NOT included in the entry
      // (see #buildDamageEntry: "Include flags only if non-empty")
      // This tests the branch at line 917-921: if (flags) {...}
      expect(entry.flags).toBeUndefined();

      document.body.removeChild(testContainer);
    });
  });

  describe('Field min/step undefined branches (line 634)', () => {
    it('should handle effect fields without min/step properties', () => {
      // The EFFECT_CONFIGS includes various field types
      // This test verifies the dynamic field creation branches
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Verify that fields were created successfully
      // The bleed severity field is a SELECT (not number input)
      const bleedSeverity = mockContainer.querySelector(`#${ELEMENT_IDS.bleedSeverity}`);
      expect(bleedSeverity).not.toBeNull();
      expect(bleedSeverity.tagName).toBe('SELECT');

      // The bleed duration is a number field
      const bleedDuration = mockContainer.querySelector(`#${ELEMENT_IDS.bleedDuration}`);
      expect(bleedDuration).not.toBeNull();
      expect(bleedDuration.type).toBe('number');
    });
  });

  describe('Validation errors display branches (lines 1085-1145)', () => {
    it('should handle null errors in validation result (line 1085)', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Configure schema validator to return invalid with null/undefined errors
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: null, // This triggers the || [] fallback at line 1085
      });

      // Trigger validation
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '50';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Should have empty errors array (from fallback at line 1085)
      expect(composer.getValidationErrors()).toEqual([]);
      // isValid() returns false because validator returned valid: false
      expect(composer.isValid()).toBe(false);
    });

    it('should display multiple validation errors in UI (lines 1116-1120)', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Configure schema validator to return multiple errors
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [
          { message: 'Error 1' },
          { message: 'Error 2' },
          { message: 'Error 3' },
        ],
      });

      // Trigger validation
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '50';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Check that all errors are displayed
      const errors = composer.getValidationErrors();
      expect(errors).toHaveLength(3);
      expect(errors).toContain('Error 1');
      expect(errors).toContain('Error 2');
      expect(errors).toContain('Error 3');

      // Check that error divs are created in the UI
      const errorsContainer = mockContainer.querySelector(
        `#${ELEMENT_IDS.validationErrors}`
      );
      expect(errorsContainer).not.toBeNull();
      const errorDivs = errorsContainer.querySelectorAll('div');
      expect(errorDivs.length).toBe(3);
    });

    it('should handle missing validation errors container (line 1112)', () => {
      // Remove existing container first
      if (mockContainer?.parentNode) {
        mockContainer.parentNode.removeChild(mockContainer);
      }

      const testContainer = document.createElement('div');

      // Add minimal required elements without validation errors container
      const damageTypeSelect = document.createElement('select');
      damageTypeSelect.id = ELEMENT_IDS.damageType;
      testContainer.appendChild(damageTypeSelect);

      const damageAmount = document.createElement('input');
      damageAmount.id = ELEMENT_IDS.damageAmount;
      testContainer.appendChild(damageAmount);

      // Add fieldset
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'ds-effects-group';
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'ds-checkbox-group';
      fieldset.appendChild(checkboxGroup);
      testContainer.appendChild(fieldset);

      document.body.appendChild(testContainer);

      // Mock schema validator to return invalid
      mockSchemaValidator.validate.mockReturnValue({
        valid: false,
        errors: [{ message: 'Test error' }],
      });

      const testComposer = new DamageCapabilityComposer({
        containerElement: testContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      // Initialize should create the validation errors container
      testComposer.initialize();

      // But if we manually remove it and trigger validation, it should handle gracefully
      const errorsContainer = testContainer.querySelector(
        `#${ELEMENT_IDS.validationErrors}`
      );
      if (errorsContainer) {
        errorsContainer.parentNode.removeChild(errorsContainer);
      }

      // Clear elements map reference
      // This simulates the condition where container is missing
      // Trigger validation - should not throw
      expect(() => {
        damageAmount.dispatchEvent(new Event('input', { bubbles: true }));
      }).not.toThrow();

      document.body.removeChild(testContainer);
    });

    it('should handle missing effect config div in toggleEffectConfig (line 1145)', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Get the bleed checkbox that was created during initialization
      const bleedCheckbox = mockContainer.querySelector(
        `#${ELEMENT_IDS.effectBleed}`
      );
      expect(bleedCheckbox).not.toBeNull();

      // Remove the effect config div AFTER initialization
      const configDiv = mockContainer.querySelector(
        `.ds-effect-config[data-for="bleed"]`
      );
      expect(configDiv).not.toBeNull();
      configDiv.parentNode.removeChild(configDiv);

      // Toggle the effect - should not throw even when config div is missing
      expect(() => {
        bleedCheckbox.checked = true;
        bleedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }).not.toThrow();
    });
  });

  describe('Integer field parsing branches (lines 981-983)', () => {
    it('should parse baseDurationTurns as integer', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Enable bleed effect
      const bleedCheckbox = mockContainer.querySelector(`#${ELEMENT_IDS.effectBleed}`);
      bleedCheckbox.checked = true;
      bleedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Set duration to a float value
      const bleedDuration = mockContainer.querySelector(`#${ELEMENT_IDS.bleedDuration}`);
      bleedDuration.value = '3.7';
      bleedDuration.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();
      // Should be rounded to integer
      expect(entry.bleed.baseDurationTurns).toBe(4);
    });

    it('should parse durationTurns as integer for burn effect', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Enable burn effect
      const burnCheckbox = mockContainer.querySelector(`#${ELEMENT_IDS.effectBurn}`);
      burnCheckbox.checked = true;
      burnCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Set duration to a float value
      const burnDuration = mockContainer.querySelector(`#${ELEMENT_IDS.burnDuration}`);
      burnDuration.value = '5.2';
      burnDuration.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();
      // Should be rounded to integer
      expect(entry.burn.durationTurns).toBe(5);
    });

    it('should default to 1 when duration is NaN', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Enable bleed effect
      const bleedCheckbox = mockContainer.querySelector(`#${ELEMENT_IDS.effectBleed}`);
      bleedCheckbox.checked = true;
      bleedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Set duration to NaN
      const bleedDuration = mockContainer.querySelector(`#${ELEMENT_IDS.bleedDuration}`);
      bleedDuration.value = 'invalid';
      bleedDuration.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();
      // Should default to 1 (the || 1 fallback)
      expect(entry.bleed.baseDurationTurns).toBe(1);
    });

    it('should default to 0 for non-duration numeric fields when NaN', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Enable burn effect
      const burnCheckbox = mockContainer.querySelector(`#${ELEMENT_IDS.effectBurn}`);
      burnCheckbox.checked = true;
      burnCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Set DPS to invalid
      const burnDps = mockContainer.querySelector(`#${ELEMENT_IDS.burnDps}`);
      burnDps.value = 'invalid';
      burnDps.dispatchEvent(new Event('input', { bubbles: true }));

      const entry = composer.getDamageEntry();
      // Should default to 0 (the || 0 fallback for non-duration fields)
      expect(entry.burn.dps).toBe(0);
    });
  });

  describe('Multiplier parsing fallback (line 914)', () => {
    it('should default multiplier to 1 when value is NaN', () => {
      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
        logger: mockLogger,
      });
      composer.initialize();

      // Set multiplier to invalid value
      const multiplier = mockContainer.querySelector(`#${ELEMENT_IDS.damageMultiplier}`);
      multiplier.value = 'invalid';
      multiplier.dispatchEvent(new Event('input', { bubbles: true }));

      // Should fallback to 1
      expect(composer.getDamageMultiplier()).toBe(1);
    });
  });
});
