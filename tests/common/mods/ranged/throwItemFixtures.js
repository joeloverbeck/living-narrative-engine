/**
 * @file Test fixtures for throw item action tests
 * Provides reusable entity fixtures for testing ranged:throw_item_at_target action
 */

/**
 * Creates a throwing actor fixture with ranged skill
 * @param {Object} overrides - Override default values
 * @returns {Object} Actor entity fixture
 */
export const createThrowingActorFixture = (overrides = {}) => ({
  id: overrides.id || 'throwing-actor',
  components: {
    'core:actor': {},
    'core:name': { value: overrides.name || 'Thrower' },
    'core:position': { locationId: overrides.locationId || 'test-location' },
    'inventory:inventory': { items: overrides.inventoryItems || ['rock-001'] },
    'skills:ranged_skill': { value: overrides.rangedSkill ?? 15 },
    ...overrides.components,
  },
});

/**
 * Creates a target actor fixture with defense skill
 * @param {Object} overrides - Override default values
 * @returns {Object} Target entity fixture
 */
export const createTargetActorFixture = (overrides = {}) => ({
  id: overrides.id || 'target-actor',
  components: {
    'core:actor': {},
    'core:name': { value: overrides.name || 'Target' },
    'core:position': { locationId: overrides.locationId || 'test-location' },
    'skills:defense_skill': { value: overrides.defenseSkill ?? 5 },
    ...overrides.components,
  },
});

/**
 * Creates a portable item fixture (no damage capabilities - weight-based damage)
 * @param {Object} overrides - Override default values
 * @returns {Object} Portable item entity fixture
 */
export const createPortableItemFixture = (overrides = {}) => ({
  id: overrides.id || 'rock-001',
  components: {
    'core:name': { value: overrides.name || 'Small Rock' },
    'items-core:portable': { weight: overrides.weight ?? 1.0 },
    ...overrides.components,
  },
});

/**
 * Creates a weapon fixture with damage capabilities
 * @param {Object} overrides - Override default values
 * @returns {Object} Weapon entity fixture
 */
export const createWeaponFixture = (overrides = {}) => ({
  id: overrides.id || 'dagger-001',
  components: {
    'core:name': { value: overrides.name || 'Rusty Dagger' },
    'items-core:portable': { weight: overrides.weight ?? 0.5 },
    'damage-types:damage_capabilities': {
      damages: overrides.damages || [{ type: 'piercing', amount: 5 }],
    },
    ...overrides.components,
  },
});

/**
 * Creates a furniture fixture (non-actor entity for fumble tests)
 * @param {Object} overrides - Override default values
 * @returns {Object} Furniture entity fixture
 */
export const createFurnitureFixture = (overrides = {}) => ({
  id: overrides.id || 'furniture-001',
  components: {
    'core:name': { value: overrides.name || 'Wooden Table' },
    'core:position': { locationId: overrides.locationId || 'test-location' },
    // Note: NO core:actor component - this is important for fumble tests
    ...overrides.components,
  },
});

/**
 * Creates a location fixture
 * @param {Object} overrides - Override default values
 * @returns {Object} Location entity fixture
 */
export const createLocationFixture = (overrides = {}) => ({
  id: overrides.id || 'test-location',
  components: {
    'core:location': {},
    'core:name': { value: overrides.name || 'Test Room' },
    ...overrides.components,
  },
});

/**
 * Creates a wielding actor fixture (actor with item wielded)
 * @param {Object} overrides - Override default values
 * @returns {Object} Actor entity fixture with wielding component
 */
export const createWieldingActorFixture = (overrides = {}) => ({
  id: overrides.id || 'wielding-actor',
  components: {
    'core:actor': {},
    'core:name': { value: overrides.name || 'Wielder' },
    'core:position': { locationId: overrides.locationId || 'test-location' },
    'inventory:inventory': { items: overrides.inventoryItems || [] },
    'item-handling-states:wielding': {
      wielded_item_ids: overrides.wieldedItemIds || ['dagger-001'],
    },
    'skills:ranged_skill': { value: overrides.rangedSkill ?? 15 },
    ...overrides.components,
  },
});

/**
 * Creates an actor with a forbidden component (for testing action unavailability)
 * @param {string} forbiddenComponent - The forbidden component to add
 * @param {Object} overrides - Override default values
 * @returns {Object} Actor entity fixture with forbidden component
 */
export const createActorWithForbiddenComponent = (
  forbiddenComponent,
  overrides = {}
) => ({
  id: overrides.id || 'forbidden-actor',
  components: {
    'core:actor': {},
    'core:name': { value: overrides.name || 'Forbidden Actor' },
    'core:position': { locationId: overrides.locationId || 'test-location' },
    'inventory:inventory': { items: overrides.inventoryItems || ['rock-001'] },
    'skills:ranged_skill': { value: overrides.rangedSkill ?? 15 },
    [forbiddenComponent]: {},
    ...overrides.components,
  },
});

/**
 * Creates a standard test scenario with thrower, target, item, and location
 * @param {Object} options - Configuration options
 * @returns {Object} Complete test scenario with all entities
 */
export const createStandardThrowScenario = (options = {}) => {
  const locationId = options.locationId || 'test-location';

  return {
    location: createLocationFixture({ id: locationId, ...options.location }),
    actor: createThrowingActorFixture({
      locationId,
      ...options.actor,
    }),
    target: createTargetActorFixture({
      locationId,
      ...options.target,
    }),
    item: createPortableItemFixture(options.item),
  };
};

/**
 * Creates a fumble test scenario with furniture for collateral damage
 * @param {Object} options - Configuration options
 * @returns {Object} Test scenario with furniture entity
 */
export const createFumbleScenario = (options = {}) => {
  const locationId = options.locationId || 'test-location';

  return {
    location: createLocationFixture({ id: locationId, ...options.location }),
    actor: createThrowingActorFixture({
      locationId,
      ...options.actor,
    }),
    target: createTargetActorFixture({
      locationId,
      ...options.target,
    }),
    item: createPortableItemFixture(options.item),
    furniture: createFurnitureFixture({
      locationId,
      ...options.furniture,
    }),
  };
};
