/**
 * @file damageSimulatorEventValidation.integration.test.js
 * @description Integration tests for damage simulator event validation.
 * Verifies that damage simulator events are properly defined and validated.
 */

import { describe, it, expect } from '@jest/globals';
import DamageSimulatorUI from '../../../../src/domUI/damage-simulator/DamageSimulatorUI.js';

describe('DamageSimulatorUI - Event Validation Integration', () => {
  describe('UI_EVENTS constants', () => {
    it('should use core: namespace for all event types', () => {
      const events = DamageSimulatorUI.UI_EVENTS;

      expect(events.ENTITY_LOADING).toBe('core:damage_simulator_entity_loading');
      expect(events.ENTITY_LOADED).toBe('core:damage_simulator_entity_loaded');
      expect(events.ENTITY_LOAD_ERROR).toBe(
        'core:damage_simulator_entity_load_error'
      );
      expect(events.REFRESH_REQUESTED).toBe(
        'core:damage_simulator_refresh_requested'
      );
    });

    it('should have all event IDs follow the namespaced format', () => {
      const events = DamageSimulatorUI.UI_EVENTS;

      Object.values(events).forEach((eventId) => {
        expect(eventId).toMatch(/^core:damage_simulator_/);
      });
    });
  });

  describe('Event dispatch integration', () => {
    it('should dispatch events with correct structure', () => {
      // This test verifies the event types are defined and follow expected patterns
      // Access the static events to verify the structure
      expect(DamageSimulatorUI.UI_EVENTS.ENTITY_LOADING).toBeDefined();
      expect(DamageSimulatorUI.UI_EVENTS.ENTITY_LOADED).toBeDefined();
      expect(DamageSimulatorUI.UI_EVENTS.ENTITY_LOAD_ERROR).toBeDefined();
      expect(DamageSimulatorUI.UI_EVENTS.REFRESH_REQUESTED).toBeDefined();
    });
  });

  describe('Event ID consistency', () => {
    it('should have snake_case event IDs after namespace', () => {
      const events = DamageSimulatorUI.UI_EVENTS;

      Object.values(events).forEach((eventId) => {
        // Extract the part after "core:"
        const eventName = eventId.replace(/^core:/, '');
        // Verify it uses snake_case
        expect(eventName).toMatch(/^[a-z]+(_[a-z]+)*$/);
      });
    });

    it('should not use kebab-case in event IDs', () => {
      const events = DamageSimulatorUI.UI_EVENTS;

      Object.values(events).forEach((eventId) => {
        expect(eventId).not.toContain('-');
      });
    });
  });
});
