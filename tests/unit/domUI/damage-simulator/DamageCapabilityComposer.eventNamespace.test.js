/**
 * @file DamageCapabilityComposer.eventNamespace.test.js
 * @description Unit tests verifying COMPOSER_EVENTS use correct core: namespace
 */

import DamageCapabilityComposer from '../../../../src/domUI/damage-simulator/DamageCapabilityComposer.js';

describe('DamageCapabilityComposer Event Namespace', () => {
  const { COMPOSER_EVENTS } = DamageCapabilityComposer;

  describe('COMPOSER_EVENTS constants', () => {
    it('should use core: namespace prefix for all events', () => {
      expect(COMPOSER_EVENTS.CONFIG_CHANGED).toMatch(/^core:/);
      expect(COMPOSER_EVENTS.VALIDATION_ERROR).toMatch(/^core:/);
      expect(COMPOSER_EVENTS.VALIDATION_SUCCESS).toMatch(/^core:/);
    });

    it('should use snake_case after namespace prefix', () => {
      // Extract the part after 'core:'
      const configChangedSuffix = COMPOSER_EVENTS.CONFIG_CHANGED.replace(
        'core:',
        ''
      );
      const validationErrorSuffix = COMPOSER_EVENTS.VALIDATION_ERROR.replace(
        'core:',
        ''
      );
      const validationSuccessSuffix = COMPOSER_EVENTS.VALIDATION_SUCCESS.replace(
        'core:',
        ''
      );

      // Verify snake_case (no hyphens, no camelCase)
      expect(configChangedSuffix).not.toMatch(/-/);
      expect(validationErrorSuffix).not.toMatch(/-/);
      expect(validationSuccessSuffix).not.toMatch(/-/);

      // Verify underscore is used
      expect(configChangedSuffix).toMatch(/_/);
      expect(validationErrorSuffix).toMatch(/_/);
      expect(validationSuccessSuffix).toMatch(/_/);
    });

    it('should have correct CONFIG_CHANGED event name', () => {
      expect(COMPOSER_EVENTS.CONFIG_CHANGED).toBe(
        'core:damage_composer_config_changed'
      );
    });

    it('should have correct VALIDATION_ERROR event name', () => {
      expect(COMPOSER_EVENTS.VALIDATION_ERROR).toBe(
        'core:damage_composer_validation_error'
      );
    });

    it('should have correct VALIDATION_SUCCESS event name', () => {
      expect(COMPOSER_EVENTS.VALIDATION_SUCCESS).toBe(
        'core:damage_composer_validation_success'
      );
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(COMPOSER_EVENTS)).toBe(true);
    });
  });
});
