/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { IsSlotExposedOperator } from '../../../../src/logic/operators/isSlotExposedOperator.js';

describe('IsSlotExposedOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    operator = new IsSlotExposedOperator(mockDependencies);
    mockContext = {};
  });

  test('returns true when slotName is falsy', () => {
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', null], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      'isSlotExposed: Falsy slotName provided, treating as exposed'
    );
  });

  test('uses default layers (base, outer, armor) when checking exposure', () => {
    const equipmentData = {
      equipped: {
        torso_upper: {
          base: 'shirt123',
        },
      },
    };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      equipmentData
    );
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(false);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      "isSlotExposed: Entity actor123 slot 'torso_upper' layers [base, outer, armor] exposed: false"
    );
  });

  test('ignores underwear by default', () => {
    const equipmentData = {
      equipped: {
        torso_upper: {
          underwear: 'undershirt999',
        },
      },
    };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      equipmentData
    );
    mockContext.actor = { id: 'actor456' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      "isSlotExposed: Entity actor456 slot 'torso_upper' layers [base, outer, armor] exposed: true"
    );
  });

  test('supports custom layers and accessory inclusion', () => {
    const equipmentData = {
      equipped: {
        torso_upper: {
          underwear: 'undershirt999',
          accessories: ['brooch1'],
        },
      },
    };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      equipmentData
    );
    mockContext.actor = { id: 'actor789' };

    const options = { layers: ['underwear'], includeAccessories: true };
    const result = operator.evaluate(
      ['actor', 'torso_upper', options],
      mockContext
    );

    expect(result).toBe(false);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      "isSlotExposed: Entity actor789 slot 'torso_upper' layers [underwear, accessories] exposed: false"
    );
  });

  test('warns on invalid layers and falls back to defaults', () => {
    const equipmentData = {
      equipped: {
        head: {
          outer: 'hat123',
        },
      },
    };
    mockDependencies.entityManager.getComponentData.mockReturnValue(
      equipmentData
    );
    mockContext.actor = { id: 'actor000' };

    const result = operator.evaluate(
      ['actor', 'head', { layers: ['invalid_layer'] }],
      mockContext
    );

    expect(result).toBe(false);
    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      "isSlotExposed: Invalid layer name 'invalid_layer'. Valid layers: underwear, base, outer, accessories, armor"
    );
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      "isSlotExposed: Entity actor000 slot 'head' layers [base, outer, armor] exposed: false"
    );
  });

  // === Coverage tests for uncovered lines ===

  // Note: Lines 39-42 (params check) were removed as unreachable code.
  // BaseEquipmentOperator.evaluate() requires params.length >= 2,
  // guaranteeing evaluateInternal always receives at least one operatorParam.

  test('returns false and warns when slotName is not a string (lines 55-58)', () => {
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 123], mockContext);

    expect(result).toBe(false);
    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'isSlotExposed: Invalid slotName parameter: 123'
    );
  });

  test('returns true when entity has no clothing:equipment component (lines 65-68)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue(null);
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      'isSlotExposed: Entity actor123 has no clothing:equipment component'
    );
  });

  test('returns true when equipment data has no equipped property (lines 75-78)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({});
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      'isSlotExposed: Entity actor123 has clothing:equipment but no equipped items structure'
    );
  });

  test('returns true when equipped property is not an object (lines 75-78)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: 'invalid',
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      'isSlotExposed: Entity actor123 has clothing:equipment but no equipped items structure'
    );
  });

  test('returns true when slot does not exist in equipped items (lines 83-86)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: { other_slot: { base: 'item123' } },
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      "isSlotExposed: Entity actor123 slot 'torso_upper' missing or invalid; treating as exposed"
    );
  });

  test('returns true when slot value is not an object (lines 83-86)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: { torso_upper: 'invalid_string' },
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

    expect(result).toBe(true);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      "isSlotExposed: Entity actor123 slot 'torso_upper' missing or invalid; treating as exposed"
    );
  });

  test('includes underwear layer when includeUnderwear option is true (line 160)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: {
        torso_upper: {
          underwear: 'undershirt999',
          base: null,
        },
      },
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(
      ['actor', 'torso_upper', { includeUnderwear: true }],
      mockContext
    );

    expect(result).toBe(false);
    expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('underwear')
    );
  });

  test('accepts array of layers as options shorthand (lines 129-143)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: {
        torso_upper: { outer: 'coat123' },
      },
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(
      ['actor', 'torso_upper', ['outer']],
      mockContext
    );

    expect(result).toBe(false);
  });

  test('deduplicates layers when array has duplicates (lines 137-142)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: {
        torso_upper: { base: 'shirt123' },
      },
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(
      ['actor', 'torso_upper', ['base', 'base', 'outer']],
      mockContext
    );

    expect(result).toBe(false);
  });

  test('falls back to defaults when array has only invalid layers (lines 131-136)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: {
        head: { outer: 'hat123' },
      },
    });
    mockContext.actor = { id: 'actor000' };

    const result = operator.evaluate(
      ['actor', 'head', ['invalid1', 'invalid2']],
      mockContext
    );

    expect(result).toBe(false);
    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'isSlotExposed: No valid layers provided; falling back to defaults'
    );
  });

  test('deduplicates layers in options object (lines 167-172)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: {
        torso_upper: { base: 'shirt123' },
      },
    });
    mockContext.actor = { id: 'actor123' };

    const result = operator.evaluate(
      ['actor', 'torso_upper', { layers: ['base', 'base', 'outer'] }],
      mockContext
    );

    expect(result).toBe(false);
  });

  test('falls back to defaults when options.layers has only invalid layers (lines 152-157)', () => {
    mockDependencies.entityManager.getComponentData.mockReturnValue({
      equipped: {
        head: { outer: 'hat123' },
      },
    });
    mockContext.actor = { id: 'actor000' };

    const result = operator.evaluate(
      ['actor', 'head', { layers: ['invalid1', 'invalid2'] }],
      mockContext
    );

    expect(result).toBe(false);
    expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
      'isSlotExposed: No valid layers provided; falling back to defaults'
    );
  });
});
