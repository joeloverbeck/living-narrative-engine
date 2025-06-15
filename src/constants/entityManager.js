// src/constants/entityManager.js
// -------------------------------------------------
// Constants related to the IEntityManager interface

/**
 * List of EntityManager methods required by various
 * game logic components.
 *
 * @type {string[]}
 */
export const REQUIRED_ENTITY_MANAGER_METHODS = [
  'getEntityInstance',
  'getComponentData',
  'hasComponent',
];
