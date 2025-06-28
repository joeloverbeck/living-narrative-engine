import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../src/constants/targetDomains.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { generateMockAst } from '../../common/scopeDsl/mockAstGenerator.js';

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

    service = new TargetResolutionService({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockSafeDispatcher,
      jsonLogicEvaluationService: mockJsonLogic,
    });
  });

  it('returns a no target context when scope is none', () => {
    const actor = { id: 'hero' };
    const result = service.resolveTargets(TARGET_DOMAIN_NONE, actor, {});
    expect(result).toEqual([ActionTargetContext.noTarget()]);
    expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
    expect(mockScopeEngine.resolve).not.toHaveBeenCalled();
    expect(mockSafeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('returns the actor as target when scope is self', () => {
    const actor = { id: 'hero' };
    const result = service.resolveTargets(TARGET_DOMAIN_SELF, actor, {});
    expect(result).toEqual([ActionTargetContext.forEntity('hero')]);
    expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
    expect(mockScopeEngine.resolve).not.toHaveBeenCalled();
    expect(mockSafeDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('handles undefined scope resolution result gracefully', () => {
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

    expect(result).toEqual([]);
    expect(mockScopeEngine.resolve).toHaveBeenCalled();
    expect(mockSafeDispatcher.dispatch).not.toHaveBeenCalled();
  });
});
