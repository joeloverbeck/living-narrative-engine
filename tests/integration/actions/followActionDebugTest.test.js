/**
 * @file Simple debug test to verify the fix for follow action
 */

import { describe, it, expect, jest } from '@jest/globals';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

describe('Follow Action Debug Test', () => {
  it('should pass actor with components to scope engine', () => {
    const logger = new ConsoleLogger('DEBUG');

    // Mock dependencies
    const mockEntityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        if (entityId === 'iker' && componentId === 'core:name') {
          return { text: 'Iker' };
        }
        if (entityId === 'iker' && componentId === 'core:position') {
          return { locationId: 'room1' };
        }
        return null;
      }),
    };

    const mockScopeEngine = {
      resolve: jest.fn().mockReturnValue(new Set(['amaia'])),
    };

    const mockScopeRegistry = {
      getScope: jest.fn().mockReturnValue({
        expr: 'test_scope',
        ast: { type: 'test' },
      }),
    };

    const mockDslParser = {
      parse: jest.fn().mockReturnValue({ type: 'test' }),
    };

    const mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    const mockJsonLogicEval = {
      evaluate: jest.fn(),
    };

    // Create service
    const service = createTargetResolutionServiceWithMocks({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      logger,
      safeEventDispatcher: mockEventDispatcher,
      jsonLogicEvaluationService: mockJsonLogicEval,
      dslParser: mockDslParser,
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });

    // Create actor WITHOUT components (simulating the issue)
    const actorWithoutComponents = {
      id: 'iker',
      componentTypeIds: ['core:name', 'core:position'],
      // Note: No 'components' property
    };

    const discoveryContext = {
      currentLocation: { id: 'room1' },
    };

    // Call resolveTargets
    const result = service.resolveTargets(
      'test_scope',
      actorWithoutComponents,
      discoveryContext
    );

    // Verify scope engine was called with actor that has components
    expect(mockScopeEngine.resolve).toHaveBeenCalled();
    const [, passedActor] = mockScopeEngine.resolve.mock.calls[0];

    // This is the key assertion - actor should have components
    expect(passedActor).toHaveProperty('components');
    expect(passedActor.components).toBeDefined();
    expect(passedActor.components['core:name']).toEqual({ text: 'Iker' });
    expect(passedActor.components['core:position']).toEqual({
      locationId: 'room1',
    });

    // Verify we got the expected result (ActionResult format)
    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].entityId).toBe('amaia');
  });
});
