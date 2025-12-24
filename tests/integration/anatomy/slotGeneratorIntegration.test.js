/**
 * @file Integration tests for SlotGenerator within the anatomy system
 * @description Verifies SlotGenerator works correctly in system context
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SlotGenerator Integration', () => {
  let testBed;
  let slotGenerator;
  let socketGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    slotGenerator = new SlotGenerator({
      logger: testBed.mockLogger,
    });
    socketGenerator = new SocketGenerator({
      logger: testBed.mockLogger,
    });
  });

  describe('Blueprint V2 Slot Generation', () => {
    it('should generate slots that match blueprint V2 schema format', () => {
      const structureTemplate = {
        id: 'anatomy:structure_spider',
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'pedipalp',
              count: 2,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'pedipalp_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['pedipalp'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);

      // Verify slot structure matches blueprint V2 requirements
      for (const [slotKey, slot] of Object.entries(slots)) {
        expect(slot).toHaveProperty('socket');
        expect(slot).toHaveProperty('requirements');
        expect(slot).toHaveProperty('optional');

        expect(slot.socket).toBe(slotKey);
        expect(slot.requirements).toHaveProperty('partType');
        expect(slot.requirements).toHaveProperty('components');
        expect(slot.requirements.components).toContain('anatomy:part');
        expect(typeof slot.optional).toBe('boolean');
      }
    });

    it('should generate slots that can be merged with additionalSlots', () => {
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
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const generatedSlots =
        slotGenerator.generateBlueprintSlots(structureTemplate);

      // Simulate additionalSlots that might be defined in blueprint
      const additionalSlots = {
        grip_left: {
          socket: 'grip_left',
          requirements: {
            partType: 'weapon',
            components: ['items-core:item'],
          },
          optional: true,
        },
      };

      // Merge slots (simulating BodyBlueprintFactory behavior)
      const mergedSlots = { ...generatedSlots, ...additionalSlots };

      expect(Object.keys(mergedSlots)).toHaveLength(3);
      expect(mergedSlots.arm_left).toBeDefined();
      expect(mergedSlots.arm_right).toBeDefined();
      expect(mergedSlots.grip_left).toBeDefined();
    });

    it('should work with recipe validation', () => {
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
                allowedTypes: ['arm'],
              },
            },
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const generatedSlots =
        slotGenerator.generateBlueprintSlots(structureTemplate);

      // Simulate recipe with slot overrides
      const recipe = {
        recipeId: 'anatomy:recipe_human',
        slots: {
          arm_left: {
            partId: 'anatomy:part_muscular_arm',
          },
          leg_right: {
            partId: 'anatomy:part_athletic_leg',
          },
        },
      };

      // Verify all recipe slot keys exist in generated slots
      const generatedSlotKeys = Object.keys(generatedSlots);
      for (const recipeSlotKey of Object.keys(recipe.slots)) {
        expect(generatedSlotKeys).toContain(recipeSlotKey);
      }
    });
  });

  describe('End-to-End Anatomy Graph Workflow', () => {
    it('should generate slots that coordinate with socket generation', () => {
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
                allowedTypes: ['arm'],
                nameTpl: '{{orientation}} {{type}}',
              },
            },
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
                nameTpl: '{{type}}',
              },
            },
          ],
        },
      };

      // Generate both slots and sockets
      const slots = slotGenerator.generateBlueprintSlots(structureTemplate);
      const sockets = socketGenerator.generateSockets(structureTemplate);

      // Verify coordination
      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);

      // Verify each socket has a corresponding slot with matching requirements
      for (const socket of sockets) {
        const slot = slots[socket.id];
        expect(slot).toBeDefined();
        expect(slot.socket).toBe(socket.id);

        // Verify allowed types coordination
        const slotPartType = slot.requirements.partType;
        expect(socket.allowedTypes).toBeDefined();
        // Part type should be one of the allowed types or the limb type itself
        const isCoordinated =
          socket.allowedTypes.includes(slotPartType) ||
          slotPartType ===
            structureTemplate.topology.limbSets?.find((ls) =>
              socket.id.startsWith(ls.type)
            )?.type ||
          slotPartType ===
            structureTemplate.topology.appendages?.find((a) =>
              socket.id.startsWith(a.type)
            )?.type;
        expect(isCoordinated).toBe(true);
      }
    });

    it('should support complex multi-species templates', () => {
      const templates = [
        // Humanoid
        {
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
                  allowedTypes: ['arm'],
                },
              },
              {
                type: 'leg',
                count: 2,
                arrangement: 'bilateral',
                socketPattern: {
                  idTemplate: 'leg_{{orientation}}',
                  orientationScheme: 'bilateral',
                  allowedTypes: ['leg'],
                },
              },
            ],
            appendages: [
              {
                type: 'head',
                count: 1,
                attachment: 'anterior',
                socketPattern: {
                  idTemplate: 'head',
                  orientationScheme: 'indexed',
                  allowedTypes: ['head'],
                },
              },
            ],
          },
        },
        // Spider
        {
          id: 'anatomy:structure_spider',
          topology: {
            rootType: 'cephalothorax',
            limbSets: [
              {
                type: 'leg',
                count: 8,
                arrangement: 'radial',
                socketPattern: {
                  idTemplate: 'leg_{{position}}',
                  orientationScheme: 'radial',
                  allowedTypes: ['spider_leg'],
                },
              },
            ],
            appendages: [
              {
                type: 'pedipalp',
                count: 2,
                attachment: 'anterior',
                socketPattern: {
                  idTemplate: 'pedipalp_{{orientation}}',
                  orientationScheme: 'bilateral',
                  allowedTypes: ['pedipalp'],
                },
              },
              {
                type: 'torso',
                count: 1,
                attachment: 'posterior',
                socketPattern: {
                  idTemplate: 'abdomen',
                  orientationScheme: 'indexed',
                  allowedTypes: ['abdomen'],
                },
              },
            ],
          },
        },
        // Quadruped
        {
          id: 'anatomy:structure_quadruped',
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
                  allowedTypes: ['leg'],
                },
              },
            ],
            appendages: [
              {
                type: 'head',
                count: 1,
                attachment: 'anterior',
                socketPattern: {
                  idTemplate: 'head',
                  orientationScheme: 'indexed',
                  allowedTypes: ['head'],
                },
              },
              {
                type: 'tail',
                count: 1,
                attachment: 'posterior',
                optional: true,
                socketPattern: {
                  idTemplate: 'tail',
                  orientationScheme: 'indexed',
                  allowedTypes: ['tail'],
                },
              },
            ],
          },
        },
      ];

      // Verify each template generates valid slots
      for (const template of templates) {
        const slots = slotGenerator.generateBlueprintSlots(template);
        const sockets = socketGenerator.generateSockets(template);

        // Basic validations
        expect(Object.keys(slots).length).toBeGreaterThan(0);
        expect(sockets.length).toBeGreaterThan(0);

        // Verify synchronization
        const slotKeys = Object.keys(slots).sort();
        const socketIds = sockets.map((s) => s.id).sort();
        expect(slotKeys).toEqual(socketIds);

        // Log successful generation
        testBed.mockLogger.info(
          `Generated ${Object.keys(slots).length} slots for ${template.id}`
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid template structure', () => {
      expect(() => {
        slotGenerator.generateBlueprintSlots(null);
      }).toThrow('Invalid structure template');

      expect(() => {
        slotGenerator.generateBlueprintSlots({});
      }).toThrow('Invalid structure template');
    });

    it('should handle static idTemplate without variables gracefully', () => {
      // Static idTemplate without variables will overwrite previous keys
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: 'limb', // Static template, last wins
                orientationScheme: 'indexed',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      // Only one key exists (last assignment wins in JavaScript objects)
      expect(Object.keys(slots)).toHaveLength(1);
      expect(slots['limb']).toBeDefined();
    });
  });
});
