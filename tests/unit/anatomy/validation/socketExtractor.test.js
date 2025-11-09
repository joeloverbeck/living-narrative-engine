/**
 * @file Unit tests for socketExtractor
 */

import { describe, it, expect } from '@jest/globals';
import { extractSocketsFromEntity } from '../../../../src/anatomy/validation/socketExtractor.js';

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
});
