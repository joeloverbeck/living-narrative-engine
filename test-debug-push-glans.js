import { ModTestFixture } from './tests/common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from './tests/common/mods/scopeResolverHelpers.js';
import pushGlansIntoAssholeActionJson from './data/mods/sex-anal-penetration/actions/push_glans_into_asshole.action.json' assert { type: 'json' };

async function debugTest() {
  const testFixture = await ModTestFixture.forAction(
    'sex-anal-penetration',
    'sex-anal-penetration:push_glans_into_asshole'
  );
  testFixture.testEnv.actionIndex.buildIndex([pushGlansIntoAssholeActionJson]);
  
  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  
  // Re-register action after reset
  testFixture.testEnv.actionIndex.buildIndex([pushGlansIntoAssholeActionJson]);
  
  // Register scopes
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  
  // Manual scope override
  const originalResolveSync = testFixture.testEnv.unifiedScopeResolver.resolveSync.bind(testFixture.testEnv.unifiedScopeResolver);
  testFixture.testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-anal-penetration:actors_with_exposed_asshole_accessible_from_behind') {
      const actorId = context?.actor?.id;
      if (!actorId) return { success: true, value: new Set() };

      const actor = testFixture.testEnv.entityManager.getEntityInstance(actorId);
      const closenessPartners = actor?.components?.['positioning:closeness']?.partners;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = testFixture.testEnv.entityManager.getEntityInstance(partnerId);
        if (!partner) return false;

        const hasParts = partner.components?.['anatomy:body_part_types']?.types || [];
        if (!hasParts.includes('asshole')) return false;

        const socketCoverage = partner.components?.['clothing:socket_coverage']?.sockets || {};
        if (socketCoverage.asshole?.covered) return false;

        const facingAway = partner.components?.['positioning:facing_away']?.facing_away_from || [];
        const isLyingDown = partner.components?.['positioning:lying_down'];

        return facingAway.includes(actorId) || isLyingDown;
      });

      return { success: true, value: new Set(validPartners) };
    }
    return originalResolveSync(scopeName, context);
  };

  // Setup target
  testFixture.testEnv.entityManager.addComponent(
    scenario.target.id,
    'positioning:facing_away',
    { facing_away_from: [scenario.actor.id] }
  );
  testFixture.testEnv.entityManager.addComponent(
    scenario.target.id,
    'anatomy:body_part_types',
    { types: ['asshole'] }
  );
  testFixture.testEnv.entityManager.addComponent(
    scenario.target.id,
    'clothing:socket_coverage',
    { sockets: {} }
  );

  // Setup actor
  testFixture.testEnv.entityManager.addComponent(
    scenario.actor.id,
    'anatomy:body_part_types',
    { types: ['penis'] }
  );
  testFixture.testEnv.entityManager.addComponent(
    scenario.actor.id,
    'clothing:socket_coverage',
    { sockets: {} }
  );

  // Check actor components
  const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
  console.log('Actor components:', JSON.stringify(actorEntity.components, null, 2));

  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
  console.log('Available actions:', actions.map(a => a.id));
  
  testFixture.cleanup();
}

debugTest().catch(console.error);
