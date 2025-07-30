import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

// Additional coverage focusing on trace usage and branch conditions

describe('TargetResolutionService additional coverage', () => {
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
    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    mockDispatcher = { dispatch: jest.fn() };
    mockJsonLogic = { evaluate: jest.fn() };
    mockDslParser = { parse: jest.fn((expr) => generateMockAst(expr)) };

    service = createTargetResolutionServiceWithMocks({
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

  it('resolves using pre-parsed AST and logs to trace', () => {
    const expr = 'actor';
    const scopeDef = {
      name: 'core:test',
      expr,
      ast: generateMockAst(expr),
      modId: 'core',
      source: 'file',
    };
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    mockScopeEngine.resolve.mockReturnValue(new Set(['e1', 'e2']));
    const trace = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const result = service.resolveTargets(
      'core:test',
      { id: 'hero' },
      {},
      trace
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([
      ActionTargetContext.forEntity('e1'),
      ActionTargetContext.forEntity('e2'),
    ]);
    expect(trace.info).toHaveBeenCalled();
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('handles non-string expressions with warning and trace', () => {
    const scopeDef = { name: 'bad', expr: 123, modId: 'core', source: 'file' };
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    const trace = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const result = service.resolveTargets('bad', { id: 'hero' }, {}, trace);

    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveLength(1);
    // The error is wrapped in an error context object
    expect(result.errors[0].error.message).toContain(
      'Missing scope definition'
    );
    expect(result.errors[0].error.name).toBe('ScopeNotFoundError');
    // With the new unified approach, errors are returned in the result, not dispatched
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('reports parser errors through logger.error and trace', () => {
    const expr = 'actor';
    const scopeDef = { name: 'core:test', expr, modId: 'core', source: 'file' };
    const parseErr = new Error('parse fail');
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    mockDslParser.parse.mockImplementation(() => {
      throw parseErr;
    });
    const trace = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const result = service.resolveTargets(
      'core:test',
      { id: 'hero' },
      {},
      trace
    );

    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveLength(1);
    // The error is wrapped in an error context object
    expect(result.errors[0].error.message).toContain('parse fail');
    expect(result.errors[0].error.name).toBe('ScopeParseError');
    // Parser errors are now handled internally and returned as part of the result
    // rather than being dispatched as system errors
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });
});
