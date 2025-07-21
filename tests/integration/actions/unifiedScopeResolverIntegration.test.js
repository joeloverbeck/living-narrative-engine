/**
 * @file Integration tests for UnifiedScopeResolver delegation from TargetResolutionService
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../src/constants/targetDomains.js';

describe('UnifiedScopeResolver Integration', () => {
  let container;
  let targetResolutionService;

  beforeEach(() => {
    // Create DOM elements needed by container configuration
    const outputDiv = document.createElement('div');
    const inputElement = document.createElement('input');
    const titleElement = document.createElement('h1');

    // Create and configure container
    container = new AppContainer();
    configureContainer(container, {
      outputDiv,
      inputElement,
      titleElement,
      document,
    });

    // Resolve services
    targetResolutionService = container.resolve(
      tokens.ITargetResolutionService
    );
  });

  describe('TargetResolutionService delegation to UnifiedScopeResolver', () => {
    it('should successfully resolve special scope NONE', () => {
      const actorEntity = {
        id: 'actor123',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const discoveryContext = {
        currentLocation: 'location1',
      };

      const result = targetResolutionService.resolveTargets(
        TARGET_DOMAIN_NONE,
        actorEntity,
        discoveryContext
      );

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(ActionTargetContext.noTarget());
    });

    it('should successfully resolve special scope SELF', () => {
      const actorEntity = {
        id: 'actor456',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const discoveryContext = {
        currentLocation: 'location2',
      };

      const result = targetResolutionService.resolveTargets(
        TARGET_DOMAIN_SELF,
        actorEntity,
        discoveryContext
      );

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(
        ActionTargetContext.forEntity('actor456')
      );
    });

    it('should handle validation errors consistently', () => {
      const discoveryContext = {
        currentLocation: 'location3',
      };

      // Test with null actor
      const result = targetResolutionService.resolveTargets(
        'test:invalid-scope',
        null,
        discoveryContext
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      // The error context is wrapped, need to access the actual error
      const errorContext = result.errors[0];
      expect(errorContext.error.message).toContain(
        'Resolution context is missing actor entity'
      );
      expect(errorContext.error.name).toBe('InvalidContextError');
    });

    it('should handle missing scope definitions', () => {
      const actorEntity = {
        id: 'actor789',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const discoveryContext = {
        currentLocation: 'location4',
      };

      // Use a scope that doesn't exist
      const result = targetResolutionService.resolveTargets(
        'test:non-existent-scope',
        actorEntity,
        discoveryContext
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      // The error context is wrapped, need to access the actual error
      const errorContext = result.errors[0];
      expect(errorContext.error.message).toContain('Missing scope definition');
      expect(errorContext.error.name).toBe('ScopeNotFoundError');
    });
  });

  describe('UnifiedScopeResolver features', () => {
    it('should support batch resolution through UnifiedScopeResolver', () => {
      const unifiedScopeResolver = container.resolve(
        tokens.IUnifiedScopeResolver
      );

      const requests = [
        {
          scopeName: TARGET_DOMAIN_NONE,
          context: {
            actor: { id: 'actor1' },
            actorLocation: 'loc1',
            actionContext: { currentLocation: 'loc1' },
          },
        },
        {
          scopeName: TARGET_DOMAIN_SELF,
          context: {
            actor: { id: 'actor2' },
            actorLocation: 'loc2',
            actionContext: { currentLocation: 'loc2' },
          },
        },
      ];

      const result = unifiedScopeResolver.resolveBatch(requests);

      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Map);
      expect(result.value.size).toBe(2);

      expect(result.value.get(TARGET_DOMAIN_NONE).size).toBe(0);
      expect(result.value.get(TARGET_DOMAIN_SELF).size).toBe(1);
      expect(Array.from(result.value.get(TARGET_DOMAIN_SELF))[0]).toBe(
        'actor2'
      );
    });
  });
});
