/**
 * @file damageCapabilityComposerValidation.integration.test.js
 * @description Integration tests for DamageCapabilityComposer validation.
 * Tests that validation uses the correct isValid property from AjvSchemaValidator.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import DamageCapabilityComposer from '../../../../src/domUI/damage-simulator/DamageCapabilityComposer.js';

describe('DamageCapabilityComposer - Validation Integration', () => {
  let mockLogger;
  let mockSchemaValidator;
  let mockEventBus;
  let mockContainer;
  let composer;

  const { ELEMENT_IDS, COMPOSER_EVENTS } = DamageCapabilityComposer;

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

    // Create effects group container
    const effectsGroup = document.createElement('fieldset');
    effectsGroup.className = 'ds-effects-group';
    container.appendChild(effectsGroup);

    return container;
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
    };

    mockContainer = createMockContainer();
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    composer = null;
    if (mockContainer && mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
    jest.clearAllMocks();
  });

  describe('AjvSchemaValidator integration', () => {
    it('should use isValid property from schema validator (not valid)', () => {
      // This test verifies the fix for the .valid vs .isValid bug
      // AjvSchemaValidator.validate() returns { isValid: boolean, errors: [] }
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      // getDamageEntry should succeed when isValid is true
      expect(() => composer.getDamageEntry()).not.toThrow();
    });

    it('should throw error when isValid is false', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({
          isValid: false,
          errors: [{ message: 'Test validation error' }],
        }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      expect(() => composer.getDamageEntry()).toThrow(
        'Invalid damage configuration: Test validation error'
      );
    });

    it('should handle "Unknown validation error" when errors array is empty', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({
          isValid: false,
          errors: [],
        }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      expect(() => composer.getDamageEntry()).toThrow(
        'Invalid damage configuration: Unknown validation error'
      );
    });

    it('should handle null errors gracefully', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({
          isValid: false,
          errors: null,
        }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      expect(() => composer.getDamageEntry()).toThrow(
        'Invalid damage configuration: Unknown validation error'
      );
    });
  });

  describe('isValid() method', () => {
    it('should return true when validator returns isValid: true', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      expect(composer.isValid()).toBe(true);
    });

    it('should return false when validator returns isValid: false', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({
          isValid: false,
          errors: [{ message: 'error' }],
        }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      expect(composer.isValid()).toBe(false);
    });
  });

  describe('Validation events', () => {
    it('should dispatch VALIDATION_SUCCESS when validation passes', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      // Trigger validation by changing a form value
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '20';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.VALIDATION_SUCCESS,
        expect.objectContaining({ entry: expect.any(Object) })
      );
    });

    it('should dispatch VALIDATION_ERROR when validation fails', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({
          isValid: false,
          errors: [{ message: 'Invalid amount' }],
        }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      // Trigger validation by changing a form value
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.value = '50';
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        COMPOSER_EVENTS.VALIDATION_ERROR,
        expect.objectContaining({ errors: expect.any(Array) })
      );
    });

    it('should use core: namespace for validation events', () => {
      mockSchemaValidator = {
        validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      };

      composer = new DamageCapabilityComposer({
        containerElement: mockContainer,
        logger: mockLogger,
        schemaValidator: mockSchemaValidator,
        eventBus: mockEventBus,
      });
      composer.initialize();

      // Trigger validation
      const damageAmountInput = mockContainer.querySelector(
        `#${ELEMENT_IDS.damageAmount}`
      );
      damageAmountInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Find validation success dispatch
      const validationSuccessCall = mockEventBus.dispatch.mock.calls.find(
        (call) => call[0] === COMPOSER_EVENTS.VALIDATION_SUCCESS
      );

      expect(validationSuccessCall[0]).toBe(
        'core:damage_composer_validation_success'
      );
    });
  });
});
