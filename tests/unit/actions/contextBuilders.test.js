import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  buildActorContext,
  buildDirectionContext,
  buildEntityTargetContext,
  resolveDirectionExit,
} from '../../../src/actions/validation/contextBuilders.js';

jest.mock('../../../src/logic/componentAccessor.js', () => ({
  createComponentAccessor: jest.fn((id) => ({ accessorFor: id })),
}));

jest.mock('../../../src/utils/locationUtils.js', () => ({
  getExitByDirection: jest.fn(),
}));

import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';
import { getExitByDirection } from '../../../src/utils/locationUtils.js';

const mockEntityManager = {
  getComponentData: jest.fn(),
};
const mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('contextBuilders', () => {
  describe('buildActorContext', () => {
    it('returns id and component accessor', () => {
      const result = buildActorContext('actor1', mockEntityManager, mockLogger);
      expect(result).toEqual({
        id: 'actor1',
        components: { accessorFor: 'actor1' },
      });
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'actor1',
        mockEntityManager,
        mockLogger
      );
    });
  });

  describe('buildEntityTargetContext', () => {
    it('returns expected structure', () => {
      const result = buildEntityTargetContext(
        'target1',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({
        type: 'entity',
        id: 'target1',
        direction: null,
        components: { accessorFor: 'target1' },
        blocker: undefined,
        exitDetails: null,
      });
      expect(createComponentAccessor).toHaveBeenCalledWith(
        'target1',
        mockEntityManager,
        mockLogger
      );
    });
  });

  describe('resolveDirectionExit', () => {
    it('returns exit details and blocker when found', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc1',
      });
      const exitObj = { blocker: 'door', some: 'data' };
      getExitByDirection.mockReturnValue(exitObj);
      const result = resolveDirectionExit(
        'actor1',
        'north',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({ blocker: 'door', exitDetails: exitObj });
      expect(getExitByDirection).toHaveBeenCalledWith(
        'loc1',
        'north',
        mockEntityManager,
        mockLogger
      );
    });

    it('maps missing blocker to null', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc1',
      });
      const exitObj = { some: 'data' };
      getExitByDirection.mockReturnValue(exitObj);
      const result = resolveDirectionExit(
        'actor1',
        'west',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({ blocker: null, exitDetails: exitObj });
    });

    it('returns undefined blocker when no exit', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc1',
      });
      getExitByDirection.mockReturnValue(null);
      const result = resolveDirectionExit(
        'actor1',
        'south',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({ blocker: undefined, exitDetails: null });
    });

    it('skips lookup when actor location missing', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);
      const result = resolveDirectionExit(
        'actor1',
        'east',
        mockEntityManager,
        mockLogger
      );
      expect(getExitByDirection).not.toHaveBeenCalled();
      expect(result).toEqual({ blocker: undefined, exitDetails: null });
    });
  });

  describe('buildDirectionContext', () => {
    it('uses exit data when available', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc1',
      });
      const exitObj = { blocker: 'door', some: 'data' };
      getExitByDirection.mockReturnValue(exitObj);
      const result = buildDirectionContext(
        'actor1',
        'north',
        mockEntityManager,
        mockLogger
      );
      expect(getExitByDirection).toHaveBeenCalledWith(
        'loc1',
        'north',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({
        type: 'direction',
        id: null,
        direction: 'north',
        components: null,
        blocker: 'door',
        exitDetails: exitObj,
      });
    });

    it('handles missing exit data', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc1',
      });
      getExitByDirection.mockReturnValue(null);
      const result = buildDirectionContext(
        'actor1',
        'south',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({
        type: 'direction',
        id: null,
        direction: 'south',
        components: null,
        blocker: undefined,
        exitDetails: null,
      });
    });

    it('returns undefined blocker when actor has no location', () => {
      mockEntityManager.getComponentData.mockReturnValue(null);
      const result = buildDirectionContext(
        'actor1',
        'east',
        mockEntityManager,
        mockLogger
      );
      expect(getExitByDirection).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: 'direction',
        id: null,
        direction: 'east',
        components: null,
        blocker: undefined,
        exitDetails: null,
      });
    });

    it('maps missing blocker to null', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        locationId: 'loc1',
      });
      const exitObj = { some: 'data' };
      getExitByDirection.mockReturnValue(exitObj);
      const result = buildDirectionContext(
        'actor1',
        'west',
        mockEntityManager,
        mockLogger
      );
      expect(result).toEqual({
        type: 'direction',
        id: null,
        direction: 'west',
        components: null,
        blocker: null,
        exitDetails: exitObj,
      });
    });
  });
});
