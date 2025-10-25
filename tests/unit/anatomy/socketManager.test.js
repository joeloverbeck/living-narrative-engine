import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import SocketManager from '../../../src/anatomy/socketManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/** Helper to create minimal mocks for the entity manager. */
function createMocks() {
  return {
    entityManager: {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    },
    logger: { debug: jest.fn() },
  };
}

describe('SocketManager', () => {
  let entityManager;
  let logger;
  let manager;
  let occupancy;

  describe('constructor validation', () => {
    it('throws when entityManager is missing', () => {
      expect(() => new SocketManager({ logger: { debug: jest.fn() } })).toThrow(
        InvalidArgumentError
      );
      expect(() => new SocketManager({ logger: { debug: jest.fn() } })).toThrow(
        'entityManager is required'
      );
    });

    it('throws when logger is missing', () => {
      expect(() =>
        new SocketManager({ entityManager: { getComponentData: jest.fn() } })
      ).toThrow(InvalidArgumentError);
      expect(() =>
        new SocketManager({ entityManager: { getComponentData: jest.fn() } })
      ).toThrow('logger is required');
    });
  });

  beforeEach(() => {
    ({ entityManager, logger } = createMocks());
    manager = new SocketManager({ entityManager, logger });
    occupancy = new Set();
  });

  describe('getSocket', () => {
    it('returns existing socket', () => {
      const sockets = [{ id: 's1' }, { id: 's2' }];
      entityManager.getComponentData.mockReturnValue({ sockets });

      const result = manager.getSocket('p', 's2');

      expect(result).toBe(sockets[1]);
    });

    it('returns null when sockets component missing', () => {
      entityManager.getComponentData.mockReturnValue(undefined);

      const result = manager.getSocket('p', 'x');

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        "SocketManager: No sockets component found on entity 'p'"
      );
    });

    it('returns undefined when socket not found', () => {
      entityManager.getComponentData.mockReturnValue({ sockets: [] });

      const result = manager.getSocket('p', 'x');

      expect(result).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        "SocketManager: Socket 'x' not found on entity 'p'"
      );
    });
  });

  describe('socket occupancy helpers', () => {
    it('marks and checks socket occupancy', () => {
      manager.occupySocket('p', 's1', occupancy);

      expect(occupancy.has('p:s1')).toBe(true);
      expect(logger.debug).toHaveBeenLastCalledWith(
        "SocketManager: Occupied socket 's1' on entity 'p'"
      );

      expect(manager.isSocketOccupied('p', 's1', occupancy)).toBe(true);
    });
  });

  describe('validateSocketAvailability', () => {
    it('handles missing socket when required', () => {
      entityManager.getComponentData.mockReturnValueOnce({ sockets: [] });
      entityManager.getEntityInstance.mockReturnValueOnce({
        definitionId: 'def',
      });

      const result = manager.validateSocketAvailability(
        'p',
        's1',
        occupancy,
        true
      );

      expect(result).toEqual({
        valid: false,
        error: "Socket 's1' not found on parent entity 'def'",
      });
    });

    it('handles missing socket when optional', () => {
      entityManager.getComponentData.mockReturnValueOnce({ sockets: [] });
      entityManager.getEntityInstance.mockReturnValueOnce({
        definitionId: 'def',
      });

      const result = manager.validateSocketAvailability(
        'p',
        's1',
        occupancy,
        false
      );

      expect(result).toEqual({ valid: false });
      expect(logger.debug).toHaveBeenLastCalledWith(
        "SocketManager: Socket 's1' not found on parent entity 'def' (optional socket)"
      );
    });

    it('handles occupied socket', () => {
      entityManager.getComponentData.mockReturnValue({
        sockets: [{ id: 's1' }],
      });
      occupancy.add('p:s1');

      const required = manager.validateSocketAvailability(
        'p',
        's1',
        occupancy,
        true
      );
      expect(required).toEqual({
        valid: false,
        error: "Socket 's1' is already occupied on parent 'p'",
      });

      const optional = manager.validateSocketAvailability(
        'p',
        's1',
        occupancy,
        false
      );
      expect(optional).toEqual({ valid: false });
      expect(logger.debug).toHaveBeenLastCalledWith(
        "SocketManager: Socket 's1' is already occupied on parent 'p' (optional socket)"
      );
    });

    it('returns socket when available', () => {
      const socket = { id: 's1' };
      entityManager.getComponentData.mockReturnValue({ sockets: [socket] });

      const result = manager.validateSocketAvailability(
        'p',
        's1',
        occupancy,
        true
      );

      expect(result).toEqual({ valid: true, socket });
    });
  });

  describe('isPartTypeAllowed', () => {
    it('supports wildcard and explicit types', () => {
      expect(manager.isPartTypeAllowed({ allowedTypes: ['*'] }, 'x')).toBe(
        true
      );
      const socket = { allowedTypes: ['hand', 'foot'] };
      expect(manager.isPartTypeAllowed(socket, 'hand')).toBe(true);
      expect(manager.isPartTypeAllowed(socket, 'tail')).toBe(false);
    });
  });

  describe('generatePartName', () => {
    it('returns null when no template', () => {
      expect(manager.generatePartName({}, 'c', 'p')).toBeNull();
    });

    it('generates name from template with socket orientation', () => {
      const socket = {
        nameTpl: '{{orientation}} {{type}} of {{parent.name}}',
        orientation: 'left',
      };
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (id === 'child' && type === 'anatomy:part')
          return { subType: 'arm' };
        if (id === 'parent' && type === 'core:name') return { text: 'Bob' };
        return undefined;
      });

      const name = manager.generatePartName(socket, 'child', 'parent');

      expect(name).toBe('left arm of Bob');
      expect(logger.debug).toHaveBeenLastCalledWith(
        "SocketManager: Generated name 'left arm of Bob' for part using template '{{orientation}} {{type}} of {{parent.name}}'"
      );
    });

    it('uses effective orientation from child anatomy:part when available', () => {
      const socket = {
        nameTpl: '{{effective_orientation}} {{type}}',
        orientation: 'left',
      };
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (id === 'child' && type === 'anatomy:part')
          return { subType: 'arm', orientation: 'right' };
        return undefined;
      });

      const name = manager.generatePartName(socket, 'child', 'parent');

      expect(name).toBe('right arm');
    });

    it('falls back to socket orientation for effective_orientation when child has none', () => {
      const socket = {
        nameTpl: '{{effective_orientation}} {{type}}',
        orientation: 'left',
      };
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (id === 'child' && type === 'anatomy:part')
          return { subType: 'arm' };
        return undefined;
      });

      const name = manager.generatePartName(socket, 'child', 'parent');

      expect(name).toBe('left arm');
    });

    it('handles all template replacements correctly', () => {
      const socket = {
        nameTpl:
          '{{orientation}} {{effective_orientation}} {{type}} {{index}} of {{parent.name}}',
        orientation: 'left',
      };
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (id === 'child' && type === 'anatomy:part')
          return { subType: 'arm', orientation: 'right' };
        if (id === 'parent' && type === 'core:name') return { text: 'Bob' };
        return undefined;
      });

      const name = manager.generatePartName(socket, 'child', 'parent');

      expect(name).toBe('left right arm  of Bob');
    });

    it('transforms underscores to spaces in subType', () => {
      const socket = {
        nameTpl: '{{orientation}} {{type}}',
        orientation: 'left',
      };
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (id === 'child' && type === 'anatomy:part')
          return { subType: 'ass_cheek' };
        return undefined;
      });

      const name = manager.generatePartName(socket, 'child', 'parent');

      expect(name).toBe('left ass cheek');
    });

    it('handles multiple underscores in subType', () => {
      const socket = {
        nameTpl: '{{type}}',
      };
      entityManager.getComponentData.mockImplementation((id, type) => {
        if (id === 'child' && type === 'anatomy:part')
          return { subType: 'complex_body_part_name' };
        return undefined;
      });

      const name = manager.generatePartName(socket, 'child', 'parent');

      expect(name).toBe('complex body part name');
    });
  });

  describe('validateOccupiedSockets', () => {
    it('reports missing sockets', () => {
      entityManager.getComponentData.mockReturnValue(undefined);
      const errors = manager.validateOccupiedSockets(new Set(['p:s1']));
      expect(errors).toEqual(["Occupied socket 's1' not found on entity 'p'"]);
    });

    it('returns empty array when all sockets exist', () => {
      entityManager.getComponentData.mockReturnValue({
        sockets: [{ id: 's1' }],
      });
      const errors = manager.validateOccupiedSockets(new Set(['p:s1']));
      expect(errors).toEqual([]);
    });
  });
});
