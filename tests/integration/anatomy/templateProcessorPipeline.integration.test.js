/**
 * @file Integration tests for complete template processor pipeline
 * @see workflows/ANABLUNONHUM-010-template-processor-unit-tests.md
 * @see docs/anatomy/structure-templates.md
 * @see docs/anatomy/blueprints-v2.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('Template Processor Pipeline Integration', () => {
  let socketGenerator;
  let slotGenerator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    socketGenerator = new SocketGenerator({ logger });
    slotGenerator = new SlotGenerator({ logger });
  });

  describe('Complete Pipeline Flow - Humanoid Template', () => {
    it('processes humanoid structure template through complete pipeline', () => {
      // Arrange: Structure template (as loaded by AnatomyStructureTemplateLoader)
      const structureTemplate = {
        id: 'anatomy:structure_humanoid',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['human_arm'],
              },
            },
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['human_leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head_socket',
                allowedTypes: ['human_head'],
              },
            },
          ],
        },
      };

      // Act: Process through pipeline
      const sockets = socketGenerator.generateSockets(structureTemplate);
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Assert: Verify socket generation
      expect(sockets).toHaveLength(5); // 2 arms + 2 legs + 1 head
      expect(sockets.map((s) => s.id).sort()).toEqual([
        'arm_left',
        'arm_right',
        'head_socket',
        'leg_left',
        'leg_right',
      ]);

      // Assert: Verify slot generation
      expect(Object.keys(slots)).toHaveLength(5);
      expect(Object.keys(slots).sort()).toEqual([
        'arm_left',
        'arm_right',
        'head_socket',
        'leg_left',
        'leg_right',
      ]);

      // CRITICAL: Verify socket IDs match slot keys exactly
      const socketIds = sockets.map((s) => s.id).sort();
      const slotKeys = Object.keys(slots).sort();
      expect(socketIds).toEqual(slotKeys);

      // Verify each slot references its corresponding socket
      sockets.forEach((socket) => {
        expect(slots[socket.id]).toBeDefined();
        expect(slots[socket.id].socket).toBe(socket.id);
      });
    });
  });

  describe('Complete Pipeline Flow - Spider Template', () => {
    it('processes spider structure template with radial orientation', () => {
      // Arrange: 8-leg spider with octagonal positioning
      const structureTemplate = {
        id: 'creatures:structure_spider',
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'abdomen',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'abdomen_socket',
                allowedTypes: ['spider_abdomen'],
              },
            },
          ],
        },
      };

      // Act
      const sockets = socketGenerator.generateSockets(structureTemplate);
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Assert: 8 legs + 1 abdomen
      expect(sockets).toHaveLength(9);

      // Verify octagonal positioning for legs
      const legSockets = sockets.filter((s) => s.id.startsWith('leg_'));
      expect(legSockets).toHaveLength(8);
      expect(legSockets.map((s) => s.orientation)).toEqual([
        'anterior',
        'anterior_right',
        'right',
        'posterior_right',
        'posterior',
        'posterior_left',
        'left',
        'anterior_left',
      ]);

      // CRITICAL: Socket/slot synchronization
      expect(Object.keys(slots)).toHaveLength(9);
      expect(sockets.map((s) => s.id).sort()).toEqual(
        Object.keys(slots).sort()
      );
    });
  });

  describe('Complete Pipeline Flow - Dragon Template', () => {
    it('processes complex dragon template with multiple limb sets', () => {
      // Arrange: Quadrupedal dragon with wings
      const structureTemplate = {
        id: 'creatures:structure_dragon',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_leg'],
              },
            },
            {
              type: 'wing',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_wing'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head_socket',
                allowedTypes: ['dragon_head'],
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail_socket',
                allowedTypes: ['dragon_tail'],
              },
            },
          ],
        },
      };

      // Act
      const sockets = socketGenerator.generateSockets(structureTemplate);
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Assert: 4 legs + 2 wings + 1 head + 1 tail = 8 total
      expect(sockets).toHaveLength(8);

      // Verify quadrupedal leg positioning
      const legSockets = sockets.filter((s) => s.id.startsWith('leg_'));
      expect(legSockets).toHaveLength(4);
      expect(legSockets.map((s) => s.id).sort()).toEqual([
        'leg_left_front',
        'leg_left_rear',
        'leg_right_front',
        'leg_right_rear',
      ]);

      // Verify wing positioning
      const wingSockets = sockets.filter((s) => s.id.startsWith('wing_'));
      expect(wingSockets).toHaveLength(2);
      expect(wingSockets.map((s) => s.id).sort()).toEqual([
        'wing_left',
        'wing_right',
      ]);

      // CRITICAL: Complete synchronization
      expect(Object.keys(slots)).toHaveLength(8);
      expect(sockets.map((s) => s.id).sort()).toEqual(
        Object.keys(slots).sort()
      );

      // Verify slot requirements
      expect(slots['leg_left_front'].requirements.partType).toBe('leg');
      expect(slots['wing_left'].requirements.partType).toBe('wing');
      expect(slots['head_socket'].requirements.partType).toBe('head');
      expect(slots['tail_socket'].requirements.partType).toBe('tail');
    });
  });

  describe('Blueprint V2 Integration', () => {
    it('generates slots compatible with Blueprint V2 structure', () => {
      const structureTemplate = {
        id: 'anatomy:structure_simple',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Verify Blueprint V2 slot structure
      Object.entries(slots).forEach(([slotKey, slotDef]) => {
        // Each slot must have these properties
        expect(slotDef).toHaveProperty('socket');
        expect(slotDef).toHaveProperty('requirements');
        expect(slotDef).toHaveProperty('optional');

        // Socket reference must match slot key
        expect(slotDef.socket).toBe(slotKey);

        // Requirements structure
        expect(slotDef.requirements).toHaveProperty('partType');
        expect(slotDef.requirements).toHaveProperty('components');
        expect(slotDef.requirements.components).toContain('anatomy:part');

        // Optional flag must be boolean
        expect(typeof slotDef.optional).toBe('boolean');
      });
    });

    it('supports additionalSlots merging in blueprints', () => {
      const structureTemplate = {
        id: 'anatomy:structure_base',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const generatedSlots = slotGenerator.generateBlueprintSlots(
        structureTemplate
      );

      // Additional slots defined in blueprint
      const additionalSlots = {
        accessory_slot: {
          socket: 'accessory_socket',
          requirements: {
            partType: 'accessory',
            components: ['anatomy:part'],
          },
          optional: true,
        },
      };

      // Merge as Blueprint V2 would
      const finalSlots = { ...generatedSlots, ...additionalSlots };

      expect(Object.keys(finalSlots)).toHaveLength(3); // 2 arms + 1 accessory
      expect(finalSlots).toHaveProperty('arm_left');
      expect(finalSlots).toHaveProperty('arm_right');
      expect(finalSlots).toHaveProperty('accessory_slot');

      // Verify no ID collisions
      const slotKeys = Object.keys(finalSlots);
      const uniqueKeys = new Set(slotKeys);
      expect(slotKeys.length).toBe(uniqueKeys.size);
    });
  });

  describe('Template Variable Processing Consistency', () => {
    it('processes all template variables consistently across generators', () => {
      const structureTemplate = {
        id: 'test:multi_var',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: '{{type}}_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['test_limb'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(structureTemplate);
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Both generators should produce identical IDs
      expect(sockets.map((s) => s.id).sort()).toEqual([
        'test_limb_left_1',
        'test_limb_right_2',
      ]);

      expect(Object.keys(slots).sort()).toEqual([
        'test_limb_left_1',
        'test_limb_right_2',
      ]);

      // Verify variable replacement consistency
      sockets.forEach((socket) => {
        expect(socket.id).toContain('test_limb'); // {{type}}
        expect(socket.id).toMatch(/left|right/); // {{orientation}}
        expect(socket.id).toMatch(/[12]$/); // {{index}}
      });
    });

    it('handles custom positions array consistently', () => {
      const customPositions = ['front_left', 'front_right', 'back_center'];

      const structureTemplate = {
        id: 'test:custom_pos',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'leg',
              count: 3,
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'custom',
                positions: customPositions,
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(structureTemplate);
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Verify custom positions used
      expect(sockets.map((s) => s.orientation).sort()).toEqual(
        customPositions.sort()
      );

      // Verify socket/slot synchronization with custom positions
      expect(sockets.map((s) => s.id).sort()).toEqual(
        Object.keys(slots).sort()
      );

      expect(Object.keys(slots).sort()).toEqual([
        'leg_back_center',
        'leg_front_left',
        'leg_front_right',
      ]);
    });
  });

  describe('Pattern Matching System Compatibility', () => {
    it('generates socket IDs compatible with recipe matchesGroup patterns', () => {
      const structureTemplate = {
        id: 'test:pattern_test',
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(structureTemplate);

      // Should be matchable by pattern "limbSet:leg"
      sockets.forEach((socket) => {
        expect(socket.allowedTypes).toContain('leg');
      });

      // Should be matchable by wildcard pattern "leg_*"
      sockets.forEach((socket) => {
        expect(socket.id).toMatch(/^leg_\d+$/);
      });
    });

    it('generates socket IDs compatible with recipe matchesPattern wildcards', () => {
      const structureTemplate = {
        id: 'test:wildcard',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(structureTemplate);

      // Socket IDs should match wildcard pattern "arm_*"
      sockets.forEach((socket) => {
        expect(socket.id).toMatch(/^arm_/);
        expect(socket.id).toMatch(/^arm_(left|right)$/);
      });
    });
  });

  describe('Error Handling Consistency', () => {
    it('SocketGenerator rejects templates with duplicate socket IDs', () => {
      const badTemplate = {
        id: 'test:duplicate',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_socket', // Static template creates duplicates
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      // SocketGenerator should detect duplicates
      expect(() => socketGenerator.generateSockets(badTemplate)).toThrow(
        'Duplicate socket IDs detected'
      );

      // Note: SlotGenerator uses Object.assign() which silently overwrites duplicates
      // This is expected behavior for the slot merging pattern
      const slots = slotGenerator.generateBlueprintSlots(badTemplate);
      expect(Object.keys(slots)).toHaveLength(1); // Only one 'arm_socket' key
      expect(slots).toHaveProperty('arm_socket');
    });

    it('both generators handle empty limbSets and appendages gracefully', () => {
      const emptyTemplate = {
        id: 'test:empty',
        topology: {
          rootType: 'torso',
          limbSets: [],
          appendages: [],
        },
      };

      const sockets = socketGenerator.generateSockets(emptyTemplate);
      const slots = slotGenerator.generateBlueprintSlots(emptyTemplate);

      expect(sockets).toEqual([]);
      expect(slots).toEqual({});
    });
  });

  describe('Orientation Scheme Synchronization', () => {
    it('maintains synchronization for bilateral scheme', () => {
      const template = {
        id: 'test:bilateral_sync',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);
      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(sockets.map((s) => s.id)).toEqual(['arm_left', 'arm_right']);
      expect(Object.keys(slots)).toEqual(['arm_left', 'arm_right']);
    });

    it('maintains synchronization for indexed scheme', () => {
      const template = {
        id: 'test:indexed_sync',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'tentacle',
              count: 3,
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['tentacle'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);
      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(sockets.map((s) => s.id)).toEqual([
        'tentacle_1',
        'tentacle_2',
        'tentacle_3',
      ]);
      expect(Object.keys(slots)).toEqual([
        'tentacle_1',
        'tentacle_2',
        'tentacle_3',
      ]);
    });

    it('maintains synchronization for radial octagonal scheme', () => {
      const template = {
        id: 'test:radial_sync',
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);
      const slots = slotGenerator.generateBlueprintSlots(template);

      const expectedIds = [
        'leg_anterior',
        'leg_anterior_right',
        'leg_right',
        'leg_posterior_right',
        'leg_posterior',
        'leg_posterior_left',
        'leg_left',
        'leg_anterior_left',
      ];

      expect(sockets.map((s) => s.id)).toEqual(expectedIds);
      expect(Object.keys(slots)).toEqual(expectedIds);
    });
  });
});
