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
      getAllParts: jest.fn(),
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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

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
        expect(mockBodyGraphService.getAllParts).not.toHaveBeenCalled();
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
        expect(mockBodyGraphService.getAllParts).not.toHaveBeenCalled();
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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true); // At least one eye works
        expect(result.availableSenses).toContain('visual');
      });
    });

    // Test Scenario 8: Entity with no parts with sight affordance → canSee false
    describe('Scenario 8: Entity with no parts with sight affordance', () => {
      it('should return canSee false when no parts have anatomy:provides_sight', () => {
        const entityId = 'actor-no-sight-affordance';

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

        // No parts have sight affordance
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return false; // No sight affordance!
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.availableSenses).not.toContain('visual');
      });

      it('should return canSee false when getAllParts returns empty array', () => {
        const entityId = 'actor-no-parts';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue([]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(false);
        expect(result.canSmell).toBe(false);
      });

      it('should return all false when getAllParts returns undefined', () => {
        const entityId = 'actor-undefined-parts';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            return null;
          }
        );

        mockBodyGraphService.getAllParts.mockReturnValue(undefined);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(false);
        expect(result.canSmell).toBe(false);
      });
    });

    // Test Scenario 9: Entity with dismembered parts → sense unavailable
    describe('Scenario 9: Entity with dismembered sensory parts', () => {
      it('should return canSee false when all parts with sight affordance are dismembered', () => {
        const entityId = 'actor-dismembered-eyes';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            // Parts have healthy state but are dismembered
            if (componentId === 'anatomy:part_health')
              return createHealthComponent('healthy');
            return null;
          }
        );

        // Eyes have sight affordance but are dismembered
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') {
            return id.includes('eye'); // Only eyes are dismembered
          }
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false); // All eyes dismembered
        expect(result.canHear).toBe(true); // Ears not dismembered
        expect(result.canSmell).toBe(true); // Nose not dismembered
        expect(result.availableSenses).not.toContain('visual');
        expect(result.availableSenses).toContain('auditory');
      });

      it('should return canSee true when one eye is dismembered but other is functioning', () => {
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
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') {
            return id === 'eye-left';
          }
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'ear-left',
          'nose-1',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(mockBodyGraphService.getAllParts).toHaveBeenCalled();
      });

      it('should return no senses when body component has no root (malformed anatomy)', () => {
        const entityId = 'actor-no-root';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body') {
              return { body: {} }; // No root - malformed anatomy
            }
            return null;
          }
        );

        // Malformed body with no root means getAllParts returns empty array
        mockBodyGraphService.getAllParts.mockReturnValue([]);

        const result = service.getSensoryCapabilities(entityId);

        // Malformed anatomy (exists but no parts) = no senses available
        // This differs from no anatomy at all (backward compat = all senses)
        expect(result.canSee).toBe(false);
        expect(result.canHear).toBe(false);
        expect(result.canSmell).toBe(false);
        expect(result.canFeel).toBe(true); // Always true per spec
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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue(['eye-1']);

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

        // Eyes have sight affordance but are destroyed; ears have hearing but are dismembered
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return id.includes('eye');
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:provides_smell')
            return id.includes('nose');
          if (componentId === 'anatomy:dismembered') {
            return id.includes('ear'); // Only ears are dismembered
          }
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eye-left',
          'eye-right',
          'ear-left',
          'ear-right',
          'nose-1',
        ]);

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

    // Exotic creature scenarios (component-based affordance detection)
    describe('Exotic creature scenarios', () => {
      it('should detect sight from exotic eye with anatomy:provides_sight', () => {
        const entityId = 'actor-eldritch';

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

        // Exotic eye has sight affordance
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight')
            return id === 'eldritch_baleful_eye';
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'eldritch_baleful_eye',
          'tentacle-1',
          'tentacle-2',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.availableSenses).toContain('visual');
      });

      it('should detect sight from standard eye with anatomy:provides_sight', () => {
        const entityId = 'actor-human';

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

        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight')
            return id === 'human_eye_blue';
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'human_eye_blue',
          'human_ear',
          'human_nose',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.availableSenses).toContain('visual');
      });

      it('should return canSee false when eye lacks anatomy:provides_sight', () => {
        const entityId = 'actor-blind-eye';

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

        // Eye part exists but has no sight affordance component
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight') return false;
          if (componentId === 'anatomy:provides_hearing')
            return id.includes('ear');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'decorative_eye', // Has eye in name but no provides_sight
          'ear-left',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(false);
        expect(result.availableSenses).not.toContain('visual');
      });

      it('should detect multiple senses from multi-sense organ', () => {
        const entityId = 'actor-multi-sense';

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

        // Single part provides both sight and smell (exotic creature)
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (id === 'eldritch_tentacle') {
            if (componentId === 'anatomy:provides_sight') return true;
            if (componentId === 'anatomy:provides_smell') return true;
          }
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue(['eldritch_tentacle']);

        const result = service.getSensoryCapabilities(entityId);

        expect(result.canSee).toBe(true);
        expect(result.canSmell).toBe(true);
        expect(result.canHear).toBe(false); // No hearing affordance
        expect(result.availableSenses).toContain('visual');
        expect(result.availableSenses).toContain('olfactory');
        expect(result.availableSenses).not.toContain('auditory');
      });

      it('should handle partial damage with multiple visual organs', () => {
        const entityId = 'actor-multiple-eyes';

        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (componentId === 'perception:sensory_capability') return null;
            if (componentId === 'anatomy:body')
              return createBodyComponent('body-root');
            if (componentId === 'anatomy:part_health') {
              // Only spider_eye_3 is destroyed
              if (id === 'spider_eye_3')
                return createHealthComponent('destroyed');
              return createHealthComponent('healthy');
            }
            return null;
          }
        );

        // All spider eyes have sight affordance
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          if (componentId === 'anatomy:provides_sight')
            return id.includes('spider_eye');
          if (componentId === 'anatomy:dismembered') return false;
          return false;
        });

        mockBodyGraphService.getAllParts.mockReturnValue([
          'spider_eye_1',
          'spider_eye_2',
          'spider_eye_3',
          'spider_eye_4',
        ]);

        const result = service.getSensoryCapabilities(entityId);

        // Should still have sight because spider_eye_1, 2, 4 are functioning
        expect(result.canSee).toBe(true);
        expect(result.availableSenses).toContain('visual');
      });
    });
  });
});
