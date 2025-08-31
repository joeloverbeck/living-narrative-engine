/**
 * @file Debug script to investigate scope resolution failure
 * @description Uses the real Scope DSL engine to reproduce the runtime failure
 * and capture detailed tracing from the actual scope resolution process.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ScopeEngine from './src/scopeDsl/engine.js';
import EntityManager from './src/entities/entityManager.js';
import EventBus from './src/events/eventBus.js';
import { 
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID
} from './src/constants/componentIds.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function debugScopeResolution() {
  console.log('🔍 Starting scope resolution debug...\n');
  
  try {
    // Create core services (simplified approach)
    const eventBus = new EventBus();
    const entityManager = new EntityManager({ eventBus, logger: console });
    
    console.log('✅ Services initialized successfully\n');

    // Manually create park bench entity (simulating what mod loading would do)
    const parkBenchId = 'p_erotica:park_bench_instance';
    console.log(`🪑 Creating park bench: ${parkBenchId}`);
    
    // Add park bench components
    entityManager.addComponent(parkBenchId, 'positioning:allows_sitting', {
      spots: [null, null] // Two empty spots
    });
    entityManager.addComponent(parkBenchId, POSITION_COMPONENT_ID, {
      locationId: 'p_erotica:park_instance'
    });
    entityManager.addComponent(parkBenchId, NAME_COMPONENT_ID, {
      name: 'weathered park bench'
    });
    
    console.log(`✅ Park bench created in location: ${entityManager.getComponentData(parkBenchId, POSITION_COMPONENT_ID).locationId}\n`);

    // Create test actor (Ane Arrieta)
    const actorId = 'p_erotica:ane_arrieta_instance';
    console.log(`👤 Creating test actor: ${actorId}`);
    
    // Add actor components manually (mimicking the runtime state)
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      name: 'Ane Arrieta'
    });
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'p_erotica:park_instance'
    });
    
    console.log(`✅ Actor created with position: ${entityManager.getComponentData(actorId, POSITION_COMPONENT_ID).locationId}\n`);

    // Debug: Check what entities have positioning:allows_sitting component
    console.log('🔍 Checking entities with positioning:allows_sitting component...');
    const furnitureEntities = entityManager.getEntitiesWithComponent('positioning:allows_sitting');
    console.log(`Found ${furnitureEntities.length} entities with positioning:allows_sitting:`);
    
    for (const entity of furnitureEntities) {
      const positionData = entityManager.getComponentData(entity.id, POSITION_COMPONENT_ID);
      const allowsSittingData = entityManager.getComponentData(entity.id, 'positioning:allows_sitting');
      console.log(`  - ${entity.id}:`);
      console.log(`    Position: ${positionData ? positionData.locationId : 'N/A'}`);
      console.log(`    Sitting spots: ${allowsSittingData ? JSON.stringify(allowsSittingData.spots) : 'N/A'}`);
    }
    console.log();

    // Create scope engine with enhanced tracing
    const scopeEngine = new ScopeEngine({
      entityManager,
      eventBus,
      logger: {
        info: (msg) => console.log(`[SCOPE ENGINE] ${msg}`),
        warn: (msg) => console.warn(`[SCOPE ENGINE] ${msg}`),
        error: (msg) => console.error(`[SCOPE ENGINE] ${msg}`),
        debug: (msg) => console.log(`[SCOPE ENGINE DEBUG] ${msg}`)
      },
      enableTracing: true
    });

    // Manually define the scope (since we can't load it from files easily)
    const scopeDefinition = 'entities(positioning:allows_sitting)[][{"and": [{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]}, {"some": [{"var": "entity.components.positioning:allows_sitting.spots"}, {"==": [{"var": ""}, null]}]}]}]';
    
    console.log(`🎯 Testing scope resolution with definition:`);
    console.log(`   ${scopeDefinition}`);
    console.log(`   Actor: ${actorId}`);
    console.log(`   Actor location: ${entityManager.getComponentData(actorId, POSITION_COMPONENT_ID).locationId}`);
    console.log();

    // Enable verbose tracing
    console.log('📊 Starting scope resolution with enhanced tracing...\n');
    
    const context = {
      actor: {
        id: actorId,
        components: {}
      }
    };
    
    // Add actor components to context
    for (const componentId of entityManager.getEntityComponents(actorId)) {
      const componentData = entityManager.getComponentData(actorId, componentId);
      context.actor.components[componentId] = componentData;
    }

    console.log('🔍 Context for scope resolution:');
    console.log(JSON.stringify(context, null, 2));
    console.log();

    // Resolve the scope with the manual definition
    const result = await scopeEngine.resolveExpression(scopeDefinition, context);
    
    console.log('\n📊 Scope resolution result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Target count: ${Array.isArray(result.result) ? result.result.length : 0}`);
    
    if (result.success && Array.isArray(result.result)) {
      console.log(`  Targets found: [${result.result.join(', ')}]`);
      for (const targetId of result.result) {
        const positionData = entityManager.getComponentData(targetId, POSITION_COMPONENT_ID);
        const sittingData = entityManager.getComponentData(targetId, 'positioning:allows_sitting');
        console.log(`    - ${targetId}:`);
        console.log(`      Position: ${positionData ? positionData.locationId : 'N/A'}`);
        console.log(`      Spots: ${sittingData ? JSON.stringify(sittingData.spots) : 'N/A'}`);
      }
    } else {
      console.log('  No targets found or resolution failed');
      if (!result.success && result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    console.log('\n🎯 Debug completed');

  } catch (error) {
    console.error('❌ Debug script failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug script
debugScopeResolution().catch(console.error);