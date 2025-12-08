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
});
