/**
 * @file Unit tests for ActivityContextBuildingSystem
 * @see src/anatomy/services/context/activityContextBuildingSystem.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityContextBuildingSystem from '../../../../../src/anatomy/services/context/activityContextBuildingSystem.js';

describe('ActivityContextBuildingSystem', () => {
  let system;
  let mockEntityManager;
  let mockLogger;
  let mockNLGSystem;

  beforeEach(() => {
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockNLGSystem = {
      detectEntityGender: jest.fn(),
      mergeAdverb: jest.fn((current, injected) => `${current} ${injected}`),
      injectSoftener: jest.fn((template, descriptor) => `${template} [${descriptor}]`),
    };

    system = new ActivityContextBuildingSystem({
      entityManager: mockEntityManager,
      logger: mockLogger,
      nlgSystem: mockNLGSystem,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(system).toBeDefined();
    });

    it('should throw error for missing entityManager', () => {
      expect(() => {
        new ActivityContextBuildingSystem({
          entityManager: null,
          logger: mockLogger,
          nlgSystem: mockNLGSystem,
        });
      }).toThrow();
    });

    it('should throw error for invalid entityManager', () => {
      expect(() => {
        new ActivityContextBuildingSystem({
          entityManager: {},
          logger: mockLogger,
          nlgSystem: mockNLGSystem,
        });
      }).toThrow();
    });

    it('should throw error for missing logger', () => {
      expect(() => {
        new ActivityContextBuildingSystem({
          entityManager: mockEntityManager,
          logger: null,
          nlgSystem: mockNLGSystem,
        });
      }).toThrow();
    });

    it('should throw error for missing nlgSystem', () => {
      expect(() => {
        new ActivityContextBuildingSystem({
          entityManager: mockEntityManager,
          logger: mockLogger,
          nlgSystem: null,
        });
      }).toThrow();
    });

    it('should throw error for invalid nlgSystem', () => {
      expect(() => {
        new ActivityContextBuildingSystem({
          entityManager: mockEntityManager,
          logger: mockLogger,
          nlgSystem: {},
        });
      }).toThrow();
    });
  });

  describe('buildActivityContext', () => {
    it('should build complete context with all properties', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['target1'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockNLGSystem.detectEntityGender.mockReturnValue('female');

      const activity = {
        targetEntityId: 'target1',
        priority: 85,
      };

      const context = system.buildActivityContext('actor1', activity);

      expect(context).toEqual({
        targetId: 'target1',
        intensity: 'elevated',
        relationshipTone: 'closeness_partner',
        targetGender: 'female',
      });
    });

    it('should detect closeness_partner relationship', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['target1', 'target2'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('closeness_partner');
    });

    it('should use neutral tone when target is not a partner', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['other1', 'other2'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('neutral');
    });

    it('should handle missing closeness component', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => null),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('neutral');
    });

    it('should handle activities without targets', () => {
      const activity = { priority: 50 };
      const context = system.buildActivityContext('actor1', activity);

      expect(context).toEqual({
        targetId: null,
        intensity: 'casual',
        relationshipTone: 'neutral',
        targetGender: null,
      });
    });

    it('should handle null actorId', () => {
      const activity = { targetEntityId: 'target1', priority: 50 };
      const context = system.buildActivityContext(null, activity);

      expect(context.targetId).toBe('target1');
      expect(context.relationshipTone).toBe('neutral');
      expect(context.targetGender).toBeNull();
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    it('should handle null activity', () => {
      const context = system.buildActivityContext('actor1', null);

      expect(context).toEqual({
        targetId: null,
        intensity: 'casual',
        relationshipTone: 'neutral',
        targetGender: null,
      });
    });

    it('should fallback to targetId when targetEntityId is missing', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: [],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const activity = { targetId: 'target1', priority: 50 };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.targetId).toBe('target1');
    });

    it('should detect target gender via nlgSystem', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: [],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
      mockNLGSystem.detectEntityGender.mockReturnValue('male');

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(mockNLGSystem.detectEntityGender).toHaveBeenCalledWith('target1');
      expect(context.targetGender).toBe('male');
    });

    it('should cache closeness partner arrays', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['target1'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      // First call
      system.buildActivityContext('actor1', { targetEntityId: 'target1' });
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(1);

      // Second call should use cache
      system.buildActivityContext('actor1', { targetEntityId: 'target2' });
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(1);
    });

    it('should handle entity retrieval errors gracefully', () => {
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('neutral');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve closeness data'),
        expect.any(Error)
      );
    });

    it('should handle invalid closeness data structure', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: 'invalid-not-an-array',
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const activity = { targetEntityId: 'target1' };
      const context = system.buildActivityContext('actor1', activity);

      expect(context.relationshipTone).toBe('neutral');
    });
  });

  describe('determineActivityIntensity', () => {
    it('should map priority >= 90 to intense', () => {
      expect(system.determineActivityIntensity(90)).toBe('intense');
      expect(system.determineActivityIntensity(95)).toBe('intense');
      expect(system.determineActivityIntensity(100)).toBe('intense');
    });

    it('should map priority >= 70 to elevated', () => {
      expect(system.determineActivityIntensity(70)).toBe('elevated');
      expect(system.determineActivityIntensity(75)).toBe('elevated');
      expect(system.determineActivityIntensity(89)).toBe('elevated');
    });

    it('should map priority < 70 to casual', () => {
      expect(system.determineActivityIntensity(0)).toBe('casual');
      expect(system.determineActivityIntensity(30)).toBe('casual');
      expect(system.determineActivityIntensity(69)).toBe('casual');
    });

    it('should handle boundary values correctly', () => {
      expect(system.determineActivityIntensity(69)).toBe('casual');
      expect(system.determineActivityIntensity(70)).toBe('elevated');
      expect(system.determineActivityIntensity(89)).toBe('elevated');
      expect(system.determineActivityIntensity(90)).toBe('intense');
    });

    it('should default to casual for undefined priority', () => {
      expect(system.determineActivityIntensity()).toBe('casual');
      expect(system.determineActivityIntensity(undefined)).toBe('casual');
    });

    it('should handle negative priorities gracefully', () => {
      expect(system.determineActivityIntensity(-10)).toBe('casual');
    });

    it('should handle zero priority', () => {
      expect(system.determineActivityIntensity(0)).toBe('casual');
    });
  });

  describe('applyContextualTone', () => {
    it('should apply intimate tone for closeness_partner', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'closeness_partner',
        intensity: 'casual',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.contextualTone).toBe('intimate');
      expect(adjusted.template).toBe('test template');
    });

    it('should apply intense tone for high priority', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'intense',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.contextualTone).toBe('intense');
    });

    it('should merge fiercely adverb for intense activities with existing adverb', () => {
      const activity = {
        type: 'dedicated',
        adverb: 'quickly',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'intense',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(mockNLGSystem.mergeAdverb).toHaveBeenCalledWith('quickly', 'fiercely');
      expect(adjusted.adverb).toBe('quickly fiercely');
    });

    it('should add fiercely adverb for intense dedicated activities without adverb', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'intense',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.adverb).toBe('fiercely');
    });

    it('should inject fiercely softener into template for intense activities', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'intense',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(mockNLGSystem.injectSoftener).toHaveBeenCalledWith('test template', 'fiercely');
      expect(adjusted.template).toBe('test template [fiercely]');
    });

    it('should handle activities without context', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };

      const adjusted = system.applyContextualTone(activity, null);

      expect(adjusted).toEqual(activity);
    });

    it('should handle activities without targetId in context', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: null,
        relationshipTone: 'neutral',
        intensity: 'casual',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted).toEqual(activity);
    });

    it('should preserve original activity data when creating adjusted copy', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
        customField: 'customValue',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'casual',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.customField).toBe('customValue');
      expect(adjusted).not.toBe(activity); // Should be a new object
    });

    it('should return early for closeness_partner without applying intense tone', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
        adverb: 'quickly',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'closeness_partner',
        intensity: 'intense',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.contextualTone).toBe('intimate');
      expect(mockNLGSystem.mergeAdverb).not.toHaveBeenCalled();
      expect(mockNLGSystem.injectSoftener).not.toHaveBeenCalled();
    });

    it('should not modify activity for casual intensity with neutral tone', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'casual',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.contextualTone).toBeUndefined();
    });

    it('should not modify activity for elevated intensity with neutral tone', () => {
      const activity = {
        type: 'dedicated',
        template: 'test template',
      };
      const context = {
        targetId: 'target1',
        relationshipTone: 'neutral',
        intensity: 'elevated',
      };

      const adjusted = system.applyContextualTone(activity, context);

      expect(adjusted.contextualTone).toBeUndefined();
    });
  });

  describe('Cache Behavior', () => {
    it('should cache closeness partners on first access', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['target1'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const hooks = system.getTestHooks();
      const partners1 = hooks.getClosenessPartners('actor1');
      const partners2 = hooks.getClosenessPartners('actor1');

      expect(partners1).toEqual(['target1']);
      expect(partners2).toEqual(['target1']);
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(1);
    });

    it('should maintain separate cache entries for different actors', () => {
      const mockEntity1 = {
        getComponentData: jest.fn(() => ({
          partners: ['target1'],
        })),
      };

      const mockEntity2 = {
        getComponentData: jest.fn(() => ({
          partners: ['target2'],
        })),
      };

      mockEntityManager.getEntityInstance
        .mockReturnValueOnce(mockEntity1)
        .mockReturnValueOnce(mockEntity2);

      const hooks = system.getTestHooks();
      const partners1 = hooks.getClosenessPartners('actor1');
      const partners2 = hooks.getClosenessPartners('actor2');

      expect(partners1).toEqual(['target1']);
      expect(partners2).toEqual(['target2']);
      expect(mockEntity1.getComponentData).toHaveBeenCalledTimes(1);
      expect(mockEntity2.getComponentData).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when clearCache is called', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['target1'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const hooks = system.getTestHooks();
      hooks.getClosenessPartners('actor1');
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(1);

      system.clearCache();

      hooks.getClosenessPartners('actor1');
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTestHooks', () => {
    it('should expose buildActivityContext through test hooks', () => {
      const hooks = system.getTestHooks();
      expect(hooks.buildActivityContext).toBeDefined();
      expect(typeof hooks.buildActivityContext).toBe('function');
    });

    it('should expose determineActivityIntensity through test hooks', () => {
      const hooks = system.getTestHooks();
      expect(hooks.determineActivityIntensity).toBeDefined();
      expect(typeof hooks.determineActivityIntensity).toBe('function');
    });

    it('should expose applyContextualTone through test hooks', () => {
      const hooks = system.getTestHooks();
      expect(hooks.applyContextualTone).toBeDefined();
      expect(typeof hooks.applyContextualTone).toBe('function');
    });

    it('should expose getClosenessPartners through test hooks', () => {
      const hooks = system.getTestHooks();
      expect(hooks.getClosenessPartners).toBeDefined();
      expect(typeof hooks.getClosenessPartners).toBe('function');
    });

    it('should allow access to private getClosenessPartners method', () => {
      const mockEntity = {
        getComponentData: jest.fn(() => ({
          partners: ['target1'],
        })),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

      const hooks = system.getTestHooks();
      const partners = hooks.getClosenessPartners('actor1');

      expect(partners).toEqual(['target1']);
    });
  });
});
