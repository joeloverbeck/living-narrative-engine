import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

// Additional tests to cover branches not exercised in other suites

describe('TargetResolutionService uncovered branches', () => {
  let service;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockEntityManager;
  let mockLogger;
  let mockDispatcher;
  let mockJsonLogic;
  let mockDslParser;

  beforeEach(() => {
    mockScopeRegistry = { getScope: jest.fn() };
    mockScopeEngine = { resolve: jest.fn() };
    mockEntityManager = { getComponentData: jest.fn() };
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    mockDispatcher = { dispatch: jest.fn() };
    mockJsonLogic = { evaluate: jest.fn() };
    mockDslParser = { parse: jest.fn((expr) => generateMockAst(expr)) };

    service = new TargetResolutionService({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
      jsonLogicEvaluationService: mockJsonLogic,
      dslParser: mockDslParser,
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });
  });

  it('creates empty components when componentTypeIds are missing', () => {
    const expr = 'actor';
    const scopeDef = {
      name: 'core:test',
      expr,
      ast: generateMockAst(expr),
      modId: 'core',
      source: 'file',
    };
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    mockScopeEngine.resolve.mockReturnValue(new Set(['e1']));

    const actor = { id: 'hero' }; // no componentTypeIds
    const trace = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const result = service.resolveTargets(
      'core:test',
      actor,
      {
        currentLocation: { id: 'loc' },
      },
      trace
    );

    expect(result.error).toBeUndefined();
    expect(result.targets).toEqual([ActionTargetContext.forEntity('e1')]);
    expect(trace.warn).toHaveBeenCalled();
    expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
  });

  it('logs component data errors without throwing', () => {
    const expr = 'actor';
    const scopeDef = {
      name: 'core:test',
      expr,
      ast: generateMockAst(expr),
      modId: 'core',
      source: 'file',
    };
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    const error = new Error('fail');
    mockEntityManager.getComponentData.mockImplementation(() => {
      throw error;
    });
    mockScopeEngine.resolve.mockReturnValue(new Set(['e2']));
    const trace = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const actor = { id: 'hero', componentTypeIds: ['c1'] };
    const result = service.resolveTargets(
      'core:test',
      actor,
      { currentLocation: {} },
      trace
    );

    // When all component loads fail, the service now returns an error
    expect(result.error).toBeDefined();
    expect(result.targets).toEqual([]);
    expect(trace.error).toHaveBeenCalledWith(
      `Failed to get component data for c1 on actor hero: ${error.message}`,
      'TargetResolutionService.#resolveScopeToIds'
    );
  });
});
