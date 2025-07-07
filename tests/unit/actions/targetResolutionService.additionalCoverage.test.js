import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';

// Additional coverage focusing on trace usage and branch conditions

describe('TargetResolutionService additional coverage', () => {
  let service;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockLogger;
  let mockDispatcher;
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
    mockDispatcher = { dispatch: jest.fn() };
    mockJsonLogic = { evaluate: jest.fn() };
    mockDslParser = { parse: jest.fn((expr) => generateMockAst(expr)) };

    service = new TargetResolutionService({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: {},
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
      jsonLogicEvaluationService: mockJsonLogic,
      dslParser: mockDslParser,
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
    const trace = { info: jest.fn(), error: jest.fn() };

    const result = service.resolveTargets(
      'core:test',
      { id: 'hero' },
      {},
      trace
    );

    expect(result.error).toBeUndefined();
    expect(result.targets).toEqual([
      ActionTargetContext.forEntity('e1'),
      ActionTargetContext.forEntity('e2'),
    ]);
    expect(trace.info).toHaveBeenCalled();
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('handles non-string expressions with warning and trace', () => {
    const scopeDef = { name: 'bad', expr: 123, modId: 'core', source: 'file' };
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    const trace = { info: jest.fn(), error: jest.fn() };

    const result = service.resolveTargets('bad', { id: 'hero' }, {}, trace);

    expect(result.targets).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(trace.error).toHaveBeenCalled();
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Missing scope definition'),
      })
    );
  });

  it('reports parser errors through logger.error and trace', () => {
    const expr = 'actor';
    const scopeDef = { name: 'core:test', expr, modId: 'core', source: 'file' };
    const parseErr = new Error('parse fail');
    mockScopeRegistry.getScope.mockReturnValue(scopeDef);
    mockDslParser.parse.mockImplementation(() => {
      throw parseErr;
    });
    const trace = { info: jest.fn(), error: jest.fn() };

    const result = service.resolveTargets(
      'core:test',
      { id: 'hero' },
      {},
      trace
    );

    expect(result.targets).toEqual([]);
    expect(result.error).toBe(parseErr);
    expect(mockLogger.error).toHaveBeenCalled();
    expect(trace.error).toHaveBeenCalled();
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('parse fail'),
      })
    );
  });
});
