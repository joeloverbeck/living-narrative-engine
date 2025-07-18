import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { GraphIntegrityValidator } from '../../../src/anatomy/graphIntegrityValidator.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  ANATOMY_SOCKETS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

const ANATOMY_JOINT_COMPONENT_ID = 'anatomy:joint';

describe('Anatomy Validation Integration', () => {
  let testBed;
  let validator;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    validator = new GraphIntegrityValidator({
      entityManager: testBed.entityManager,
      logger: testBed.logger,
    });

    // Load test anatomy components
    testBed.loadComponents({
      [ANATOMY_BODY_COMPONENT_ID]: {
        id: ANATOMY_BODY_COMPONENT_ID,
        data: { rootPartId: null, recipeId: null, body: null },
      },
      [ANATOMY_JOINT_COMPONENT_ID]: {
        id: ANATOMY_JOINT_COMPONENT_ID,
        data: { parentId: null, socketId: null, jointType: null },
      },
      [ANATOMY_PART_COMPONENT_ID]: {
        id: ANATOMY_PART_COMPONENT_ID,
        data: { subType: null },
      },
      [ANATOMY_SOCKETS_COMPONENT_ID]: {
        id: ANATOMY_SOCKETS_COMPONENT_ID,
        data: { sockets: [] },
      },
      'test:required_component': {
        id: 'test:required_component',
        data: { value: null },
      },
      'test:excluded_component_a': {
        id: 'test:excluded_component_a',
        data: { value: null },
      },
      'test:excluded_component_b': {
        id: 'test:excluded_component_b',
        data: { value: null },
      },
    });

    // Load test entity definitions
    testBed.loadEntityDefinitions({
      'test:multi_socket_torso': {
        id: 'test:multi_socket_torso',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          [ANATOMY_SOCKETS_COMPONENT_ID]: {
            sockets: [
              { id: 'left_arm_socket', allowedTypes: ['arm'] },
              { id: 'right_arm_socket', allowedTypes: ['arm'] },
              { id: 'head_socket', allowedTypes: ['head'] },
            ],
          },
        },
      },
      'test:typed_arm': {
        id: 'test:typed_arm',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
        },
      },
      'test:wrong_type_part': {
        id: 'test:wrong_type_part',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'leg' },
        },
      },
      'test:accessory': {
        id: 'test:accessory',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'accessory' },
        },
      },
      'test:constrained_part': {
        id: 'test:constrained_part',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'special' },
          'test:required_component': { value: 'present' },
        },
      },
      'test:excluded_part_a': {
        id: 'test:excluded_part_a',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'variant' },
          'test:excluded_component_a': { value: 'a' },
        },
      },
      'test:excluded_part_b': {
        id: 'test:excluded_part_b',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'variant' },
          'test:excluded_component_b': { value: 'b' },
        },
      },
    });
  });

  afterEach(() => {
    // No cleanup needed for test bed
  });

  describe('Socket Limit Validation', () => {
    it('should validate socket occupancy', async () => {
      const torso = await testBed.entityManager.createEntityInstance(
        'test:multi_socket_torso'
      );
      const arm1 = await testBed.entityManager.createEntityInstance('test:typed_arm');
      const arm2 = await testBed.entityManager.createEntityInstance('test:typed_arm');

      // Connect arms to different sockets
      await testBed.entityManager.addComponent(arm1.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'left_arm_socket',
      });
      await testBed.entityManager.addComponent(arm2.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'right_arm_socket',
      });

      const socketOccupancy = new Set([
        `${torso.id}:left_arm_socket`,
        `${torso.id}:right_arm_socket`,
      ]);

      const result = await validator.validateGraph(
        [torso.id, arm1.id, arm2.id],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when socket not found', async () => {
      const torso = await testBed.entityManager.createEntityInstance(
        'test:multi_socket_torso'
      );

      const socketOccupancy = new Set([
        `${torso.id}:nonexistent_socket`, // Socket doesn't exist
      ]);

      const result = await validator.validateGraph(
        [torso.id],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Socket 'nonexistent_socket' not found on entity '" + torso.id + "'"
      );
    });

    it('should handle missing socket definition', async () => {
      const torso = await testBed.entityManager.createEntityInstance(
        'test:multi_socket_torso'
      );

      const socketOccupancy = new Set([`${torso.id}:non_existent_socket`]);

      const result = await validator.validateGraph(
        [torso.id],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Socket 'non_existent_socket' not found on entity '" + torso.id + "'"
      );
    });
  });

  describe('Recipe Constraint Validation', () => {
    it('should pass when all requires constraints are met', async () => {
      const part = await testBed.entityManager.createEntityInstance(
        'test:constrained_part'
      );

      const recipe = {
        constraints: {
          requires: [
            {
              components: ['test:required_component'],
              partTypes: ['special'],
            },
          ],
        },
      };

      const result = await validator.validateGraph(
        [part.id],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when excludes constraints are satisfied', async () => {
      const partA = await testBed.entityManager.createEntityInstance(
        'test:excluded_part_a'
      );
      const regularPart = await testBed.entityManager.createEntityInstance('test:typed_arm');

      const recipe = {
        constraints: {
          excludes: [
            {
              components: [
                'test:excluded_component_a',
                'test:excluded_component_b',
              ],
            },
          ],
        },
      };

      // Only one excluded component is present
      const result = await validator.validateGraph(
        [partA.id, regularPart.id],
        recipe,
        new Set()
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Graph Integrity Validation', () => {});

  describe('Part Type Compatibility', () => {
    it('should handle wildcard allowedTypes', async () => {
      // Create entity with wildcard socket
      testBed.loadEntityDefinitions({
        'test:wildcard_torso': {
          id: 'test:wildcard_torso',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
            [ANATOMY_SOCKETS_COMPONENT_ID]: {
              sockets: [{ id: 'universal_socket', allowedTypes: ['*'] }],
            },
          },
        },
      });

      const torso = await testBed.entityManager.createEntityInstance(
        'test:wildcard_torso'
      );
      const arm = await testBed.entityManager.createEntityInstance('test:typed_arm');
      const leg = await testBed.entityManager.createEntityInstance(
        'test:wrong_type_part'
      );

      await testBed.entityManager.addComponent(arm.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'universal_socket',
      });
      await testBed.entityManager.addComponent(leg.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'universal_socket',
      });

      const socketOccupancy = new Set([`${torso.id}:universal_socket`]);

      const result = await validator.validateGraph(
        [torso.id, arm.id, leg.id],
        {},
        socketOccupancy
      );

      // Should accept any part type with wildcard
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle graph with multiple validation issues', async () => {
      const torso = await testBed.entityManager.createEntityInstance(
        'test:multi_socket_torso'
      );
      const arm1 = await testBed.entityManager.createEntityInstance('test:typed_arm');
      const arm2 = await testBed.entityManager.createEntityInstance('test:typed_arm');
      const arm3 = await testBed.entityManager.createEntityInstance('test:typed_arm');
      const wrongPart = await testBed.entityManager.createEntityInstance(
        'test:wrong_type_part'
      );

      // Connect arms to sockets
      await testBed.entityManager.addComponent(arm1.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'left_arm_socket',
      });
      await testBed.entityManager.addComponent(arm2.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'right_arm_socket',
      });
      // Try to connect third arm to non-existent socket
      await testBed.entityManager.addComponent(arm3.id, ANATOMY_JOINT_COMPONENT_ID, {
        parentId: torso.id,
        socketId: 'third_arm_socket', // This socket doesn't exist
      });

      // Wrong part type
      await testBed.entityManager.addComponent(
        wrongPart.id,
        ANATOMY_JOINT_COMPONENT_ID,
        {
          parentId: torso.id,
          socketId: 'head_socket',
        }
      );

      const socketOccupancy = new Set([
        `${torso.id}:left_arm_socket`,
        `${torso.id}:right_arm_socket`,
        `${torso.id}:third_arm_socket`, // Non-existent socket
        `${torso.id}:head_socket`,
      ]);

      const result = await validator.validateGraph(
        [torso.id, arm1.id, arm2.id, arm3.id, wrongPart.id],
        {},
        socketOccupancy
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should validate deeply nested anatomy structures', async () => {
      // Create parts with sockets that support nesting
      testBed.loadEntityDefinitions({
        'test:nestable_part': {
          id: 'test:nestable_part',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'nestable' },
            [ANATOMY_SOCKETS_COMPONENT_ID]: {
              sockets: [
                {
                  id: 'nested_socket',
                  allowedTypes: ['nestable'],
                },
              ],
            },
          },
        },
      });

      // Create a chain of 10 parts
      const parts = [];
      for (let i = 0; i < 10; i++) {
        const part =
          await testBed.entityManager.createEntityInstance('test:nestable_part');
        parts.push(part);

        if (i > 0) {
          await testBed.entityManager.addComponent(
            part.id,
            ANATOMY_JOINT_COMPONENT_ID,
            {
              parentId: parts[i - 1].id,
              socketId: 'nested_socket',
            }
          );
        }
      }

      const entityIds = parts.map((p) => p.id);
      const result = await validator.validateGraph(entityIds, {}, new Set());

      // Deep nesting should be valid
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty anatomy graph', async () => {
      const result = await validator.validateGraph([], {}, new Set());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
