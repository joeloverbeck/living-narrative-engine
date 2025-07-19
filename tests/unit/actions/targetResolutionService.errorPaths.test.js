import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

// New tests covering error branches in #resolveScopeToIds

describe('TargetResolutionService error paths', () => {
  let service;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockLogger;
  let mockSafeDispatcher;
  let mockJsonLogic;
  let mockDslParser;

  beforeEach(() => {
    mockScopeRegistry = { getScope: jest.fn() };
    mockScopeEngine = { resolve: jest.fn() };
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    mockSafeDispatcher = { dispatch: jest.fn() };
    mockJsonLogic = { evaluate: jest.fn() };
    mockDslParser = { parse: jest.fn((expr) => generateMockAst(expr)) };

    service = new TargetResolutionService({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: {},
      logger: mockLogger,
      safeEventDispatcher: mockSafeDispatcher,
      jsonLogicEvaluationService: mockJsonLogic,
      dslParser: mockDslParser,
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });
  });

  it('handles parser exceptions when resolving scopes', () => {
    const expr = 'actor';
    const scopeDef = { name: 'core:test', expr, modId: 'core', source: 'file' };
    const parseErr = new Error('parse fail');
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    mockDslParser.parse.mockImplementation(() => {
      throw parseErr;
    });

    const result = service.resolveTargets('core:test', { id: 'hero' }, {});

    expect(result.targets).toEqual([]);
    expect(result.error).toBeDefined();
    expect(result.error.name).toBe('ScopeParseError');
    // Parser errors are now handled internally and returned as part of the result
    // rather than being dispatched as system errors
  });

  it('handles scopeEngine errors during resolution', () => {
    const expr = 'actor';
    const scopeDef = {
      name: 'core:test',
      expr,
      ast: generateMockAst(expr),
      modId: 'core',
      source: 'file',
    };
    const resolveErr = new Error('resolve fail');
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    mockScopeEngine.resolve.mockImplementation(() => {
      throw resolveErr;
    });

    const result = service.resolveTargets('core:test', { id: 'hero' }, {});

    expect(result.targets).toEqual([]);
    expect(result.error).toBeDefined();
    // Note: Enhanced error context changes return type and logger behavior
    expect(mockSafeDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.any(String),
        details: expect.any(Object),
      })
    );
  });
});
