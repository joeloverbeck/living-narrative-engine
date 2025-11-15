/**
 * @file Unit tests for socketSlotCompatibilityValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateSocketSlotCompatibility } from '../../../../src/anatomy/validation/validators/SocketSlotCompatibilityValidator.js';

describe('socketSlotCompatibilityValidator', () => {
  let mockDataRegistry;

  beforeEach(() => {
    mockDataRegistry = {
      get: (category, id) => {
        const entities = {
          'anatomy:centaur_torso': {
            id: 'anatomy:centaur_torso',
            components: {
              'anatomy:sockets': {
                sockets: [
                  { id: 'leg_left_front', allowedTypes: ['leg'] },
                  { id: 'leg_right_front', allowedTypes: ['leg'] },
                  { id: 'leg_left_rear', allowedTypes: ['leg'] },
                  { id: 'leg_right_rear', allowedTypes: ['leg'] },
                  { id: 'arm_left', allowedTypes: ['arm'] },
                  { id: 'arm_right', allowedTypes: ['arm'] },
                  { id: 'head', allowedTypes: ['head'] },
                  { id: 'tail', allowedTypes: ['tail'] },
                  { id: 'back_upper', allowedTypes: ['equipment'] },
                ],
              },
            },
          },
          'anatomy:spider_cephalothorax': {
            id: 'anatomy:spider_cephalothorax',
            components: {
              'anatomy:sockets': {
                sockets: [
                  { id: 'leg_1', allowedTypes: ['spider_leg'] },
                  { id: 'leg_2', allowedTypes: ['spider_leg'] },
                  { id: 'leg_3', allowedTypes: ['spider_leg'] },
                  { id: 'leg_4', allowedTypes: ['spider_leg'] },
                  { id: 'leg_5', allowedTypes: ['spider_leg'] },
                  { id: 'leg_6', allowedTypes: ['spider_leg'] },
                  { id: 'leg_7', allowedTypes: ['spider_leg'] },
                  { id: 'leg_8', allowedTypes: ['spider_leg'] },
                  { id: 'spinnerets', allowedTypes: ['spinneret'] },
                ],
              },
            },
          },
          'anatomy:no_sockets_entity': {
            id: 'anatomy:no_sockets_entity',
            components: {
              'anatomy:part': {
                subType: 'test',
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

  describe('Root Entity Validation', () => {
    it('should return error when root entity does not exist', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:nonexistent_entity',
        additionalSlots: {},
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('ROOT_ENTITY_NOT_FOUND');
      expect(errors[0].blueprintId).toBe('anatomy:test_blueprint');
      expect(errors[0].rootEntityId).toBe('anatomy:nonexistent_entity');
      expect(errors[0].severity).toBe('error');
      expect(errors[0].message).toContain('Root entity');
      expect(errors[0].fix).toContain('Create entity');
    });

    it('should pass validation when root entity exists with no additionalSlots', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {},
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });
  });

  describe('Socket Reference Validation', () => {
    it('should pass when all additionalSlots reference valid sockets', async () => {
      const blueprint = {
        id: 'anatomy:centaur_warrior',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          quiver_mount: {
            socket: 'back_upper',
            requirements: { partType: 'equipment_mount' },
          },
          head_slot: {
            socket: 'head',
            requirements: { partType: 'head' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });

    it('should return error when additionalSlot references invalid socket', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          invalid_slot: {
            socket: 'nonexistent_socket',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('SOCKET_NOT_FOUND');
      expect(errors[0].blueprintId).toBe('anatomy:test_blueprint');
      expect(errors[0].slotName).toBe('invalid_slot');
      expect(errors[0].socketId).toBe('nonexistent_socket');
      expect(errors[0].severity).toBe('error');
      expect(errors[0].availableSockets).toContain('head');
      expect(errors[0].availableSockets).toContain('arm_left');
    });

    it('should return error when additionalSlot missing socket property', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          missing_socket: {
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('MISSING_SOCKET_REFERENCE');
      expect(errors[0].blueprintId).toBe('anatomy:test_blueprint');
      expect(errors[0].slotName).toBe('missing_socket');
      expect(errors[0].severity).toBe('error');
      expect(errors[0].fix).toContain('Add "socket" property');
    });

    it('should detect multiple invalid sockets', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          invalid1: {
            socket: 'nonexistent1',
            requirements: { partType: 'test' },
          },
          invalid2: {
            socket: 'nonexistent2',
            requirements: { partType: 'test' },
          },
          valid: {
            socket: 'head',
            requirements: { partType: 'head' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(2);
      expect(errors[0].slotName).toBe('invalid1');
      expect(errors[1].slotName).toBe('invalid2');
    });
  });

  describe('Error Messages', () => {
    it('should include blueprint ID in all errors', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          invalid: {
            socket: 'nonexistent',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].blueprintId).toBe('anatomy:test_blueprint');
    });

    it('should include socket ID in socket not found errors', async () => {
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
      expect(errors[0].socketId).toBe('missing_socket');
    });

    it('should include available sockets in error message', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'nonexistent',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].availableSockets.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('anatomy:centaur_torso');
    });

    it('should suggest similar socket name when available', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'hed', // Typo: should be 'head'
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].fix).toContain('head'); // Should suggest 'head'
      expect(errors[0].fix).toContain('Did you mean');
    });

    it('should list available sockets when no similar name found', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'completely_different',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(1);
      expect(errors[0].fix).toContain('[');
      expect(errors[0].fix).toContain('use one of');
    });
  });

  describe('Edge Cases', () => {
    it('should handle blueprint with no additionalSlots', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });

    it('should handle root entity with no sockets component', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:no_sockets_entity',
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

      expect(errors.length).toBe(1);
      expect(errors[0].type).toBe('SOCKET_NOT_FOUND');
      expect(errors[0].fix).toContain('Add anatomy:sockets component');
    });

    it('should handle empty additionalSlots object', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {},
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });

    it('should handle null blueprint', async () => {
      const errors = await validateSocketSlotCompatibility(
        null,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });

    it('should handle undefined blueprint', async () => {
      const errors = await validateSocketSlotCompatibility(
        undefined,
        mockDataRegistry
      );

      expect(errors.length).toBe(0);
    });

    it('should handle null dataRegistry', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {},
      };

      const errors = await validateSocketSlotCompatibility(blueprint, null);

      expect(errors.length).toBe(0);
    });
  });

  describe('Socket Similarity', () => {
    it('should suggest "head" for "hed"', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'hed',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors[0].fix).toContain("Did you mean 'head'");
    });

    it('should suggest "arm_left" for "arm_lft"', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'arm_lft',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors[0].fix).toContain("Did you mean 'arm_left'");
    });

    it('should be case-insensitive for similarity matching', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'HEAD',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors[0].fix).toContain("Did you mean 'head'");
    });

    it('should not suggest when distance > 3', async () => {
      const blueprint = {
        id: 'anatomy:test_blueprint',
        root: 'anatomy:centaur_torso',
        additionalSlots: {
          test: {
            socket: 'completely_unrelated_socket_name',
            requirements: { partType: 'test' },
          },
        },
      };

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        mockDataRegistry
      );

      expect(errors[0].fix).not.toContain('Did you mean');
      expect(errors[0].fix).toContain('use one of');
    });
  });
});
