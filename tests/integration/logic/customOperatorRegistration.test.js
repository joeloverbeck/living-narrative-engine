/**
 * @file Integration test to verify custom operators are properly registered in runtime
 * @description Tests that the isSocketCovered operator is correctly registered through DI
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Custom Operator Registration - Runtime Validation', () => {
  let container;
  let jsonLogicService;

  beforeEach(async () => {
    // Create a real app container to test the actual DI configuration
    container = new AppContainer();
    await configureMinimalContainer(container);

    // Resolve the JsonLogicEvaluationService which should have operators registered
    jsonLogicService = container.resolve(tokens.JsonLogicEvaluationService);
  });

  afterEach(() => {
    if (container && container.dispose) {
      container.dispose();
    }
  });

  it('should have isSocketCovered operator registered', () => {
    // Check that the isSocketCovered operator is available in jsonLogic
    const testRule = { isSocketCovered: ['dummy', 'socket'] };

    // The operator should be registered, so it shouldn't throw
    // We're not testing the functionality here, just that it's registered
    expect(() => {
      // Create a minimal context with dummy data
      const context = {
        entity: { id: 'test' },
        actor: { id: 'test' },
      };

      // This will fail because of missing entity data, but it should fail
      // in the operator logic, not because the operator is undefined
      try {
        jsonLogicService.evaluate(testRule, context);
      } catch (error) {
        // We expect this to fail due to missing entity data
        // But the important thing is that it doesn't fail with
        // "Unknown operation isSocketCovered"
        expect(error.message).not.toContain('Unknown operation');
      }
    }).not.toThrow();
  });

  it('should have hasPartWithComponentValue operator registered', () => {
    // Check that another custom operator is registered
    const testRule = {
      hasPartWithComponentValue: ['dummy', 'component', 'prop', 'value'],
    };

    expect(() => {
      const context = {
        entity: { id: 'test' },
        actor: { id: 'test' },
      };

      try {
        jsonLogicService.evaluate(testRule, context);
      } catch (error) {
        // Should fail due to missing data, not missing operator
        expect(error.message).not.toContain('Unknown operation');
      }
    }).not.toThrow();
  });

  it('should have hasOtherActorsAtLocation operator registered', () => {
    // Check that the hasOtherActorsAtLocation operator is registered
    const testRule = { hasOtherActorsAtLocation: ['actor'] };

    const context = {
      entity: { id: 'test' },
      actor: { id: 'test' },
    };

    // The operator should be registered and return a boolean
    const result = jsonLogicService.evaluate(testRule, context);
    expect(typeof result).toBe('boolean');
  });

  it('should have all custom operators registered', () => {
    // Test a few more operators to ensure comprehensive registration
    const operators = [
      { hasPartOfType: ['dummy', 'type'] },
      { isSlotExposed: ['dummy', 'slot'] },
      {
        hasPartOfTypeWithComponentValue: [
          'dummy',
          'type',
          'comp',
          'prop',
          'val',
        ],
      },
      { hasOtherActorsAtLocation: ['dummy'] },
    ];

    operators.forEach((rule) => {
      expect(() => {
        const context = {
          entity: { id: 'test' },
          actor: { id: 'test' },
        };

        try {
          jsonLogicService.evaluate(rule, context);
        } catch (error) {
          // Should fail due to missing data, not missing operator
          const operatorName = Object.keys(rule)[0];
          expect(error.message).not.toContain(
            `Unknown operation ${operatorName}`
          );
        }
      }).not.toThrow();
    });
  });
});
