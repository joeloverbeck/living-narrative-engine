import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
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

    service = createTargetResolutionServiceWithMocks({
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

    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveLength(1);
    // The enhanced error has the error properties directly on it
    expect(result.errors[0].name).toBe('ScopeParseError');
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

    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveLength(1);
    // The new implementation doesn't dispatch errors directly
  });
});
