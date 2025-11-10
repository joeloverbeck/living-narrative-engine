/**
 * @file Integration tests for socket/slot compatibility validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateSocketSlotCompatibility } from '../../../../src/anatomy/validation/socketSlotCompatibilityValidator.js';

describe('Socket/Slot Compatibility Integration', () => {
  let mockDataRegistry;

  beforeEach(() => {
    // Mock data registry with realistic entity definitions
    mockDataRegistry = {
      get: (category, id) => {
        const entities = {
          'anatomy:centaur_torso': {
            id: 'anatomy:centaur_torso',
            _sourceFile:
              'data/mods/anatomy/entities/definitions/centaur_torso.entity.json',
            components: {
              'anatomy:sockets': {
                sockets: [
                  {
                    id: 'leg_left_front',
                    orientation: 'left_front',
                    allowedTypes: ['centaur_leg_front', 'horse_leg', 'leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'leg_right_front',
                    orientation: 'right_front',
                    allowedTypes: ['centaur_leg_front', 'horse_leg', 'leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'leg_left_rear',
                    orientation: 'left_rear',
                    allowedTypes: ['centaur_leg_rear', 'horse_leg', 'leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'leg_right_rear',
                    orientation: 'right_rear',
                    allowedTypes: ['centaur_leg_rear', 'horse_leg', 'leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'arm_left',
                    orientation: 'left',
                    allowedTypes: ['arm', 'humanoid_arm'],
                    nameTpl: '{{orientation}} arm',
                  },
                  {
                    id: 'arm_right',
                    orientation: 'right',
                    allowedTypes: ['arm', 'humanoid_arm'],
                    nameTpl: '{{orientation}} arm',
                  },
                  {
                    id: 'upper_torso',
                    allowedTypes: [
                      'centaur_upper_torso',
                      'human_torso',
                      'humanoid_torso',
                      'torso',
                    ],
                    nameTpl: 'upper torso',
                  },
                  {
                    id: 'head',
                    allowedTypes: [
                      'centaur_head',
                      'human_head',
                      'humanoid_head',
                      'head',
                    ],
                    nameTpl: 'head',
                  },
                  {
                    id: 'tail',
                    allowedTypes: ['horse_tail', 'equine_tail', 'tail'],
                    nameTpl: 'tail',
                  },
                  {
                    id: 'back_upper',
                    allowedTypes: ['equipment_mount'],
                    nameTpl: 'quiver mount',
                  },
                ],
              },
            },
          },
          'anatomy:spider_cephalothorax': {
            id: 'anatomy:spider_cephalothorax',
            _sourceFile:
              'data/mods/anatomy/entities/definitions/spider_cephalothorax.entity.json',
            components: {
              'anatomy:sockets': {
                sockets: [
                  {
                    id: 'leg_1',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 1,
                  },
                  {
                    id: 'leg_2',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 2,
                  },
                  {
                    id: 'leg_3',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 3,
                  },
                  {
                    id: 'leg_4',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 4,
                  },
                  {
                    id: 'leg_5',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 5,
                  },
                  {
                    id: 'leg_6',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 6,
                  },
                  {
                    id: 'leg_7',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 7,
                  },
                  {
                    id: 'leg_8',
                    allowedTypes: ['spider_leg'],
                    nameTpl: 'leg {{index}}',
                    index: 8,
                  },
                  {
                    id: 'pedipalp_1',
                    allowedTypes: ['spider_pedipalp'],
                    nameTpl: 'pedipalp {{index}}',
                    index: 1,
                  },
                  {
                    id: 'pedipalp_2',
                    allowedTypes: ['spider_pedipalp'],
                    nameTpl: 'pedipalp {{index}}',
                    index: 2,
                  },
                  {
                    id: 'posterior_torso',
                    allowedTypes: ['spider_abdomen'],
                    nameTpl: 'torso',
                  },
                  {
                    id: 'spinnerets',
                    allowedTypes: ['spinneret'],
                    nameTpl: 'spinnerets',
                  },
                ],
              },
            },
          },
          'anatomy:dragon_torso': {
            id: 'anatomy:dragon_torso',
            _sourceFile:
              'data/mods/anatomy/entities/definitions/dragon_torso.entity.json',
            components: {
              'anatomy:sockets': {
                sockets: [
                  {
                    id: 'leg_left_front',
                    orientation: 'left_front',
                    allowedTypes: ['dragon_leg', 'reptilian_leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'leg_right_front',
                    orientation: 'right_front',
                    allowedTypes: ['dragon_leg', 'reptilian_leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'leg_left_rear',
                    orientation: 'left_rear',
                    allowedTypes: ['dragon_leg', 'reptilian_leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'leg_right_rear',
                    orientation: 'right_rear',
                    allowedTypes: ['dragon_leg', 'reptilian_leg'],
                    nameTpl: '{{orientation}} leg',
                  },
                  {
                    id: 'wing_left',
                    orientation: 'left',
                    allowedTypes: ['dragon_wing', 'bat_wing'],
                    nameTpl: '{{orientation}} wing',
                  },
                  {
                    id: 'wing_right',
                    orientation: 'right',
                    allowedTypes: ['dragon_wing', 'bat_wing'],
                    nameTpl: '{{orientation}} wing',
                  },
                  {
                    id: 'head',
                    allowedTypes: ['dragon_head', 'reptilian_head'],
                    nameTpl: 'head',
                  },
                  {
                    id: 'tail',
                    allowedTypes: ['dragon_tail', 'reptilian_tail'],
                    nameTpl: 'tail',
                  },
                ],
              },
            },
          },
        };

        if (category === 'entityDefinitions') {
          return entities[id];
        }
        return undefined;
      },
    };
  });

  describe('Real Blueprint Validation', () => {
    it('should validate centaur blueprint with valid additionalSlots', async () => {
      const blueprint = {
        id: 'anatomy:centaur_warrior',
        schemaVersion: '2.0',
        root: 'anatomy:centaur_torso',
        structureTemplate: 'anatomy:structure_centauroid',
        additionalSlots: {
          quiver_mount: {
            socket: 'back_upper',
            requirements: {
              partType: 'equipment_mount',
              components: ['anatomy:part'],
            },
            optional: true,
          },
          arm_left: {
            parent: 'upper_torso',
            socket: 'arm_left',
            requirements: {
              partType: 'arm',
              components: ['anatomy:part'],
            },
          },
          arm_right: {
            parent: 'upper_torso',
            socket: 'arm_right',
            requirements: {
              partType: 'arm',
              components: ['anatomy:part'],
            },
          },
          head: {
            parent: 'upper_torso',
            socket: 'head',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });

    it('should validate spider blueprint with valid additionalSlots', async () => {
      const blueprint = {
        id: 'anatomy:giant_spider',
        schemaVersion: '2.0',
        root: 'anatomy:spider_cephalothorax',
        structureTemplate: 'anatomy:structure_arachnid_8leg',
        additionalSlots: {
          venom_gland: {
            socket: 'venom_gland', // This socket doesn't exist
            requirements: {
              partType: 'venom_gland',
              components: ['anatomy:part', 'anatomy:venom'],
            },
            // Removed optional: true to test that required slots are validated
          },
          spinnerets: {
            socket: 'spinnerets', // This socket exists
            requirements: {
              partType: 'spinneret',
              components: ['anatomy:part'],
            },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      // Should have 1 error for venom_gland socket not found
      expect(errors.length).toBe(1);
      expect(errors[0].slotName).toBe('venom_gland');
      expect(errors[0].type).toBe('SOCKET_NOT_FOUND');
    });

    it('should detect missing fire_gland socket in dragon blueprint', async () => {
      const blueprint = {
        id: 'anatomy:red_dragon',
        schemaVersion: '2.0',
        root: 'anatomy:dragon_torso',
        structureTemplate: 'anatomy:structure_winged_quadruped',
        additionalSlots: {
          fire_gland: {
            socket: 'fire_gland', // This socket doesn't exist
            requirements: {
              partType: 'gland',
              components: ['anatomy:part', 'anatomy:fire_breathing'],
            },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('SOCKET_NOT_FOUND');
      expect(errors[0].slotName).toBe('fire_gland');
      expect(errors[0].socketId).toBe('fire_gland');
      expect(errors[0].rootEntityId).toBe('anatomy:dragon_torso');
      expect(errors[0].availableSockets).toContain('head');
      expect(errors[0].availableSockets).toContain('tail');
      expect(errors[0].availableSockets).toContain('wing_left');
      expect(errors[0].message).toContain('anatomy:dragon_torso');
      expect(errors[0].fix).toContain('dragon_torso.entity.json');
    });
  });

  describe('Multi-Error Scenarios', () => {
    it('should report multiple invalid sockets', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          invalid1: {
            socket: 'nonexistent_socket_1',
            requirements: { partType: 'test' },
          },
          valid: {
            socket: 'head',
            requirements: { partType: 'head' },
          },
          invalid2: {
            socket: 'nonexistent_socket_2',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(2);
      const slotNames = errors.map((e) => e.slotName);
      expect(slotNames).toContain('invalid1');
      expect(slotNames).toContain('invalid2');
    });

    it('should report invalid socket and missing root entity together', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:nonexistent_entity',
        additionalSlots: {
          test: {
            socket: 'some_socket',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      // Only root entity error should be returned (validation stops early)
      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('ROOT_ENTITY_NOT_FOUND');
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable fix suggestions', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'fire_glan', // Typo similar to 'fire_gland' but not in sockets
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].fix).toBeTruthy();
      expect(errors[0].fix.length).toBeGreaterThan(0);
      // Should list available sockets
      expect(errors[0].fix).toContain('[');
      expect(errors[0].fix).toContain(']');
    });

    it('should include file path in fix suggestion', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'missing_socket',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].fix).toContain('centaur_torso.entity.json');
    });
  });
});
