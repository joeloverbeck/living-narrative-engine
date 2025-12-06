/**
 * @file Unit tests for socketExtractor
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  extractSocketsFromEntity,
  resolveEntityId,
  setSocketExtractorLogger,
} from '../../../../src/anatomy/validation/socketExtractor.js';

describe('socketExtractor', () => {
  describe('extractSocketsFromEntity', () => {
    it('should extract all sockets from entity with anatomy:sockets component', () => {
      const entity = {
        id: 'anatomy:test_torso',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 'head',
                orientation: 'upper',
                allowedTypes: ['head', 'neck'],
                nameTpl: '{{type}}',
              },
              {
                id: 'leg_left',
                orientation: 'left',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
                index: 1,
              },
              {
                id: 'leg_right',
                orientation: 'right',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} {{type}}',
                index: 2,
              },
            ],
          },
        },
      };

      const result = extractSocketsFromEntity(entity);

      expect(result.size).toBe(3);
      expect(result.has('head')).toBe(true);
      expect(result.has('leg_left')).toBe(true);
      expect(result.has('leg_right')).toBe(true);

      const headSocket = result.get('head');
      expect(headSocket.id).toBe('head');
      expect(headSocket.orientation).toBe('upper');
      expect(headSocket.allowedTypes).toEqual(['head', 'neck']);
      expect(headSocket.nameTpl).toBe('{{type}}');

      const legSocket = result.get('leg_left');
      expect(legSocket.index).toBe(1);
    });

    it('should return empty map for entity without anatomy:sockets component', () => {
      const entity = {
        id: 'anatomy:test_part',
        components: {
          'anatomy:part': {
            subType: 'test',
          },
        },
      };

      const result = extractSocketsFromEntity(entity);

      expect(result.size).toBe(0);
    });

    it('should return empty map for entity with empty sockets array', () => {
      const entity = {
        id: 'anatomy:test_torso',
        components: {
          'anatomy:sockets': {
            sockets: [],
          },
        },
      };

      const result = extractSocketsFromEntity(entity);

      expect(result.size).toBe(0);
    });

    it('should skip sockets without id property', () => {
      const entity = {
        id: 'anatomy:test_torso',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 'valid_socket',
                allowedTypes: ['test'],
              },
              {
                // Missing id
                allowedTypes: ['test'],
              },
              {
                id: 'another_valid',
                allowedTypes: ['test'],
              },
            ],
          },
        },
      };

      const result = extractSocketsFromEntity(entity);

      expect(result.size).toBe(2);
      expect(result.has('valid_socket')).toBe(true);
      expect(result.has('another_valid')).toBe(true);
    });

    it('should handle entity with no components', () => {
      const entity = {
        id: 'anatomy:test_entity',
      };

      const result = extractSocketsFromEntity(entity);

      expect(result.size).toBe(0);
    });

    it('should handle null entity', () => {
      const result = extractSocketsFromEntity(null);

      expect(result.size).toBe(0);
    });

    it('should handle undefined entity', () => {
      const result = extractSocketsFromEntity(undefined);

      expect(result.size).toBe(0);
    });

    it('should handle non-object entity', () => {
      const result = extractSocketsFromEntity('not an object');

      expect(result.size).toBe(0);
    });

    it('should include all socket properties in extracted data', () => {
      const entity = {
        id: 'anatomy:test_torso',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 'test_socket',
                orientation: 'left',
                allowedTypes: ['arm', 'wing'],
                nameTpl: '{{orientation}} {{type}}',
                index: 5,
              },
            ],
          },
        },
      };

      const result = extractSocketsFromEntity(entity);
      const socket = result.get('test_socket');

      expect(socket).toEqual({
        id: 'test_socket',
        orientation: 'left',
        allowedTypes: ['arm', 'wing'],
        nameTpl: '{{orientation}} {{type}}',
        index: 5,
      });
    });

    it('should handle sockets with empty allowedTypes array', () => {
      const entity = {
        id: 'anatomy:test_torso',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 'test_socket',
                allowedTypes: [],
              },
            ],
          },
        },
      };

      const result = extractSocketsFromEntity(entity);
      const socket = result.get('test_socket');

      expect(socket.allowedTypes).toEqual([]);
    });

    it('should handle sockets missing optional properties', () => {
      const entity = {
        id: 'anatomy:test_torso',
        components: {
          'anatomy:sockets': {
            sockets: [
              {
                id: 'minimal_socket',
              },
            ],
          },
        },
      };

      const result = extractSocketsFromEntity(entity);
      const socket = result.get('minimal_socket');

      expect(socket.id).toBe('minimal_socket');
      expect(socket.orientation).toBeUndefined();
      expect(socket.allowedTypes).toEqual([]);
      expect(socket.nameTpl).toBeUndefined();
      expect(socket.index).toBeUndefined();
    });
  });

  describe('resolveEntityId', () => {
    it('returns null for null partType', async () => {
      const mockRegistry = {
        getAll: jest.fn(),
      };
      const result = await resolveEntityId(null, mockRegistry);
      expect(result).toBeNull();
    });

    it('returns null for null dataRegistry', async () => {
      const result = await resolveEntityId('head', null);
      expect(result).toBeNull();
    });

    it('returns null when no entity matches', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:arm',
            components: { 'anatomy:part': { subType: 'arm' } },
          },
        ]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBeNull();
    });

    it('returns entity ID when single match exists', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:head',
            components: { 'anatomy:part': { subType: 'head' } },
          },
        ]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBe('anatomy:head');
    });

    // Priority Rule Tests

    it('prefers entity with fewer underscores (base entities)', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:head_variant_one',
            components: { 'anatomy:part': { subType: 'head' } },
          },
          {
            id: 'anatomy:head',
            components: { 'anatomy:part': { subType: 'head' } },
          },
          {
            id: 'anatomy:head_variant',
            components: { 'anatomy:part': { subType: 'head' } },
          },
        ]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBe('anatomy:head');
    });

    it('prefers alphabetical entity ID over shorter ID when underscore count is equal', async () => {
      // Case: Equal underscores (1)
      // Entity A: 'anatomy:a_longer' (starts with 'a', length longer)
      // Entity B: 'anatomy:z_short' (starts with 'z', length shorter)
      // New Rule 2 (Alphabetical) should pick 'a_longer'.
      // Old Rule 2 (Length) would have picked 'z_short'.

      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:z_short', // 1 underscore, shorter
            components: { 'anatomy:part': { subType: 'test' } },
          },
          {
            id: 'anatomy:a_longer', // 1 underscore, longer, but alphabetically first
            components: { 'anatomy:part': { subType: 'test' } },
          },
        ]),
      };

      const result = await resolveEntityId('test', mockRegistry);
      expect(result).toBe('anatomy:a_longer');
    });

    it('prefers shorter entity ID when underscore count AND alphabetical are equal (prefix match)', async () => {
      // This is actually covered by alphabetical sort usually (shorter prefix comes first),
      // but let's ensure logic holds.
      // 'test' vs 'test_a'
      // 'test' comes before 'test_a' alphabetically.

      // So it's hard to find a case where alphabetical is equal but length is different
      // UNLESS they are identical strings (in which case length is equal).
      // So Rule 3 (Length) is effectively unreachable or redundant if localeCompare covers it.
      // But localeCompare might handle cases differently?
      // Let's keep the test simple.

      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:test_ab',
            components: { 'anatomy:part': { subType: 'test' } },
          },
          {
            id: 'anatomy:test_a',
            components: { 'anatomy:part': { subType: 'test' } },
          },
        ]),
      };

      const result = await resolveEntityId('test', mockRegistry);
      expect(result).toBe('anatomy:test_a');
    });

    it('returns consistent result regardless of input order', async () => {
      const entities = [
        {
          id: 'anatomy:humanoid_face_bearded', // 2 underscores
          components: { 'anatomy:part': { subType: 'head' } },
        },
        {
          id: 'anatomy:humanoid_head', // 1 underscore - WINNER
          components: { 'anatomy:part': { subType: 'head' } },
        },
        {
          id: 'anatomy:humanoid_face', // 1 underscore, but alphabetically after 'humanoid_face' < 'humanoid_head'?
          // anatomy:humanoid_face (length 21)
          // anatomy:humanoid_head (length 21)
          // 'f' < 'h', so 'humanoid_face' would win alphabetically if rule 1 & 2 tied.
          // Both have 1 underscore.
          // Both have length 21.
          // Alphabetical: face comes before head.
        },
      ];

      // Wait, let's test specific scenario from the ticket
      // anatomy:humanoid_face_bearded_full_trimmed (4 underscores)
      // anatomy:humanoid_head (1 underscore)

      const entities2 = [
        {
          id: 'anatomy:humanoid_face_bearded_full_trimmed',
          components: { 'anatomy:part': { subType: 'head' } },
        },
        {
          id: 'anatomy:humanoid_head',
          components: { 'anatomy:part': { subType: 'head' } },
        },
      ];

      const mockRegistryForward = {
        getAll: jest.fn().mockReturnValue([...entities2]),
      };

      const mockRegistryReverse = {
        getAll: jest.fn().mockReturnValue([...entities2].reverse()),
      };

      const result1 = await resolveEntityId('head', mockRegistryForward);
      const result2 = await resolveEntityId('head', mockRegistryReverse);

      expect(result1).toBe('anatomy:humanoid_head');
      expect(result2).toBe('anatomy:humanoid_head');
      expect(result1).toBe(result2);
    });

    it('handles empty entity array', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBeNull();
    });

    it('handles entities without anatomy:part component', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:other',
            components: {},
          },
          {
            id: 'anatomy:head',
            components: { 'anatomy:part': { subType: 'head' } },
          },
        ]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBe('anatomy:head');
    });

    it('handles registry with getAll method', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'anatomy:head',
            components: { 'anatomy:part': { subType: 'head' } },
          },
        ]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBe('anatomy:head');
      expect(mockRegistry.getAll).toHaveBeenCalledWith('entityDefinitions');
    });

    it('handles registry with getAllEntityDefinitions method', async () => {
      const mockRegistry = {
        getAllEntityDefinitions: jest.fn().mockReturnValue([
          {
            id: 'anatomy:head',
            components: { 'anatomy:part': { subType: 'head' } },
          },
        ]),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBe('anatomy:head');
      expect(mockRegistry.getAllEntityDefinitions).toHaveBeenCalled();
    });

    it('handles registry with no retrieval methods', async () => {
      const mockRegistry = {};
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBeNull();
    });

    it('handles registry returning null/undefined', async () => {
      const mockRegistry = {
        getAll: jest.fn().mockReturnValue(null),
      };
      const result = await resolveEntityId('head', mockRegistry);
      expect(result).toBeNull();
    });

    describe('logging', () => {
      afterEach(() => {
        setSocketExtractorLogger(null);
      });

      it('logs when multiple candidates are present', async () => {
        const debug = jest.fn();
        setSocketExtractorLogger({ debug });

        const mockRegistry = {
          getAll: jest.fn().mockReturnValue([
            {
              id: 'anatomy:humanoid_head_variant',
              components: { 'anatomy:part': { subType: 'head' } },
            },
            {
              id: 'anatomy:humanoid_head',
              components: { 'anatomy:part': { subType: 'head' } },
            },
          ]),
        };

        const result = await resolveEntityId('head', mockRegistry);

        expect(result).toBe('anatomy:humanoid_head');
        expect(debug).toHaveBeenCalledTimes(1);

        const message = debug.mock.calls[0][0];
        expect(message).toContain('subType "head"');
        expect(message).toContain('anatomy:humanoid_head_variant');
        expect(message).toContain('anatomy:humanoid_head');
        expect(message).toContain(
          'priority: fewest underscores, alphabetical, shortest ID'
        );
      });

      it('does not log when only a single candidate exists', async () => {
        const debug = jest.fn();
        setSocketExtractorLogger({ debug });

        const mockRegistry = {
          getAll: jest.fn().mockReturnValue([
            {
              id: 'anatomy:humanoid_head',
              components: { 'anatomy:part': { subType: 'head' } },
            },
          ]),
        };

        const result = await resolveEntityId('head', mockRegistry);

        expect(result).toBe('anatomy:humanoid_head');
        expect(debug).not.toHaveBeenCalled();
      });
    });
  });
});
