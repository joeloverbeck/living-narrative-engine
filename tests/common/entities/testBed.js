/**
 * @file Documentation of standardized entity creation helper options.
 * @typedef {object} CreateEntityOptions
 * @property {Record<string, object>} [overrides] Component overrides applied to the instance.
 * @property {string} [instanceId] Explicit instance ID to assign.
 * @property {boolean} [resetDispatch] If true, resets the event dispatcher mock after creation.
 *
 * The helper functions {@link EntityManagerTestBed#createEntity},
 * {@link EntityManagerTestBed#createBasicEntity},
 * {@link EntityManagerTestBed#createActorEntity} and
 * {@link EntityManagerTestBed#createEntityWithOverrides} all accept a
 * {@link CreateEntityOptions} object as their second argument.
 */
