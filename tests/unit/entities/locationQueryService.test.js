import { describe, it, beforeEach, expect } from '@jest/globals';
import { LocationQueryService } from '../../../src/entities/locationQueryService.js';
import { createMockSpatialIndexManager } from '../../common/mockFactories/spatialIndexManager.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('LocationQueryService', () => {
  let spatialIndexManager;
  let logger;
  let service;

  beforeEach(() => {
    spatialIndexManager = createMockSpatialIndexManager();
    logger = createMockLogger();
    service = new LocationQueryService({ spatialIndexManager, logger });
  });

  it('logs initialization message', () => {
    expect(logger.debug).toHaveBeenCalledWith(
      'LocationQueryService initialized.'
    );
  });

  it('delegates queries to the spatial index manager for valid IDs', () => {
    const set = new Set(['a']);
    spatialIndexManager.getEntitiesInLocation.mockReturnValue(set);

    const result = service.getEntitiesInLocation('loc1');

    expect(spatialIndexManager.getEntitiesInLocation).toHaveBeenCalledWith(
      'loc1'
    );
    expect(result).toBe(set);
  });

  it('returns an empty set and warns when ID is invalid', () => {
    const result = service.getEntitiesInLocation('');

    expect(spatialIndexManager.getEntitiesInLocation).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "LocationQueryService.getEntitiesInLocation called with invalid locationId: ''"
    );
    expect(result).toEqual(new Set());
  });

  it('returns an empty set and logs error on spatial index failure', () => {
    spatialIndexManager.getEntitiesInLocation.mockImplementation(() => {
      throw new Error('db failure');
    });

    const result = service.getEntitiesInLocation('loc1');

    expect(logger.error).toHaveBeenCalledWith(
      "LocationQueryService.getEntitiesInLocation: Error querying spatial index for location 'loc1':",
      expect.any(Error)
    );
    expect(result).toEqual(new Set());
  });
});
