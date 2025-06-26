/**
 * @file Mixin for creating test beds that build a service from factories.
 */

import FactoryTestBed from './factoryTestBed.js';
import { createStoppableMixin } from './stoppableTestBedMixin.js';

/**
 * @description Generates a mixin that instantiates a service using mocks
 *   created by {@link FactoryTestBed}.
 * @param {Record<string, () => any>|((bedOverrides: any) => Record<string, () => any>)} factoryMap
 *   Map of mock factories or a function returning such a map based on overrides.
 * @param {(mocks: Record<string, any>, bedOverrides?: any) => any} buildFn -
 *   Function that constructs the service using generated mocks.
 * @param {string} propName - Property name used to store the created service.
 * @returns {(Base?: typeof FactoryTestBed) => typeof FactoryTestBed} Mixin
 *   function returning an extended class.
 */
export function createServiceFactoryMixin(factoryMap, buildFn, propName) {
  const StoppableMixin = createStoppableMixin(propName);
  return function ServiceFactoryMixin(Base = FactoryTestBed) {
    return class ServiceFactoryTestBed extends StoppableMixin(Base) {
      constructor(bedOverrides = {}) {
        const map =
          typeof factoryMap === 'function'
            ? factoryMap(bedOverrides)
            : factoryMap;
        super(map);
        this[propName] = buildFn(this.mocks, bedOverrides);
      }
    };
  };
}

export default createServiceFactoryMixin;
