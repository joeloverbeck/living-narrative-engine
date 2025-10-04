import { describe, it, expect, beforeEach } from '@jest/globals';
import { getActorLocation } from '../../../src/utils/actorLocationUtils.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

/**
 * These integration tests exercise the actor location helper alongside the
 * simplified entity manager used across higher level integration suites. They
 * verify that the helper can traverse real entity data via the shared
 * EntityAccessService implementation, rather than relying on manual stubs.
 */
describe('actorLocationUtils integration', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
  });

  it('returns the resolved location entity when the actor references a known location', () => {
    const locationEntity = {
      id: 'location:main_hall',
      components: {
        'core:name': { displayName: 'Main Hall' },
      },
    };

    const actorEntity = {
      id: 'actor:hero',
      components: {
        [POSITION_COMPONENT_ID]: { locationId: 'location:main_hall' },
      },
    };

    entityManager.setEntities([locationEntity, actorEntity]);

    const location = getActorLocation(actorEntity.id, entityManager);
    const resolvedLocation =
      entityManager.getEntityInstance('location:main_hall');

    expect(location).toBe(resolvedLocation);
    expect(location?.components?.['core:name']).toEqual({
      displayName: 'Main Hall',
    });
  });

  it('falls back to the raw location identifier when no matching entity exists', () => {
    const actorEntity = {
      id: 'actor:traveller',
      components: {
        [POSITION_COMPONENT_ID]: { locationId: 'location:unknown_outpost' },
      },
    };

    entityManager.setEntities([actorEntity]);

    const location = getActorLocation(actorEntity.id, entityManager);
    expect(location).toBe('location:unknown_outpost');
  });

  it('returns null when the actor lacks a valid positioning component', () => {
    const actorWithoutPosition = {
      id: 'actor:drifter',
      components: {},
    };

    const actorWithBlankLocation = {
      id: 'actor:in_transit',
      components: {
        [POSITION_COMPONENT_ID]: { locationId: '   ' },
      },
    };

    entityManager.setEntities([actorWithoutPosition, actorWithBlankLocation]);

    expect(getActorLocation(actorWithoutPosition.id, entityManager)).toBeNull();
    expect(
      getActorLocation(actorWithBlankLocation.id, entityManager)
    ).toBeNull();
  });
});
