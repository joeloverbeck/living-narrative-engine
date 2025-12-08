import DamageTypeEffectsService from '../../../../src/anatomy/services/damageTypeEffectsService.js';
import StatusEffectRegistry from '../../../../src/anatomy/services/statusEffectRegistry.js';
import statusEffectRegistryData from '../../../../data/mods/anatomy/status-effects/status-effects.registry.json' assert { type: 'json' };

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * Creates a DamageTypeEffectsService wired to a StatusEffectRegistry backed by real registry data.
 *
 * @param {object} params
 * @param {object} params.testEnv - ModTestFixture test environment
 * @param {import('../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} params.safeEventDispatcher
 * @param {() => number} [params.rngProvider]
 * @param {(registryData: any) => void} [params.registryMutator] - Optional mutator to tweak registry defaults for assertions
 * @returns {{ damageTypeEffectsService: DamageTypeEffectsService, registrySnapshot: any, statusEffectRegistry: StatusEffectRegistry }}
 */
export function createDamageTypeEffectsService({
  testEnv,
  safeEventDispatcher,
  rngProvider,
  registryMutator,
}) {
  const registrySnapshot = clone(statusEffectRegistryData);

  if (!registrySnapshot?.effects?.length) {
    throw new Error(
      'createDamageTypeEffectsService: status-effects registry data is missing or empty.'
    );
  }

  if (typeof registryMutator === 'function') {
    registryMutator(registrySnapshot);
  }

  const statusEffectRegistry = new StatusEffectRegistry({
    dataRegistry: { getAll: () => [registrySnapshot] },
    logger: testEnv.logger,
  });

  const damageTypeEffectsService = new DamageTypeEffectsService({
    entityManager: testEnv.entityManager,
    logger: testEnv.logger,
    safeEventDispatcher,
    statusEffectRegistry,
    rngProvider,
  });

  return { damageTypeEffectsService, registrySnapshot, statusEffectRegistry };
}
