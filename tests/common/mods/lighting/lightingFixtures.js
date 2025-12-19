/**
 * @file Lighting mod test fixtures.
 * @description Helpers for building lighting entities for rule execution tests.
 */

import { ModEntityBuilder } from '../ModEntityBuilder.js';

const DEFAULT_CAPACITY = { maxWeight: 50, maxItems: 10 };

function buildLightSource(id, name, fuelType, options = {}) {
  const builder = new ModEntityBuilder(id)
    .withName(name)
    .withComponent('items:item', {})
    .withComponent('items:portable', {})
    .withComponent('core:weight', { weight: options.weight ?? 0.5 })
    .withComponent('lighting:is_light_source', { fuelType });

  if (options.isLit) {
    builder.withComponent('lighting:is_lit', {});
  }

  if (options.components) {
    builder.withComponents(options.components);
  }

  return builder.build();
}

export const createOilLamp = (id = 'lighting:oil_lamp', options = {}) =>
  buildLightSource(id, options.name || 'oil lamp', 'oil', options);

export const createLitOilLamp = (id = 'lighting:lit_oil_lamp', options = {}) =>
  buildLightSource(id, options.name || 'oil lamp', 'oil', {
    ...options,
    isLit: true,
  });

export const createCandle = (id = 'lighting:candle', options = {}) =>
  buildLightSource(id, options.name || 'candle', 'candle', options);

export const createElectricLight = (
  id = 'lighting:electric_light',
  options = {}
) => buildLightSource(id, options.name || 'electric light', 'electricity', options);

export const createActorWithLightSource = (
  actorId,
  lightSourceId,
  options = {}
) => {
  const builder = new ModEntityBuilder(actorId)
    .withName(options.name || 'Actor')
    .asActor()
    .atLocation(options.locationId || 'lighting_room')
    .withComponent('items:inventory', {
      items: [lightSourceId],
      capacity: options.capacity || DEFAULT_CAPACITY,
    });

  if (options.components) {
    builder.withComponents(options.components);
  }

  return builder.build();
};

export const createLocationWithLightSources = (
  locationId,
  sourceIds,
  options = {}
) =>
  new ModEntityBuilder(locationId)
    .asRoom(options.name || 'Lighting Room')
    .withComponent('locations:light_sources', {
      sources: Array.isArray(sourceIds) ? sourceIds : [],
    })
    .build();
