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
});
