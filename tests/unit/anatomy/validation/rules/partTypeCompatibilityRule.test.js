import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PartTypeCompatibilityRule } from '../../../../../src/anatomy/validation/rules/partTypeCompatibilityRule.js';

describe('PartTypeCompatibilityRule', () => {
  let rule;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
    };

    context = {
      entityIds: [],
      entityManager: mockEntityManager,
      logger: mockLogger,
    };

    rule = new PartTypeCompatibilityRule();
  });

  describe('rule metadata', () => {
    it('exposes stable identifiers', () => {
      expect(rule.ruleId).toBe('part-type-compatibility');
      expect(rule.ruleName).toBe('Part Type Compatibility');
    });
  });

  describe('validate', () => {
    it('skips entities without complete data and respects allowed type configurations', async () => {
      const componentMap = {
        noJoint: {},
        noSubtype: {
          'anatomy:joint': { parentId: 'parent-a', socketId: 'socket-a' },
          'anatomy:part': {},
        },
        'parent-a': {
          'anatomy:sockets': {
            sockets: [{ id: 'socket-a', allowedTypes: ['hand'] }],
          },
        },
        missingSocket: {
          'anatomy:joint': { parentId: 'parent-b', socketId: 'socket-missing' },
          'anatomy:part': { subType: 'tail' },
        },
        'parent-b': {
          'anatomy:sockets': {
            sockets: [{ id: 'socket-other', allowedTypes: ['tail'] }],
          },
        },
        wildcardAllowed: {
          'anatomy:joint': { parentId: 'parent-c', socketId: 'socket-c' },
          'anatomy:part': { subType: 'wing' },
        },
        'parent-c': {
          'anatomy:sockets': {
            sockets: [{ id: 'socket-c', allowedTypes: ['*'] }],
          },
        },
        explicitAllowed: {
          'anatomy:joint': { parentId: 'parent-d', socketId: 'socket-d' },
          'anatomy:part': { subType: 'antenna' },
        },
        'parent-d': {
          'anatomy:sockets': {
            sockets: [{ id: 'socket-d', allowedTypes: ['antenna'] }],
          },
        },
      };

      context.entityIds = [
        'noJoint',
        'noSubtype',
        'missingSocket',
        'wildcardAllowed',
        'explicitAllowed',
      ];

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          const components = componentMap[entityId];
          return components ? components[componentId] : undefined;
        }
      );

      const issues = await rule.validate(context);

      expect(issues).toEqual([]);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        `PartTypeCompatibilityRule: Validating part type compatibility for ${context.entityIds.length} entities`
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        'PartTypeCompatibilityRule: Found 0 part type compatibility violations'
      );
    });

    it('reports an error when a part subtype is not permitted by the socket', async () => {
      const componentMap = {
        mismatchedPart: {
          'anatomy:joint': { parentId: 'torso-1', socketId: 'socket-arm' },
          'anatomy:part': { subType: 'wing' },
        },
        'torso-1': {
          'anatomy:sockets': {
            sockets: [{ id: 'socket-arm', allowedTypes: ['arm', 'hand'] }],
          },
        },
      };

      context.entityIds = ['mismatchedPart'];
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          const components = componentMap[entityId];
          return components ? components[componentId] : undefined;
        }
      );

      const issues = await rule.validate(context);

      expect(issues).toHaveLength(1);
      const [issue] = issues;
      expect(issue.severity).toBe('error');
      expect(issue.ruleId).toBe(rule.ruleId);
      expect(issue.message).toContain(
        "Part type 'wing' not allowed in socket 'socket-arm'"
      );
      expect(issue.context).toEqual({
        entityId: 'mismatchedPart',
        partType: 'wing',
        socketId: 'socket-arm',
        parentId: 'torso-1',
        allowedTypes: ['arm', 'hand'],
      });
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        'PartTypeCompatibilityRule: Validating part type compatibility for 1 entities'
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        'PartTypeCompatibilityRule: Found 1 part type compatibility violations'
      );
    });
  });
});
