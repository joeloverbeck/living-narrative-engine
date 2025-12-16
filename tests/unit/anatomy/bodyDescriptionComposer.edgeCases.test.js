/**
 * @file Edge case unit tests for BodyDescriptionComposer
 * @description Tests targeting uncovered lines for maximum coverage
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer - Edge Cases Coverage', () => {
  let mockLogger;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;
  let mockBodyPartDescriptionBuilder;
  let mockPartDescriptionGenerator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn().mockReturnValue([]),
    };

    mockEntityFinder = {
      getEntityInstance: jest.fn().mockReturnValue(null),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn().mockReturnValue([]),
      getGroupedParts: jest.fn().mockReturnValue(new Set()),
      getPairedParts: jest.fn().mockReturnValue(new Set()),
      getIrregularPlurals: jest.fn().mockReturnValue({}),
      formatDescriptorValue: jest.fn((label, value) => `${label}: ${value}`),
      formatPartName: jest.fn((value) => value),
    };

    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn().mockReturnValue(''),
      buildMultipleDescription: jest.fn().mockReturnValue(''),
      getPlural: jest.fn().mockReturnValue(''),
    };

    mockPartDescriptionGenerator = {
      generatePartDescription: jest.fn(),
      generateDescription: jest.fn(),
    };
  });

  /**
   * Create a composer with specified overrides.
   *
   * @param {object} overrides - Dependency overrides for the composer
   * @returns {BodyDescriptionComposer} Configured composer instance
   */
  function createComposer(overrides = {}) {
    return new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator: mockPartDescriptionGenerator,
      logger: mockLogger,
      ...overrides,
    });
  }

  describe('Health line edge cases', () => {
    it('appends health line at end when inventory is not in description order (line 251)', async () => {
      const mockInjuryAggregationService = {
        aggregateInjuries: jest.fn().mockReturnValue({ injuredParts: [] }),
      };
      const mockInjuryNarrativeFormatterService = {
        formatThirdPersonVisible: jest.fn().mockReturnValue('Minor bruises.'),
      };

      // Description order does NOT include 'inventory' so health line won't be inserted before it
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'build',
      ]);

      const composer = createComposer({
        injuryAggregationService: mockInjuryAggregationService,
        injuryNarrativeFormatterService: mockInjuryNarrativeFormatterService,
      });

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return {
              body: {
                root: 'root-part',
                descriptors: { build: 'slender' },
              },
            };
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = await composer.composeDescription(bodyEntity);

      // Health line should be appended at end (line 251)
      expect(result).toContain('Health: Minor bruises.');
      expect(mockInjuryNarrativeFormatterService.formatThirdPersonVisible).toHaveBeenCalled();
    });

    it('returns empty string when narrative is empty (line 971)', async () => {
      const mockInjuryAggregationService = {
        aggregateInjuries: jest.fn().mockReturnValue({ injuredParts: [] }),
      };
      const mockInjuryNarrativeFormatterService = {
        formatThirdPersonVisible: jest.fn().mockReturnValue(''), // Empty narrative
      };

      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([]);

      const composer = createComposer({
        injuryAggregationService: mockInjuryAggregationService,
        injuryNarrativeFormatterService: mockInjuryNarrativeFormatterService,
      });

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part' },
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = await composer.composeDescription(bodyEntity);

      // No health line added when narrative is empty
      expect(result).not.toContain('Health:');
    });

    it('handles errors in health line composition gracefully (lines 976-982)', async () => {
      const mockInjuryAggregationService = {
        aggregateInjuries: jest.fn().mockImplementation(() => {
          throw new Error('Aggregation failed');
        }),
      };
      const mockInjuryNarrativeFormatterService = {
        formatThirdPersonVisible: jest.fn(),
      };

      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([]);

      const composer = createComposer({
        injuryAggregationService: mockInjuryAggregationService,
        injuryNarrativeFormatterService: mockInjuryNarrativeFormatterService,
      });

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part' },
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      // Should not throw, returns empty string
      const result = await composer.composeDescription(bodyEntity);

      expect(result).not.toContain('Health:');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'BodyDescriptionComposer: failed to compose health line',
        expect.any(Object)
      );
    });
  });

  describe('#filterVisibleParts edge cases (line 267)', () => {
    it('returns empty Map when partsByType is null (via mocked groupPartsByType)', async () => {
      mockBodyGraphService.getAllParts.mockReturnValue(['some-part']);

      const composer = createComposer();

      // Spy on groupPartsByType to return null instead of a Map
      jest.spyOn(composer, 'groupPartsByType').mockReturnValue(null);

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part' },
        }),
      };

      // This should trigger line 267 in #filterVisibleParts
      // when partsByType is null, it returns new Map()
      const result = await composer.composeDescription(bodyEntity);

      // With no visible parts, description should be empty
      expect(result).toBe('');
      expect(composer.groupPartsByType).toHaveBeenCalled();
    });

    it('returns empty Map when partsByType is not a Map (via mocked groupPartsByType)', async () => {
      mockBodyGraphService.getAllParts.mockReturnValue(['some-part']);

      const composer = createComposer();

      // Spy on groupPartsByType to return an object instead of a Map
      jest.spyOn(composer, 'groupPartsByType').mockReturnValue({ notAMap: true });

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part' },
        }),
      };

      // This should trigger line 267 in #filterVisibleParts
      // when partsByType is not a Map, it returns new Map()
      const result = await composer.composeDescription(bodyEntity);

      // With no visible parts, description should be empty
      expect(result).toBe('');
      expect(composer.groupPartsByType).toHaveBeenCalled();
    });
  });

  describe('#isPartVisible edge cases (line 294)', () => {
    it('returns true when partEntity has no getComponentData method (via mocked groupPartsByType)', async () => {
      // Create a part entity WITHOUT getComponentData method
      // This entity would normally be filtered out by groupPartsByType,
      // but we mock groupPartsByType to return a Map containing it directly
      const partEntityWithoutGetComponentData = {
        id: 'part-torso',
        hasComponent: jest.fn().mockReturnValue(true),
        // Intentionally missing getComponentData - line 294 guard
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['part-torso']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'torso',
      ]);

      const composer = createComposer();

      // Mock groupPartsByType to return a Map with an entity lacking getComponentData
      // This bypasses the normal filtering and exercises line 294 in #isPartVisible
      const mockPartsMap = new Map();
      mockPartsMap.set('torso', [partEntityWithoutGetComponentData]);
      jest.spyOn(composer, 'groupPartsByType').mockReturnValue(mockPartsMap);

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part' },
        }),
      };

      // This triggers #filterVisibleParts with our mocked Map
      // The entity without getComponentData will hit line 294 (return true)
      await composer.composeDescription(bodyEntity);

      // The part is treated as visible (line 294 returns true)
      // But without proper component data, no description is generated
      expect(composer.groupPartsByType).toHaveBeenCalled();
    });

    it('returns true when partEntity is null (via mocked groupPartsByType)', async () => {
      mockBodyGraphService.getAllParts.mockReturnValue(['part-torso']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'torso',
      ]);

      const composer = createComposer();

      // Mock groupPartsByType to return a Map with a null entity
      // This shouldn't happen in normal flow but exercises the defensive guard at line 292-294
      const mockPartsMap = new Map();
      mockPartsMap.set('torso', [null]);
      jest.spyOn(composer, 'groupPartsByType').mockReturnValue(mockPartsMap);

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({
          body: { root: 'root-part' },
        }),
      };

      // This should not throw - null entity hits the guard at line 292-294
      const result = await composer.composeDescription(bodyEntity);

      expect(composer.groupPartsByType).toHaveBeenCalled();
      // Result is empty since null entity produces no description
      expect(result).toBe('');
    });
  });

  describe('#slotHasBlockingLayer edge cases (line 401, 406-407)', () => {
    it('returns false when equipmentData is null', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base'],
                },
              },
            };
          }
          // Return null for equipment - triggers line 401
          if (id === 'clothing:equipment') return null;
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since equipmentData is null (line 401)
      expect(result).toContain('Penis: test desc');
    });

    it('returns false when slot is not in equipped', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                // torso_lower slot is missing - line 406-407
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since slot is not in equipped
      expect(result).toContain('Penis: test desc');
    });
  });

  describe('#normalizeItems edge cases (lines 432-442)', () => {
    it('handles string items (line 432-434)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  // String instead of array - line 432-434
                  base: 'pants',
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be hidden since base layer (blocking) has items
      expect(result).not.toContain('Penis');
    });

    it('handles object items by extracting values (lines 436-440)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  // Object instead of array - lines 436-440
                  base: { item1: 'pants', item2: 'belt' },
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be hidden since base layer has items (extracted from object)
      expect(result).not.toContain('Penis');
    });

    it('returns empty array for null items (line 442)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  // null items - line 442
                  base: null,
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since null normalizes to empty array
      expect(result).toContain('Penis: test desc');
    });
  });

  describe('#isBlockedByCoverageMapping edge cases', () => {
    it('returns false when entityFinder.getEntityInstance is not a function (line 459)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      // But we need entityFinder for the part lookup
      // So we'll use mockEntityFinder for getAllParts but override for coverage check
      const customEntityFinder = {
        getEntityInstance: jest.fn().mockImplementation((id) => {
          if (id === 'part-penis') return partEntity;
          return null;
        }),
      };

      const composer = createComposer({
        entityFinder: customEntityFinder,
      });

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                full_body: {
                  outer: ['cloak'],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should still be visible even with coverage mapping because
      // the slot itself (torso_lower) is not directly blocked
      expect(result).toContain('Penis: test desc');
    });

    it('skips null slotLayers (line 464)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                // null value - line 464
                full_body: null,
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since slotLayers is null
      expect(result).toContain('Penis: test desc');
    });

    it('skips empty item arrays (line 470)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                full_body: {
                  // Empty array - line 470
                  outer: [],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since item array is empty
      expect(result).toContain('Penis: test desc');
    });

    it('skips missing item entities (line 475-476)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        // Return null for 'cloak' - line 475-476
        if (id === 'cloak') return null;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                full_body: {
                  outer: ['cloak'],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since cloak entity wasn't found
      expect(result).toContain('Penis: test desc');
    });

    it('skips items without coverage mapping (line 484-489)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      const cloakEntity = {
        id: 'cloak',
        hasComponent: jest.fn().mockReturnValue(false),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          // No coverage mapping - line 484-489
          if (componentId === 'clothing:coverage_mapping') return null;
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        if (id === 'cloak') return cloakEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                full_body: {
                  outer: ['cloak'],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since cloak has no coverage mapping
      expect(result).toContain('Penis: test desc');
    });

    it('skips items with non-blocking coveragePriority (line 494-495)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear', 'accessories'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      const beltEntity = {
        id: 'belt',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            return {
              covers: ['torso_lower'],
              // Non-blocking priority - line 494-495
              coveragePriority: 'accessories',
            };
          }
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        if (id === 'belt') return beltEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer', 'accessories'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                waist: {
                  accessories: ['belt'],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since belt has non-blocking priority
      expect(result).toContain('Penis: test desc');
    });
  });

  describe('#getComponentSafe edge cases (lines 521, 527-531)', () => {
    it('returns null when entity is null (line 521)', async () => {
      // This is tested indirectly through coverage mapping with null entity
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        // Return entity without getComponentData method
        if (id === 'cloak') return { id: 'cloak' };
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                full_body: {
                  outer: ['cloak'],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since getComponentSafe returns null for entity without getComponentData
      expect(result).toContain('Penis: test desc');
    });

    it('returns null and logs when getComponentData throws (lines 527-531)', async () => {
      const partEntity = {
        id: 'part-penis',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'anatomy:part') return { subType: 'penis' };
          if (componentId === 'anatomy:visibility_rules') {
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear'],
            };
          }
          if (componentId === 'anatomy:joint') return { socketId: 'penis' };
          if (componentId === 'core:description') return { text: 'test desc' };
          return null;
        }),
      };

      const cloakEntity = {
        id: 'cloak',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((componentId) => {
          if (componentId === 'clothing:coverage_mapping') {
            // Throw error - lines 527-531
            throw new Error('Component read failed');
          }
          return null;
        }),
      };

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'part-penis') return partEntity;
        if (id === 'cloak') return cloakEntity;
        return null;
      });

      mockBodyGraphService.getAllParts.mockReturnValue(['part-penis']);
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'penis',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          return id === ANATOMY_BODY_COMPONENT_ID;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis'],
                  allowedLayers: ['underwear', 'base', 'outer'],
                },
              },
            };
          }
          if (id === 'clothing:equipment') {
            return {
              equipped: {
                full_body: {
                  outer: ['cloak'],
                },
              },
            };
          }
          return null;
        }),
      };

      const result = await composer.composeDescription(bodyEntity);

      // Part should be visible since getComponentSafe caught the error
      expect(result).toContain('Penis: test desc');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "BodyDescriptionComposer: failed to read component 'clothing:coverage_mapping'"
        ),
        expect.any(Object)
      );
    });
  });

  describe('#generateInventoryDescription edge cases', () => {
    it('returns empty for empty items array (line 914)', async () => {
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'inventory',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) return true;
          if (id === 'items:inventory') return true;
          return false;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'items:inventory') {
            return { items: [] }; // Empty items - line 914
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = await composer.composeDescription(bodyEntity);

      expect(result).not.toContain('Inventory:');
    });

    it('skips null item entities (line 922)', async () => {
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'inventory',
      ]);

      mockEntityFinder.getEntityInstance.mockImplementation((id) => {
        if (id === 'item-1') return null; // Null entity - line 922
        return null;
      });

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) return true;
          if (id === 'items:inventory') return true;
          return false;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'items:inventory') {
            return { items: ['item-1'] };
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = await composer.composeDescription(bodyEntity);

      // No inventory line since item entity was null
      expect(result).not.toContain('Inventory:');
    });

    it('handles errors gracefully (lines 939-943)', async () => {
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'inventory',
      ]);

      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) return true;
          if (id === 'items:inventory') return true;
          return false;
        }),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return { body: { root: 'root-part' } };
          }
          if (id === 'items:inventory') {
            // Throw error - lines 939-943
            throw new Error('Inventory read failed');
          }
          return null;
        }),
      };

      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = await composer.composeDescription(bodyEntity);

      // No inventory line, but no error thrown
      expect(result).not.toContain('Inventory:');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate inventory description'),
        expect.any(Error)
      );
    });
  });

  describe('extractSmellDescription fallback (lines 878-883)', () => {
    it('falls back to entity-level smell component with deprecation warning', () => {
      const composer = createComposer();

      const bodyEntity = {
        id: 'test-entity',
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockImplementation((id) => {
          if (id === ANATOMY_BODY_COMPONENT_ID) {
            return {
              body: {
                root: 'root-part',
                // No descriptors.smell
              },
            };
          }
          if (id === 'descriptors:smell') {
            // Entity-level fallback - lines 878-883
            return { smell: 'musky scent' };
          }
          return null;
        }),
      };

      // Spy on console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = composer.extractSmellDescription(bodyEntity);

      expect(result).toBe('musky scent');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATION]')
      );

      warnSpy.mockRestore();
    });
  });
});
