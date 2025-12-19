/**
 * @file Debug test to investigate scope resolution failure
 * @description Uses the real Scope DSL engine in test environment to reproduce
 * the exact runtime failure and capture detailed tracing.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ScopeEngine from '../../src/scopeDsl/engine.js';
import { SimpleEntityManager } from '../common/entities/index.js';
import EventBus from '../../src/events/eventBus.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

describe('Debug Scope Resolution - Performance Test', () => {
  let entityManager;
  let eventBus;
  let scopeEngine;
  let parkBenchId;
  let actorId;

  beforeEach(() => {
    // Create core services
    eventBus = new EventBus();
    entityManager = new SimpleEntityManager();

    // Create scope engine with enhanced tracing
    scopeEngine = new ScopeEngine({
      entityManager,
      eventBus,
      logger: {
        info: (msg) => console.log(`[SCOPE ENGINE] ${msg}`),
        warn: (msg) => console.warn(`[SCOPE ENGINE] ${msg}`),
        error: (msg) => console.error(`[SCOPE ENGINE] ${msg}`),
        debug: (msg) => console.log(`[SCOPE ENGINE DEBUG] ${msg}`),
      },
      enableTracing: true,
    });

    // Setup test entities
    parkBenchId = 'p_erotica:park_bench_instance';
    actorId = 'p_erotica:ane_arrieta_instance';

    console.log(`🪑 Creating park bench: ${parkBenchId}`);
    entityManager.addComponent(parkBenchId, 'sitting:allows_sitting', {
      spots: [null, null], // Two empty spots
    });
    entityManager.addComponent(parkBenchId, POSITION_COMPONENT_ID, {
      locationId: 'p_erotica:park_instance',
    });
    entityManager.addComponent(parkBenchId, NAME_COMPONENT_ID, {
      name: 'weathered park bench',
    });

    console.log(`👤 Creating test actor: ${actorId}`);
    entityManager.addComponent(actorId, ACTOR_COMPONENT_ID, {});
    entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      name: 'Ane Arrieta',
    });
    entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'p_erotica:park_instance',
    });
  });

  afterEach(() => {
    // Clean up
  });

  it('should demonstrate entity creation and component access patterns', async () => {
    console.log('\n🔍 === ENTITY CREATION DEBUG TEST ===\n');

    // Debug: Check what entities have sitting:allows_sitting component
    console.log(
      '🔍 Checking entities with sitting:allows_sitting component...'
    );
    const furnitureEntities = entityManager.getEntitiesWithComponent(
      'sitting:allows_sitting'
    );
    console.log(
      `Found ${furnitureEntities.length} entities with sitting:allows_sitting:`
    );

    for (const entity of furnitureEntities) {
      const positionData = entityManager.getComponentData(
        entity.id,
        POSITION_COMPONENT_ID
      );
      const allowsSittingData = entityManager.getComponentData(
        entity.id,
        'sitting:allows_sitting'
      );
      console.log(`  - ${entity.id}:`);
      console.log(
        `    Position: ${positionData ? positionData.locationId : 'N/A'}`
      );
      console.log(
        `    Sitting spots: ${allowsSittingData ? JSON.stringify(allowsSittingData.spots) : 'N/A'}`
      );
      console.log(
        `    All components: [${entityManager.getAllComponentTypesForEntity(entity.id).join(', ')}]`
      );
    }
    console.log();

    // Debug: Check actor
    console.log('👤 Checking actor components...');
    const actorComponents =
      entityManager.getAllComponentTypesForEntity(actorId);
    console.log(
      `Actor ${actorId} has components: [${actorComponents.join(', ')}]`
    );
    for (const componentId of actorComponents) {
      const componentData = entityManager.getComponentData(
        actorId,
        componentId
      );
      console.log(`  - ${componentId}: ${JSON.stringify(componentData)}`);
    }
    console.log();

    // Test the filtering logic manually (like the mock scope resolver)
    console.log('🎯 Testing filtering logic manually...');
    const actorLocation = entityManager.getComponentData(
      actorId,
      POSITION_COMPONENT_ID
    )?.locationId;
    console.log(`Actor location: ${actorLocation}`);

    const filteredFurniture = furnitureEntities.filter((entity) => {
      const furnitureLocation = entityManager.getComponentData(
        entity.id,
        POSITION_COMPONENT_ID
      )?.locationId;
      const allowsSitting = entityManager.getComponentData(
        entity.id,
        'sitting:allows_sitting'
      );

      console.log(`  Checking ${entity.id}:`);
      console.log(`    Furniture location: ${furnitureLocation}`);
      console.log(`    Actor location: ${actorLocation}`);
      console.log(`    Location match: ${furnitureLocation === actorLocation}`);
      console.log(`    Allows sitting: ${JSON.stringify(allowsSitting)}`);

      if (furnitureLocation !== actorLocation) {
        console.log(`    ❌ Filtered out: different location`);
        return false;
      }

      if (!allowsSitting || !Array.isArray(allowsSitting.spots)) {
        console.log(`    ❌ Filtered out: no valid spots`);
        return false;
      }

      const hasAvailableSpots = allowsSitting.spots.some(
        (spot) => spot === null
      );
      console.log(`    Available spots: ${hasAvailableSpots}`);

      if (!hasAvailableSpots) {
        console.log(`    ❌ Filtered out: no available spots`);
        return false;
      }

      console.log(`    ✅ Passed all filters`);
      return true;
    });

    console.log(`\nFiltered furniture count: ${filteredFurniture.length}`);
    if (filteredFurniture.length > 0) {
      console.log(
        `Filtered furniture IDs: [${filteredFurniture.map((e) => e.id).join(', ')}]`
      );
    }

    // This test should demonstrate the expected filtering behavior
    expect(filteredFurniture).toHaveLength(1);
    expect(filteredFurniture[0].id).toBe(parkBenchId);

    console.log(
      '\n✅ Entity creation and filtering test completed successfully\n'
    );
  });

  it('should demonstrate component state tracing differences', async () => {
    console.log('\n🔬 === COMPONENT STATE TRACING ===\n');

    // This test demonstrates how entity states are built and accessed
    // to identify potential differences between test and runtime environments

    console.log('🔍 Tracing park bench entity state:');
    const benchEntity = entityManager.getEntityInstance(parkBenchId);
    console.log(`  Entity instance: ${benchEntity ? 'Found' : 'Not found'}`);

    if (benchEntity) {
      console.log(
        `  Direct access to components:`,
        Object.keys(benchEntity.components)
      );
      console.log(`  Component type IDs:`, benchEntity.componentTypeIds);
      console.log(
        `  getAllComponents():`,
        Object.keys(benchEntity.getAllComponents())
      );

      // Check each component individually
      const allComponentTypes =
        entityManager.getAllComponentTypesForEntity(parkBenchId);
      for (const componentType of allComponentTypes) {
        const dataViaManager = entityManager.getComponentData(
          parkBenchId,
          componentType
        );
        const dataViaEntity = benchEntity.getComponentData(componentType);
        const hasViaManager = entityManager.hasComponent(
          parkBenchId,
          componentType
        );
        const hasViaEntity = benchEntity.hasComponent(componentType);

        console.log(`  Component ${componentType}:`);
        console.log(`    Via manager: ${JSON.stringify(dataViaManager)}`);
        console.log(`    Via entity: ${JSON.stringify(dataViaEntity)}`);
        console.log(`    Has via manager: ${hasViaManager}`);
        console.log(`    Has via entity: ${hasViaEntity}`);
        console.log(
          `    Data match: ${JSON.stringify(dataViaManager) === JSON.stringify(dataViaEntity)}`
        );
      }
    }

    console.log('\n🔍 Tracing actor entity state:');
    const actorEntity = entityManager.getEntityInstance(actorId);
    console.log(`  Entity instance: ${actorEntity ? 'Found' : 'Not found'}`);

    if (actorEntity) {
      console.log(
        `  Direct access to components:`,
        Object.keys(actorEntity.components)
      );
      console.log(`  Component type IDs:`, actorEntity.componentTypeIds);

      // Check position component specifically
      const positionData = actorEntity.getComponentData(POSITION_COMPONENT_ID);
      console.log(`  Position component: ${JSON.stringify(positionData)}`);
    }

    // This should pass if our entity setup is correct
    expect(benchEntity).toBeDefined();
    expect(actorEntity).toBeDefined();
    expect(benchEntity.hasComponent('sitting:allows_sitting')).toBe(true);
    expect(actorEntity.hasComponent(POSITION_COMPONENT_ID)).toBe(true);

    console.log('\n✅ Component state tracing completed\n');
  });
});
