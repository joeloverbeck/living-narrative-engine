import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { createTargetResolutionServiceWithMocks } from '../../common/mocks/mockUnifiedScopeResolver.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../src/constants/targetDomains.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

// Reuse simple mocks similar to scope-loading tests

describe('TargetResolutionService - additional branches', () => {
  let service;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockEntityManager;
  let mockLogger;
  let mockSafeDispatcher;
  let mockJsonLogic;

  beforeEach(() => {
    mockScopeRegistry = { getScope: jest.fn() };
    mockScopeEngine = { resolve: jest.fn() };
    mockEntityManager = {};
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    mockSafeDispatcher = { dispatch: jest.fn() };
    mockJsonLogic = { evaluate: jest.fn() };
    const mockDslParser = { parse: jest.fn(() => generateMockAst('')) };

    service = createTargetResolutionServiceWithMocks({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeDispatcher,
      jsonLogicEvaluationService: mockJsonLogic,
      dslParser: mockDslParser,
      actionErrorContextBuilder: createMockActionErrorContextBuilder(),
    });
  });

  it('returns a no target context when scope is none', () => {
    const actor = { id: 'hero' };
    const result = service.resolveTargets(TARGET_DOMAIN_NONE, actor, {});
    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.noTarget()]);
    expect(result.errors).toEqual([]);
    expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
    expect(mockScopeEngine.resolve).not.toHaveBeenCalled();
    expect(mockSafeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('returns the actor as target when scope is self', () => {
    const actor = { id: 'hero' };
    const result = service.resolveTargets(TARGET_DOMAIN_SELF, actor, {});
    expect(result.success).toBe(true);
    expect(result.value).toEqual([ActionTargetContext.forEntity('hero')]);
    expect(result.errors).toEqual([]);
    expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
    expect(mockScopeEngine.resolve).not.toHaveBeenCalled();
    expect(mockSafeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('handles undefined scope resolution result with error', () => {
    const expr = 'actor';
    const def = {
      name: 'core:test',
      expr: expr,
      ast: generateMockAst(expr),
      modId: 'core',
      source: 'file',
    };
    mockScopeRegistry.getScope.mockReturnValue(def);
    mockScopeEngine.resolve.mockReturnValue(undefined);

    const actor = { id: 'hero' };
    const result = service.resolveTargets('core:test', actor, {});

    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.errors).toHaveLength(1);

    // The error is an Error object created by ActionResult.failure
    // It should have the original error information preserved
    const errorObj = result.errors[0];
    expect(errorObj).toBeInstanceOf(Error);

    // The ActionErrorContext is converted to a string, but the original error
    // should be preserved in the error properties
    expect(
      errorObj.actionId || errorObj.error?.message || errorObj.message
    ).toBeDefined();

    expect(mockScopeEngine.resolve).toHaveBeenCalled();
  });
});
