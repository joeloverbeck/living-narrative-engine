/**
 * @file Unit tests for socketExtractor hierarchical extraction functions
 * Tests extractHierarchicalSockets and its internal helper functions through
 * the public API.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  extractHierarchicalSockets,
  setSocketExtractorLogger,
} from '../../../../src/anatomy/validation/socketExtractor.js';

describe('socketExtractor - hierarchical extraction', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn() };
    setSocketExtractorLogger(mockLogger);
  });

  afterEach(() => {
    setSocketExtractorLogger(null);
  });

  // ============================================================================
  // Helper Factories
  // ============================================================================

  function createMockRegistry(options = {}) {
    const {
      entities = [],
      blueprintParts = {},
      slotLibraries = {},
    } = options;

    return {
      getAll: jest.fn((type) => {
        if (type === 'entityDefinitions') {
          return entities;
        }
        return [];
      }),
      getEntityDefinition: jest.fn((id) => {
        return entities.find((e) => e.id === id);
      }),
      get: jest.fn((type, id) => {
        if (type === 'entityDefinitions') {
          return entities.find((e) => e.id === id);
        }
        if (type === 'anatomyBlueprintParts') {
          return blueprintParts[id];
        }
        if (type === 'anatomySlotLibraries') {
          return slotLibraries[id];
        }
        return undefined;
      }),
    };
  }

  function createEntityWithSockets(id, subType, sockets) {
    return {
      id,
      components: {
        'anatomy:part': { subType },
        'anatomy:sockets': { sockets },
      },
    };
  }

  function createEntityWithoutSockets(id, subType) {
    return {
      id,
      components: {
        'anatomy:part': { subType },
      },
    };
  }

  // ============================================================================
  // extractHierarchicalSockets - Root Entity Extraction
  // ============================================================================

  describe('extractHierarchicalSockets - root entity extraction', () => {
    it('extracts sockets from root entity only when no structure template', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'head', allowedTypes: ['head'] },
        { id: 'arm_left', allowedTypes: ['arm'] },
        { id: 'arm_right', allowedTypes: ['arm'] },
      ]);

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        null,
        null
      );

      expect(result.size).toBe(3);
      expect(result.get('head')).toMatchObject({
        id: 'head',
        source: 'root',
        entityId: 'anatomy:torso',
      });
      expect(result.get('arm_left')).toMatchObject({
        id: 'arm_left',
        source: 'root',
      });
      expect(result.get('arm_right')).toMatchObject({
        id: 'arm_right',
        source: 'root',
      });
    });

    it('returns empty map when root entity has no sockets', async () => {
      const rootEntity = createEntityWithoutSockets('anatomy:torso', 'torso');

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        null,
        null
      );

      expect(result.size).toBe(0);
    });

    it('handles null root entity gracefully', async () => {
      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        null,
        null,
        null
      );

      expect(result.size).toBe(0);
    });

    it('handles undefined root entity gracefully', async () => {
      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        undefined,
        null,
        null
      );

      expect(result.size).toBe(0);
    });

    it('extracts namespace from blueprint.root for preferredNamespace', async () => {
      const headEntity = createEntityWithSockets('anatomy:humanoid_head', 'head', [
        { id: 'left_eye', allowedTypes: ['eye'] },
      ]);
      const otherHeadEntity = createEntityWithSockets('creatures:kraken_head', 'head', []);

      const mockRegistry = createMockRegistry({
        entities: [headEntity, otherHeadEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        root: 'anatomy:human_male_torso',
        slots: {
          head_slot: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should prefer anatomy: namespace entity due to blueprint.root namespace
      const headSocket = result.get('left_eye');
      expect(headSocket).toBeDefined();
      expect(headSocket.parentEntity).toBe('anatomy:humanoid_head');
    });
  });

  // ============================================================================
  // extractHierarchicalSockets - Structure Template Extraction
  // ============================================================================

  describe('extractHierarchicalSockets - structure template extraction', () => {
    it('extracts sockets from bilateral limbSet', async () => {
      const armEntity = createEntityWithSockets('anatomy:humanoid_arm', 'arm', [
        { id: 'hand', allowedTypes: ['hand'] },
        { id: 'elbow', allowedTypes: ['joint'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [armEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                allowedTypes: ['arm'],
              },
              arrangement: 'bilateral',
              count: 2,
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should have arm_left and arm_right sockets from structure template
      expect(result.has('arm_left')).toBe(true);
      expect(result.has('arm_right')).toBe(true);
      expect(result.get('arm_left').source).toBe('structure_template_limbset');

      // Should also have child sockets from arm entity (hand, elbow for each arm)
      expect(result.has('hand')).toBe(true);
      expect(result.get('hand').source).toBe('structure_template_limb_child');
      expect(result.get('hand').parent).toMatch(/^arm_(left|right)$/);
    });

    it('extracts sockets from radial limbSet', async () => {
      const spokeEntity = createEntityWithSockets('anatomy:spoke', 'spoke', [
        { id: 'tip', allowedTypes: ['tip'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [spokeEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:hub', 'hub', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              socketPattern: {
                idTemplate: 'spoke_{{index}}',
                allowedTypes: ['spoke'],
              },
              arrangement: 'radial',
              count: 4,
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should have spoke_0 through spoke_3
      expect(result.has('spoke_0')).toBe(true);
      expect(result.has('spoke_1')).toBe(true);
      expect(result.has('spoke_2')).toBe(true);
      expect(result.has('spoke_3')).toBe(true);
    });

    it('extracts sockets from appendage (head)', async () => {
      const headEntity = createEntityWithSockets('anatomy:humanoid_head', 'head', [
        { id: 'left_eye', allowedTypes: ['eye'] },
        { id: 'right_eye', allowedTypes: ['eye'] },
        { id: 'mouth', allowedTypes: ['mouth'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          appendages: [
            {
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should have head socket from structure template
      expect(result.has('head')).toBe(true);
      expect(result.get('head').source).toBe('structure_template_appendage');

      // Should have child sockets from head entity
      expect(result.has('left_eye')).toBe(true);
      expect(result.has('right_eye')).toBe(true);
      expect(result.has('mouth')).toBe(true);
      expect(result.get('left_eye').source).toBe('structure_template_appendage_child');
      expect(result.get('left_eye').parent).toBe('head');
    });

    it('handles structure template with both limbSets and appendages', async () => {
      const armEntity = createEntityWithSockets('anatomy:arm', 'arm', [
        { id: 'hand', allowedTypes: ['hand'] },
      ]);
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [armEntity, headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                allowedTypes: ['arm'],
              },
              arrangement: 'bilateral',
              count: 2,
            },
          ],
          appendages: [
            {
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // limbSet sockets
      expect(result.has('arm_left')).toBe(true);
      expect(result.has('arm_right')).toBe(true);
      expect(result.has('hand')).toBe(true);

      // appendage sockets
      expect(result.has('head')).toBe(true);
      expect(result.has('eye')).toBe(true);
    });

    it('handles missing topology in structure template', async () => {
      const mockRegistry = createMockRegistry({ entities: [] });
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'test_socket', allowedTypes: ['test'] },
      ]);
      const structureTemplate = {}; // No topology

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should only have root sockets
      expect(result.size).toBe(1);
      expect(result.has('test_socket')).toBe(true);
    });

    it('handles empty limbSets array', async () => {
      const mockRegistry = createMockRegistry({ entities: [] });
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('handles limbSet without socketPattern', async () => {
      const mockRegistry = createMockRegistry({ entities: [] });
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              // No socketPattern
              arrangement: 'bilateral',
              count: 2,
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('handles appendage without socketPattern', async () => {
      const mockRegistry = createMockRegistry({ entities: [] });
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          appendages: [
            {
              // No socketPattern
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('handles entity not found in registry for limbSet', async () => {
      const mockRegistry = createMockRegistry({
        entities: [], // No entities
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                allowedTypes: ['arm'],
              },
              arrangement: 'bilateral',
              count: 2,
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should still have the limbSet sockets, just no child sockets
      expect(result.has('arm_left')).toBe(true);
      expect(result.has('arm_right')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('uses fallback arrangement when not bilateral or radial', async () => {
      const mockRegistry = createMockRegistry({ entities: [] });
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              socketPattern: {
                idTemplate: 'tentacle_{{orientation}}',
                allowedTypes: ['tentacle'],
              },
              arrangement: 'other', // Not bilateral or radial
              count: 3,
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Fallback generates indexed IDs using {{orientation}} placeholder
      expect(result.has('tentacle_0')).toBe(true);
      expect(result.has('tentacle_1')).toBe(true);
      expect(result.has('tentacle_2')).toBe(true);
    });

    it('handles part entity without sockets', async () => {
      const armEntity = createEntityWithoutSockets('anatomy:arm', 'arm');

      const mockRegistry = createMockRegistry({
        entities: [armEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                allowedTypes: ['arm'],
              },
              arrangement: 'bilateral',
              count: 2,
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should have limbSet sockets but no child sockets
      expect(result.has('arm_left')).toBe(true);
      expect(result.has('arm_right')).toBe(true);
      expect(result.size).toBe(2);
    });
  });

  // ============================================================================
  // extractHierarchicalSockets - Slot Child Socket Extraction
  // ============================================================================

  describe('extractHierarchicalSockets - slot child socket extraction', () => {
    it('extracts child sockets from slots with partType requirements', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'left_eye', allowedTypes: ['eye'] },
        { id: 'right_eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'head', allowedTypes: ['head'] },
      ]);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Root socket
      expect(result.get('head')).toMatchObject({
        source: 'root',
      });

      // Child sockets from head entity
      expect(result.has('left_eye')).toBe(true);
      expect(result.has('right_eye')).toBe(true);
      expect(result.get('left_eye')).toMatchObject({
        source: 'slot_child',
        parent: 'head',
        parentEntity: 'anatomy:head',
      });
    });

    it('extracts child sockets from additionalSlots', async () => {
      const handEntity = createEntityWithSockets('anatomy:hand', 'hand', [
        { id: 'finger_index', allowedTypes: ['finger'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [handEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:arm', 'arm', []);
      const blueprint = {
        id: 'test_blueprint',
        additionalSlots: {
          hand: {
            requirements: { partType: 'hand' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.has('finger_index')).toBe(true);
      expect(result.get('finger_index').parent).toBe('hand');
    });

    it('combines slots and additionalSlots', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);
      const handEntity = createEntityWithSockets('anatomy:hand', 'hand', [
        { id: 'finger', allowedTypes: ['finger'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity, handEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'head' },
          },
        },
        additionalSlots: {
          hand: {
            requirements: { partType: 'hand' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.has('eye')).toBe(true);
      expect(result.has('finger')).toBe(true);
    });

    it('skips slots without partType requirement', async () => {
      const mockRegistry = createMockRegistry({ entities: [] });
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          decoration: {
            // No requirements.partType
            requirements: { someOtherRequirement: true },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('handles slot with partType but entity not found', async () => {
      const mockRegistry = createMockRegistry({
        entities: [], // No entities
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // No child sockets added since entity not found
      expect(result.size).toBe(0);
    });

    it('generates hierarchicalKey for child sockets', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head_slot: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      const eyeSocket = result.get('eye');
      expect(eyeSocket.hierarchicalKey).toBe('head_slot:eye');
    });
  });

  // ============================================================================
  // extractHierarchicalSockets - Composed Slots (V1 Blueprints)
  // ============================================================================

  describe('extractHierarchicalSockets - composed slots (V1 blueprints)', () => {
    it('extracts slots from compose instruction', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
        blueprintParts: {
          'anatomy:head_part': {
            slots: {
              head: {
                requirements: { partType: 'head' },
              },
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should have the composed slot itself registered
      expect(result.has('head')).toBe(true);
      expect(result.get('head').source).toBe('composed_slot');

      // Should have child sockets from the head entity
      expect(result.has('eye')).toBe(true);
      expect(result.get('eye').source).toBe('composed_part_child');
    });

    it('skips compose instruction without slots in include list', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:head_part': {
            slots: {
              head: {
                requirements: { partType: 'head' },
              },
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['components'], // Not 'slots'
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('skips compose instruction without include array', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:head_part': {
            slots: {
              head: {
                requirements: { partType: 'head' },
              },
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            // No include array
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('skips compose instruction without part ID', async () => {
      const mockRegistry = createMockRegistry({});
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            // No part
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('handles compose instruction when part not found', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {}, // Empty
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:nonexistent_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('handles compose instruction when part has no slots', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:empty_part': {
            // No slots
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:empty_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.size).toBe(0);
    });

    it('resolves $use references from slot library', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
        blueprintParts: {
          'anatomy:head_part': {
            library: 'anatomy:slot_library',
            slots: {
              head: {
                $use: 'standard_head',
                customProperty: 'override',
              },
            },
          },
        },
        slotLibraries: {
          'anatomy:slot_library': {
            slotDefinitions: {
              standard_head: {
                requirements: { partType: 'head' },
                defaultProperty: 'from_library',
              },
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should have resolved the slot and extracted child sockets
      expect(result.has('head')).toBe(true);
      expect(result.has('eye')).toBe(true);
    });

    it('handles $use reference to missing library definition', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:head_part': {
            library: 'anatomy:slot_library',
            slots: {
              head: {
                $use: 'nonexistent_definition',
              },
            },
          },
        },
        slotLibraries: {
          'anatomy:slot_library': {
            slotDefinitions: {
              // No nonexistent_definition
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Slot should still be registered, but without resolved partType
      expect(result.has('head')).toBe(true);
    });

    it('handles missing slot library', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:head_part': {
            library: 'anatomy:nonexistent_library',
            slots: {
              head: {
                $use: 'standard_head',
              },
            },
          },
        },
        slotLibraries: {}, // No libraries
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Slot registered but $use not resolved
      expect(result.has('head')).toBe(true);
    });

    it('handles multiple compose instructions', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);
      const armEntity = createEntityWithSockets('anatomy:arm', 'arm', [
        { id: 'hand', allowedTypes: ['hand'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity, armEntity],
        blueprintParts: {
          'anatomy:head_part': {
            slots: {
              head: {
                requirements: { partType: 'head' },
              },
            },
          },
          'anatomy:arm_part': {
            slots: {
              arm: {
                requirements: { partType: 'arm' },
              },
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
          {
            part: 'anatomy:arm_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should have slots from both parts
      expect(result.has('head')).toBe(true);
      expect(result.has('arm')).toBe(true);
      expect(result.has('eye')).toBe(true);
      expect(result.has('hand')).toBe(true);
    });

    it('does not overwrite existing socket when slot already exists', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:head_part': {
            slots: {
              existing_socket: {
                requirements: { partType: 'test' },
              },
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'existing_socket', allowedTypes: ['test'], orientation: 'root_orientation' },
      ]);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Root socket should not be overwritten
      expect(result.get('existing_socket').source).toBe('root');
    });

    it('skips non-object slot configs', async () => {
      const mockRegistry = createMockRegistry({
        blueprintParts: {
          'anatomy:head_part': {
            slots: {
              valid_slot: {
                requirements: { partType: 'test' },
              },
              null_slot: null,
              string_slot: 'invalid',
            },
          },
        },
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      expect(result.has('valid_slot')).toBe(true);
      expect(result.has('null_slot')).toBe(false);
      expect(result.has('string_slot')).toBe(false);
    });

    it('handles compose when compose is not an array', async () => {
      const mockRegistry = createMockRegistry({});
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: 'not_an_array', // Invalid
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, just return root sockets
      expect(result.size).toBe(0);
    });
  });

  // ============================================================================
  // Registry API Compatibility
  // ============================================================================

  describe('registry API compatibility', () => {
    it('uses getEntityDefinition method when available', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([headEntity]),
        getEntityDefinition: jest.fn().mockReturnValue(headEntity),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          appendages: [
            {
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      expect(mockRegistry.getEntityDefinition).toHaveBeenCalledWith('anatomy:head');
    });

    it('falls back to get method when getEntityDefinition not available', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([headEntity]),
        get: jest.fn((type, id) => {
          if (type === 'entityDefinitions' && id === 'anatomy:head') {
            return headEntity;
          }
          return undefined;
        }),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const structureTemplate = {
        topology: {
          appendages: [
            {
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      expect(mockRegistry.get).toHaveBeenCalledWith('entityDefinitions', 'anatomy:head');
    });

    it('handles registry with only get method for blueprint parts', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([]),
        get: jest.fn((type, id) => {
          if (type === 'anatomyBlueprintParts' && id === 'anatomy:head_part') {
            return {
              slots: {
                head: { requirements: { partType: 'test' } },
              },
            };
          }
          return undefined;
        }),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      await extractHierarchicalSockets(blueprint, rootEntity, null, mockRegistry);

      expect(mockRegistry.get).toHaveBeenCalledWith('anatomyBlueprintParts', 'anatomy:head_part');
    });

    it('handles null registry gracefully', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'test', allowedTypes: ['test'] },
      ]);

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        null,
        null
      );

      // Should only have root sockets
      expect(result.size).toBe(1);
    });
  });

  // ============================================================================
  // extractNamespaceFromId - Internal Function Coverage
  // ============================================================================

  describe('extractNamespaceFromId coverage (via extractHierarchicalSockets)', () => {
    it('handles blueprint.root as null', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);
      const creatureHeadEntity = createEntityWithSockets('creatures:head', 'head', [
        { id: 'tentacle', allowedTypes: ['tentacle'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity, creatureHeadEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        root: null, // Non-string value
        slots: {
          head: { requirements: { partType: 'head' } },
        },
      };

      // Should not throw, should work without namespace preference
      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should still extract child sockets (no namespace preference)
      expect(result.has('eye') || result.has('tentacle')).toBe(true);
    });

    it('handles blueprint.root as number', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        root: 12345, // Non-string value
        slots: {
          head: { requirements: { partType: 'head' } },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw
      expect(result.has('eye')).toBe(true);
    });

    it('handles blueprint.root as object', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        root: { invalid: 'object' }, // Non-string value
        slots: {
          head: { requirements: { partType: 'head' } },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw
      expect(result.has('eye')).toBe(true);
    });

    it('handles blueprint.root without namespace separator', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        root: 'no_namespace_here', // No colon separator
        slots: {
          head: { requirements: { partType: 'head' } },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, should work without namespace preference
      expect(result.has('eye')).toBe(true);
    });

    it('handles blueprint.root with colon at start', async () => {
      const headEntity = createEntityWithSockets('anatomy:head', 'head', [
        { id: 'eye', allowedTypes: ['eye'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [headEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        root: ':invalid_start', // Colon at index 0
        slots: {
          head: { requirements: { partType: 'head' } },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw (separatorIndex <= 0 returns null)
      expect(result.has('eye')).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('handles empty blueprint object', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'test', allowedTypes: ['test'] },
      ]);

      const result = await extractHierarchicalSockets({}, rootEntity, null, null);

      expect(result.size).toBe(1);
    });

    it('handles null blueprint', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'test', allowedTypes: ['test'] },
      ]);

      const result = await extractHierarchicalSockets(null, rootEntity, null, null);

      expect(result.size).toBe(1);
    });

    it('handles all null parameters', async () => {
      const result = await extractHierarchicalSockets(null, null, null, null);

      expect(result.size).toBe(0);
    });

    it('preserves all socket properties in hierarchical sockets', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        {
          id: 'detailed_socket',
          allowedTypes: ['test'],
          orientation: 'upper',
          nameTpl: '{{type}} socket',
          index: 42,
        },
      ]);

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        null,
        null
      );

      const socket = result.get('detailed_socket');
      expect(socket.id).toBe('detailed_socket');
      expect(socket.allowedTypes).toEqual(['test']);
      expect(socket.orientation).toBe('upper');
      expect(socket.nameTpl).toBe('{{type}} socket');
      expect(socket.index).toBe(42);
      expect(socket.source).toBe('root');
      expect(socket.entityId).toBe('anatomy:torso');
    });

    it('handles slots with parent property in slot child extraction', async () => {
      const mouthEntity = createEntityWithSockets('anatomy:mouth', 'mouth', [
        { id: 'teeth', allowedTypes: ['teeth'] },
      ]);

      const mockRegistry = createMockRegistry({
        entities: [mouthEntity],
      });

      const rootEntity = createEntityWithSockets('anatomy:head', 'head', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          mouth: {
            parent: 'head', // Has parent reference
            requirements: { partType: 'mouth' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should still extract child sockets even for slots with parent
      expect(result.has('teeth')).toBe(true);
      expect(result.get('teeth').parent).toBe('mouth');
    });
  });

  // ============================================================================
  // Helper Function Edge Cases (Coverage for lines 172, 184, 511, 522, 535, 542, 555, 562, 685)
  // ============================================================================

  describe('helper function edge cases', () => {
    // Line 172: partType becomes falsy after initial check in extractSlotChildSockets
    it('skips slot when partType is empty string', async () => {
      const mockRegistry = createMockRegistry({
        entities: [],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          empty_slot: {
            requirements: { partType: '' }, // Empty string partType
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw and should skip the slot
      expect(result.size).toBe(0);
    });

    // Line 184: partEntity not found in extractSlotChildSockets
    it('skips slot when partEntity not found after entity resolution', async () => {
      // Create a registry that resolves entityId but doesn't find the entity
      const mockRegistry = {
        getAll: jest.fn(() => [
          // Entity exists in getAll (for resolution) but get returns undefined
          { id: 'anatomy:head', components: { 'anatomy:part': { subType: 'head' } } },
        ]),
        getEntityDefinition: jest.fn(() => undefined), // Returns undefined
        get: jest.fn(() => undefined),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, should have no sockets from slots
      expect(result.size).toBe(0);
    });

    // Lines 511, 522: getEntityDefinition with null/undefined registry and no supported methods
    it('handles registry without getEntityDefinition or get method', async () => {
      // Registry with only getAll method (no getEntityDefinition or get)
      const mockRegistry = {
        getAll: jest.fn(() => [
          createEntityWithSockets('anatomy:head', 'head', [
            { id: 'eye', allowedTypes: ['eye'] },
          ]),
        ]),
        // No getEntityDefinition method
        // No get method
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, should return only root sockets
      expect(result.size).toBe(0);
    });

    // Lines 535, 542: getBlueprintPart with null registry and no get method
    it('handles compose with registry without get method for blueprint parts', async () => {
      const mockRegistry = {
        getAll: jest.fn(() => []),
        getEntityDefinition: jest.fn(() => undefined),
        // No get method
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, should return only root sockets
      expect(result.size).toBe(0);
    });

    // Lines 555, 562: getSlotLibrary with null registry and no get method
    it('handles slot library lookup with registry without get method', async () => {
      const mockRegistry = {
        getAll: jest.fn(() => []),
        getEntityDefinition: jest.fn(() => undefined),
        get: jest.fn((type) => {
          // Only return blueprint parts, not slot libraries
          if (type === 'anatomyBlueprintParts') {
            return {
              library: 'anatomy:slot_library',
              slots: {
                head: {
                  $use: 'standard_head',
                },
              },
            };
          }
          // Return undefined for slot libraries
          return undefined;
        }),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, slot should be registered without resolved $use
      expect(result.has('head')).toBe(true);
    });

    // Line 685: partEntity not found in extractComposedSlots
    it('skips composed slot child extraction when part entity not found', async () => {
      const mockRegistry = {
        getAll: jest.fn(() => [
          // Entity exists for resolution but won't be found by getEntityDefinition
          { id: 'anatomy:head', components: { 'anatomy:part': { subType: 'head' } } },
        ]),
        getEntityDefinition: jest.fn(() => {
          // Return undefined for all - simulates entity resolution succeeding but entity fetch failing
          return undefined;
        }),
        get: jest.fn((type, partId) => {
          if (type === 'anatomyBlueprintParts' && partId === 'anatomy:head_part') {
            return {
              slots: {
                head: {
                  requirements: { partType: 'head' },
                },
              },
            };
          }
          return undefined;
        }),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // The slot should be registered, but no child sockets extracted
      expect(result.has('head')).toBe(true);
      expect(result.get('head').source).toBe('composed_slot');
      // No composed_part_child sockets
      const childSockets = Array.from(result.values()).filter(
        (s) => s.source === 'composed_part_child'
      );
      expect(childSockets.length).toBe(0);
    });

    // Additional coverage: registry with getAll returning non-array
    it('handles registry with getAll returning non-array', async () => {
      const mockRegistry = {
        getAll: jest.fn(() => null), // Returns null instead of array
        getEntityDefinition: jest.fn(() => undefined),
        get: jest.fn(() => undefined),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', [
        { id: 'socket1', allowedTypes: ['test'] },
      ]);
      const structureTemplate = {
        topology: {
          limbSets: [
            {
              arrangement: 'bilateral',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{side}}',
              },
              partType: 'arm',
            },
          ],
        },
      };

      const result = await extractHierarchicalSockets(
        { id: 'test_blueprint' },
        rootEntity,
        structureTemplate,
        mockRegistry
      );

      // Should not throw
      expect(result.has('socket1')).toBe(true);
    });

    // Line 172 coverage: requirements object exists but partType is undefined
    it('skips slot when requirements.partType is undefined', async () => {
      const mockRegistry = createMockRegistry({
        entities: [],
      });

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          no_partType_slot: {
            requirements: {
              // partType not present at all
              someOtherProp: 'value',
            },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw and should skip the slot (no sockets extracted)
      expect(result.size).toBe(0);
    });

    // Lines 511, 522 direct coverage: null dataRegistry to getEntityDefinition
    it('handles slot extraction with null dataRegistry', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'head' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        null // null dataRegistry
      );

      // Should not throw, should return only root sockets
      expect(result.size).toBe(0);
    });

    // Lines 535, 542 direct coverage: null dataRegistry to getBlueprintPart
    it('handles compose with null dataRegistry', async () => {
      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        null // null dataRegistry
      );

      // Should not throw, should return only root sockets
      expect(result.size).toBe(0);
    });

    // Line 562 coverage: getSlotLibrary with registry that has get but returns undefined for library
    it('handles slot library lookup when library not found', async () => {
      const mockRegistry = {
        getAll: jest.fn(() => []),
        getEntityDefinition: jest.fn(() => undefined),
        get: jest.fn((type) => {
          if (type === 'anatomyBlueprintParts') {
            return {
              library: 'anatomy:missing_library',
              slots: {
                head: {
                  $use: 'standard_head',
                  requirements: { partType: 'test' },
                },
              },
            };
          }
          if (type === 'anatomySlotLibraries') {
            return undefined; // Library not found
          }
          return undefined;
        }),
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        compose: [
          {
            part: 'anatomy:head_part',
            include: ['slots'],
          },
        ],
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw, slot should be registered
      expect(result.has('head')).toBe(true);
    });

    // Line 562 additional: getSlotLibrary with registry without get method
    it('handles library lookup with registry lacking get method', async () => {
      const mockRegistry = {
        getAll: jest.fn(() => []),
        getEntityDefinition: jest.fn(() => {
          return {
            slots: {
              head: {
                library: 'anatomy:lib',
                $use: 'def',
              },
            },
          };
        }),
        // No get method at all
      };

      const rootEntity = createEntityWithSockets('anatomy:torso', 'torso', []);
      const blueprint = {
        id: 'test_blueprint',
        slots: {
          head: {
            requirements: { partType: 'test' },
          },
        },
      };

      const result = await extractHierarchicalSockets(
        blueprint,
        rootEntity,
        null,
        mockRegistry
      );

      // Should not throw
      expect(result.size).toBe(0);
    });
  });
});
