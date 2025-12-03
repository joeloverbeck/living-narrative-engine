/**
 * @file Integration tests for undefined value handling in damage events
 * @description Verifies that damage event formatting never produces "undefined"
 * in output, even when receiving incomplete event payloads.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';

describe('Damage Event Undefined Values - Integration', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new InjuryNarrativeFormatterService({
      logger: mockLogger,
    });
  });

  describe('formatDamageEvent with missing required fields', () => {
    it('should NOT produce "undefined" in output when entityName is missing', () => {
      const incompleteData = {
        // entityName: undefined (missing)
        entityPronoun: 'she',
        partType: 'arm',
        orientation: 'left',
        damageType: 'slashing',
        damageAmount: 15,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(incompleteData);

      expect(result).not.toContain('undefined');
      expect(result.toLowerCase()).not.toContain("undefined's");
    });

    it('should NOT produce "undefined" in output when partType is missing', () => {
      const incompleteData = {
        entityName: 'Vespera',
        entityPronoun: 'she',
        // partType: undefined (missing)
        orientation: 'left',
        damageType: 'slashing',
        damageAmount: 15,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(incompleteData);

      expect(result).not.toContain('undefined');
    });

    it('should NOT produce "undefined" in output when damageType is missing', () => {
      const incompleteData = {
        entityName: 'Vespera',
        entityPronoun: 'she',
        partType: 'arm',
        orientation: 'left',
        // damageType: undefined (missing)
        damageAmount: 15,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(incompleteData);

      expect(result).not.toContain('undefined');
    });

    it('should NOT produce "undefined" when all key fields are missing', () => {
      const minimalData = {
        damageAmount: 15,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(minimalData);

      expect(result).not.toContain('undefined');
    });

    it('should NOT produce "undefined" when orientation is the only field provided', () => {
      const incompleteData = {
        orientation: 'left',
        damageAmount: 10,
      };

      const result = service.formatDamageEvent(incompleteData);

      expect(result).not.toContain('undefined');
    });
  });

  describe('formatDamageEvent with anatomy:internal_damage_propagated payload format', () => {
    // This is the actual payload format from DamagePropagationService.#dispatchPropagationEvent
    it('should handle anatomy:internal_damage_propagated event payload format', () => {
      const propagationPayload = {
        ownerEntityId: 'entity-1',
        sourcePartId: 'torso-1',
        targetPartId: 'heart-1',
        damageAmount: 20,
        damageTypeId: 'piercing',
        timestamp: Date.now(),
        // Missing: entityName, partType, orientation, entityPronoun, damageType
      };

      const result = service.formatDamageEvent(propagationPayload);

      expect(result).not.toContain('undefined');
    });

    it('should produce a readable fallback message for incomplete propagation data', () => {
      const propagationPayload = {
        ownerEntityId: 'entity-1',
        sourcePartId: 'torso-1',
        targetPartId: 'heart-1',
        damageAmount: 20,
        damageTypeId: 'piercing',
      };

      const result = service.formatDamageEvent(propagationPayload);

      // Should produce something like "An entity's body part suffers damage."
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('suffers');
      expect(result).toContain('damage');
    });
  });

  describe('formatDamageEvent validation and logging', () => {
    it('should log warning when receiving incomplete propagation event data', () => {
      const incompleteData = {
        ownerEntityId: 'entity-1',
        damageAmount: 20,
        damageTypeId: 'piercing',
      };

      service.formatDamageEvent(incompleteData);

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log warning with details about missing fields', () => {
      const incompleteData = {
        partType: 'arm',
        damageAmount: 15,
        // Missing entityName and damageType
      };

      service.formatDamageEvent(incompleteData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('incomplete data'),
        expect.objectContaining({
          hasEntityName: false,
          hasDamageType: false,
        })
      );
    });

    it('should NOT log warning when all required fields are present', () => {
      const completeData = {
        entityName: 'Vespera',
        entityPronoun: 'she',
        partType: 'arm',
        orientation: 'left',
        damageType: 'slashing',
        damageAmount: 15,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
      };

      service.formatDamageEvent(completeData);

      // Should NOT have warned about incomplete data
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('incomplete data'),
        expect.anything()
      );
    });
  });

  describe('formatDamageEvent with propagated damage containing undefined values', () => {
    it('should handle propagatedDamage array with missing childPartType', () => {
      const damageEventData = {
        entityName: 'Vespera',
        entityPronoun: 'she',
        partType: 'torso',
        orientation: null,
        damageType: 'piercing',
        damageAmount: 40,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
        propagatedDamage: [
          {
            childPartId: 'organ-1',
            // childPartType: undefined (missing)
            orientation: null,
            damageApplied: 20,
          },
        ],
      };

      const result = service.formatDamageEvent(damageEventData);

      expect(result).not.toContain('undefined');
    });

    it('should handle empty propagatedDamage array gracefully', () => {
      const damageEventData = {
        entityName: 'Vespera',
        partType: 'torso',
        damageType: 'piercing',
        damageAmount: 40,
        propagatedDamage: [],
      };

      const result = service.formatDamageEvent(damageEventData);

      expect(result).not.toContain('undefined');
      expect(result).toContain('torso');
    });
  });
});
