/**
 * @file Integration tests for damage propagation message rendering.
 * @see Ticket: Fix malformed "An entity's body part suffers damage damage" message
 *
 * This test suite verifies that:
 * 1. The anatomy:internal_damage_propagated event does NOT produce user-facing messages
 * 2. The anatomy:damage_applied event (from recursive ApplyDamageHandler) produces correct child messages
 * 3. No malformed fallback messages appear (e.g., "An entity's body part suffers damage damage")
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';

describe('Damage Propagation Message Rendering', () => {
  let formatter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    formatter = new InjuryNarrativeFormatterService({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Malformed Message Detection', () => {
    it('should detect incomplete payload that would cause malformed message', () => {
      // This is the actual payload format from DamagePropagationService.#dispatchPropagationEvent
      // It's missing entityName, partType, and damageType (uses damageTypeId instead)
      const incompletePayload = {
        ownerEntityId: 'entity-1',
        sourcePartId: 'torso-1',
        targetPartId: 'heart-1',
        damageAmount: 10,
        damageTypeId: 'piercing', // Note: wrong field name - formatter expects 'damageType'
        timestamp: Date.now(),
      };

      // When this payload goes through formatDamageEvent, it produces the malformed message
      const result = formatter.formatDamageEvent(incompletePayload);

      // This is the bug we're fixing - the message uses all fallbacks
      expect(result).toContain("An entity's");
      expect(result).toContain('body part');
      expect(result).toContain('damage damage'); // "damage" from fallback + " damage" from template
    });

    it('should produce correct message when payload has all required fields', () => {
      // This is the complete payload format from ApplyDamageHandler (anatomy:damage_applied event)
      const completePayload = {
        entityId: 'entity-1',
        entityName: 'Rill',
        entityPronoun: 'she',
        partId: 'heart-1',
        partType: 'heart',
        orientation: null,
        amount: 10,
        damageType: 'piercing',
        propagatedFrom: 'torso-1',
        timestamp: Date.now(),
      };

      const result = formatter.formatDamageEvent(completePayload);

      // The message should use the actual entity name and part type
      expect(result).toContain("Rill's");
      expect(result).toContain('heart');
      expect(result).toContain('piercing damage');
      // Must NOT contain fallbacks
      expect(result).not.toContain("An entity's");
      expect(result).not.toContain('body part');
      expect(result).not.toContain('damage damage');
    });

    it('should never produce the specific malformed pattern "damage damage"', () => {
      // Test various payload scenarios that should NOT produce "damage damage"
      const validPayloads = [
        {
          entityName: 'Rill',
          partType: 'torso',
          damageType: 'slashing',
          damageAmount: 10,
        },
        {
          entityName: 'Rill',
          partType: 'heart',
          damageType: 'piercing',
          damageAmount: 5,
        },
        {
          entityName: 'Rill',
          partType: 'arm',
          orientation: 'left',
          damageType: 'blunt',
          damageAmount: 15,
        },
      ];

      for (const payload of validPayloads) {
        const result = formatter.formatDamageEvent(payload);
        expect(result).not.toContain('damage damage');
        expect(result).not.toContain("An entity's body part");
      }
    });
  });

  describe('Payload Field Validation', () => {
    it('should log warning when entityName is missing', () => {
      const payload = {
        partType: 'torso',
        damageType: 'slashing',
        damageAmount: 10,
      };

      formatter.formatDamageEvent(payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('formatDamageEvent received incomplete data'),
        expect.objectContaining({ hasEntityName: false })
      );
    });

    it('should log warning when partType is missing', () => {
      const payload = {
        entityName: 'Rill',
        damageType: 'slashing',
        damageAmount: 10,
      };

      formatter.formatDamageEvent(payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('formatDamageEvent received incomplete data'),
        expect.objectContaining({ hasPartType: false })
      );
    });

    it('should log warning when damageType is missing', () => {
      const payload = {
        entityName: 'Rill',
        partType: 'torso',
        damageAmount: 10,
      };

      formatter.formatDamageEvent(payload);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('formatDamageEvent received incomplete data'),
        expect.objectContaining({ hasDamageType: false })
      );
    });
  });

  describe('Expected Message Formats', () => {
    it('should format basic damage message correctly', () => {
      const payload = {
        entityName: 'Rill',
        partType: 'torso',
        damageType: 'piercing',
        damageAmount: 10,
      };

      const result = formatter.formatDamageEvent(payload);

      expect(result).toBe("Rill's torso suffers piercing damage.");
    });

    it('should format damage message with orientation correctly', () => {
      const payload = {
        entityName: 'Rill',
        partType: 'arm',
        orientation: 'left',
        damageType: 'slashing',
        damageAmount: 15,
      };

      const result = formatter.formatDamageEvent(payload);

      expect(result).toBe("Rill's left arm suffers slashing damage.");
    });

    it('should format damage message with effects correctly', () => {
      const payload = {
        entityName: 'Rill',
        partType: 'torso',
        damageType: 'slashing',
        damageAmount: 20,
        effectsTriggered: ['bleeding'],
      };

      const result = formatter.formatDamageEvent(payload);

      expect(result).toContain("Rill's torso suffers slashing damage");
      expect(result).toContain('is bleeding');
    });
  });
});
