// src/interfaces/IComponentCleaningService.js

/**
 * @interface IComponentCleaningService
 * @description Contract for services that clean component data prior to saving.
 */
class IComponentCleaningService {
  /**
   * Registers a cleaner function for the specified component.
   *
   * @param {string} componentId - Identifier of the component type.
   * @param {(data: any) => any} cleanerFn - Function that cleans component data.
   * @returns {void}
   */
  registerCleaner(componentId, cleanerFn) {
    throw new Error(
      'IComponentCleaningService.registerCleaner not implemented'
    );
  }

  /**
   * Returns a deep-cloned and cleaned version of the given component data.
   *
   * @param {string} componentId - Identifier of the component type.
   * @param {any} componentData - The raw component data.
   * @returns {any} Cleaned component data.
   */
  clean(componentId, componentData) {
    throw new Error('IComponentCleaningService.clean not implemented');
  }
}

export { IComponentCleaningService };
