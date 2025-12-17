/**
 * @file Unit tests for SensoryCapabilityService
 * @see src/perception/services/sensoryCapabilityService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SensoryCapabilityService from '../../../../src/perception/services/sensoryCapabilityService.js';

describe('SensoryCapabilityService', () => {
  let mockEntityManager;
  let mockBodyGraphService;
  let mockLogger;
  let service;

  /**
   * Helper to create a mock part health component
   * @param {string} state - Health state
   * @returns {Object} Part health component data
   */
  const createHealthComponent = (state = 'healthy') => ({
    currentHealth: state === 'destroyed' ? 0 : 10,
    maxHealth: 10,
    state,
  });

  /**
   * Helper to create a mock body component
   * @param {string} rootId - Root entity ID
   * @returns {Object} Body component data
   */
  const createBodyComponent = (rootId = 'body-root') => ({
    body: { root: rootId },
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockBodyGraphService = {
      findPartsByType: jest.fn(),
    };

    service = new SensoryCapabilityService({
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create service with valid dependencies', () => {
      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SensoryCapabilityService initialized'
      );
    });

    it('should throw when entityManager is missing required methods', () => {
      expect(() => {
        new SensoryCapabilityService({
          entityManager: {},
          bodyGraphService: mockBodyGraphService,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when bodyGraphService is missing required methods', () => {
      expect(() => {
        new SensoryCapabilityService({
          entityManager: mockEntityManager,
          bodyGraphService: {},
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('getSensoryCapabilities', () => {
    // Test Scenario 1: Entity with healthy eyes, ears, nose → all senses available
    describe('Scenario 1: Entity with healthy sensory organs', () => {
      it('should return all senses available when all organs are healthy', () => {
        const entityId = 'actor-healthy';

        // No manual override
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health')
              return createHealthComponent('healthy');
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false); // No dismembered

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.canFeel).toBe(true);
        expect(result.availableSenses).toContain('visual');
        expect(result.availableSenses).toContain('auditory');
        expect(result.availableSenses).toContain('olfactory');
        expect(result.availableSenses).toContain('tactile');
        expect(result.availableSenses).toContain('proprioceptive');
      });
    });

    // Test Scenario 2: Entity with destroyed eyes → canSee false, others true
    describe('Scenario 2: Entity with destroyed eyes', () => {
      it('should return canSee false when all eyes are destroyed', () => {
        const entityId = 'actor-blind';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') {
              // Eyes are destroyed, other parts healthy
              if (id.includes('eye')) return createHealthComponent('destroyed');
              return createHealthComponent('healthy');
            }
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.canFeel).toBe(true);
        expect(result.availableSenses).not.toContain('visual');
        expect(result.availableSenses).toContain('auditory');
      });
    });

    // Test Scenario 3: Entity with destroyed ears → canHear false, others true
    describe('Scenario 3: Entity with destroyed ears', () => {
      it('should return canHear false when all ears are destroyed', () => {
        const entityId = 'actor-deaf';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') {
              if (id.includes('ear')) return createHealthComponent('destroyed');
              return createHealthComponent('healthy');
            }
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.canHear).toBe(false);
        expect(result.canSmell).toBe(true);
        expect(result.availableSenses).not.toContain('auditory');
        expect(result.availableSenses).toContain('visual');
      });
    });

    // Test Scenario 4: Entity with destroyed nose → canSmell false, others true
    describe('Scenario 4: Entity with destroyed nose', () => {
      it('should return canSmell false when nose is destroyed', () => {
        const entityId = 'actor-anosmic';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') {
              if (id.includes('nose')) return createHealthComponent('destroyed');
              return createHealthComponent('healthy');
            }
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(false);
        expect(result.availableSenses).not.toContain('olfactory');
      });
    });

    // Test Scenario 5: Entity with no anatomy component → all senses available
    describe('Scenario 5: Entity without anatomy (backward compatibility)', () => {
      it('should return all senses available when no anatomy:body component', () => {
        const entityId = 'actor-no-anatomy';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body') return null; // No anatomy
            return null;
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.canFeel).toBe(true);
        expect(result.availableSenses).toContain('visual');
        expect(result.availableSenses).toContain('auditory');
        expect(result.availableSenses).toContain('olfactory');
        expect(result.availableSenses).toContain('tactile');
        expect(result.availableSenses).toContain('proprioceptive');

        // Should not call bodyGraphService when no anatomy
        expect(mockBodyGraphService.findPartsByType).not.toHaveBeenCalled();
      });
    });

    // Test Scenario 6: Entity with manual override component → uses override values
    describe('Scenario 6: Entity with manual override component', () => {
      it('should use override values when overrideMode is manual', () => {
        const entityId = 'actor-override';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') {
              return {
                overrideMode: 'manual',
                canSee: false,
                canHear: true,
                canSmell: false,
                canFeel: false, // This should still be true in result
              };
            }
            return null;
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(false);
        expect(result.canFeel).toBe(true); // Always true per spec
        expect(result.availableSenses).not.toContain('visual');
        expect(result.availableSenses).toContain('auditory');
        expect(result.availableSenses).not.toContain('olfactory');

        // Should not call bodyGraphService when using override
        expect(mockBodyGraphService.findPartsByType).not.toHaveBeenCalled();
      });

      it('should not use override when overrideMode is auto', () => {
        const entityId = 'actor-auto-override';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') {
              return {
                overrideMode: 'auto', // Not manual
                canSee: false,
              };
            }
            if (componentId === 'anatomy:body') return null; // No anatomy
            return null;
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        // Should fall through to backward compat (all available)
        expect(result.canSee).toBe(true);
      });
    });

    // Test Scenario 7: Entity with one destroyed eye but one healthy eye → canSee true
    describe('Scenario 7: Entity with partial eye damage', () => {
      it('should return canSee true when at least one eye is healthy', () => {
        const entityId = 'actor-one-eye';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') {
              // Left eye destroyed, right eye healthy
              if (id === 'eye-left') return createHealthComponent('destroyed');
              if (id === 'eye-right') return createHealthComponent('healthy');
              return createHealthComponent('healthy');
            }
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true); // At least one eye works
        expect(result.availableSenses).toContain('visual');
      });
    });

    // Test Scenario 8: Entity with no eyes at all → canSee false
    describe('Scenario 8: Entity with no eyes (missing/detached)', () => {
      it('should return canSee false when no eye parts exist', () => {
        const entityId = 'actor-no-eyes';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health')
              return createHealthComponent('healthy');
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return []; // No eyes!
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.availableSenses).not.toContain('visual');
      });

      it('should return canSee false when findPartsByType returns undefined', () => {
        const entityId = 'actor-undefined-eyes';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            return null;
          }
        );

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return undefined;
            return ['part-1'];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
      });
    });

    // Test Scenario 9: Entity with dismembered eyes → canSee false
    describe('Scenario 9: Entity with dismembered eyes', () => {
      it('should return canSee false when all eyes have anatomy:dismembered', () => {
        const entityId = 'actor-dismembered-eyes';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            // Eyes have healthy state but are dismembered
            if (componentId === 'anatomy:part_health')
              return createHealthComponent('healthy');
            return null;
          }
        );

        // Eyes are dismembered, other parts are not
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:dismembered') {
              return id.includes('eye'); // Only eyes are dismembered
            }
            return false;
          }
        );

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false); // All eyes dismembered
        expect(result.canHear).toBe(true); // Ears not dismembered
        expect(result.canSmell).toBe(true); // Nose not dismembered
        expect(result.availableSenses).not.toContain('visual');
        expect(result.availableSenses).toContain('auditory');
      });

      it('should return canSee true when one eye is dismembered but other is healthy', () => {
        const entityId = 'actor-partial-dismember';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health')
              return createHealthComponent('healthy');
            return null;
          }
        );

        // Only left eye is dismembered
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:dismembered') {
              return id === 'eye-left';
            }
            return false;
          }
        );

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true); // Right eye still works
        expect(result.availableSenses).toContain('visual');
      });
    });

    // Edge cases
    describe('Edge cases', () => {
      it('should return all senses when entityId is invalid', () => {
        const result = service.getSensoryCapabilities(null);

        expect(result.canSee).toBe(true);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.canFeel).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should handle body component with direct root property', () => {
        const entityId = 'actor-direct-root';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body') {
              return { root: 'body-root' }; // Direct root, not nested
            }
            if (componentId === 'anatomy:part_health')
              return createHealthComponent('healthy');
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockReturnValue(['part-1']);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(mockBodyGraphService.findPartsByType).toHaveBeenCalledWith(
          'body-root',
          'eye'
        );
      });

      it('should return all senses when body component has no root', () => {
        const entityId = 'actor-no-root';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body') {
              return { body: {} }; // No root
            }
            return null;
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
      });

      it('should always include tactile and proprioceptive in availableSenses', () => {
        const entityId = 'actor-any';

        mockEntityManager.getComponentData.mockReturnValue(null);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.availableSenses).toContain('tactile');
        expect(result.availableSenses).toContain('proprioceptive');
      });

      it('should handle parts without part_health component as functioning', () => {
        const entityId = 'actor-no-health';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') return null; // No health component
            return null;
          }
        );

        mockEntityManager.hasComponent.mockReturnValue(false);

        mockBodyGraphService.findPartsByType.mockReturnValue(['eye-1']);

        const result = service.getSensoryCapabilities(entityId);

        // Parts without health component should be considered functioning
        expect(result.canSee).toBe(true);
      });
    });

    // Combination scenarios
    describe('Combination scenarios', () => {
      it('should handle multiple impairments correctly', () => {
        const entityId = 'actor-multi-impaired';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') {
              // Eyes destroyed, ears healthy, nose healthy
              if (id.includes('eye')) return createHealthComponent('destroyed');
              return createHealthComponent('healthy');
            }
            return null;
          }
        );

        // Ears are dismembered
        mockEntityManager.hasComponent.mockImplementation(
          (id, componentId) => {
            if (componentId === 'anatomy:dismembered') {
              return id.includes('ear');
            }
            return false;
          }
        );

        mockBodyGraphService.findPartsByType.mockImplementation(
          (rootId, partType) => {
            if (partType === 'eye') return ['eye-left', 'eye-right'];
            if (partType === 'ear') return ['ear-left', 'ear-right'];
            if (partType === 'nose') return ['nose-1'];
            return [];
          }
        );

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false); // Eyes destroyed
        expect(result.canHear).toBe(false); // Ears dismembered
        expect(result.canSmell).toBe(true); // Nose healthy
        expect(result.canFeel).toBe(true); // Always true
        expect(result.availableSenses).toEqual([
          'olfactory',
          'tactile',
          'proprioceptive',
        ]);
      });
    });
  });
});
