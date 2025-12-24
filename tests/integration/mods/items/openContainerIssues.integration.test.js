/**
 * @file Integration tests for open_container action issues
 * @description Tests for template capitalization and action availability when container is open
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import openContainerRule from '../../../../data/mods/containers/rules/handle_open_container.rule.json' assert { type: 'json' };
import eventIsActionOpenContainer from '../../../../data/mods/containers/conditions/event-is-action-open-container.condition.json' assert { type: 'json' };

describe('Open Container Issues - Integration', () => {
  let testFixture;
  let actorId;
  let containerId;
  let locationId;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'containers',
      'containers:open_container',
      openContainerRule,
      eventIsActionOpenContainer
    );

    actorId = 'test:actor1';
    containerId = 'test:desk';
    locationId = 'test:location';

    // Setup entities using ModEntityBuilder
    const room = new ModEntityBuilder(locationId)
      .asRoom('Test Location')
      .build();

    const actor = new ModEntityBuilder(actorId)
      .withName('Test Actor')
      .atLocation(locationId)
      .asActor()
      .withComponent('items:inventory', {
        items: [],
        capacity: { maxWeight: 100, maxItems: 10 },
      })
      .build();

    const container = new ModEntityBuilder(containerId)
      .withName('wooden desk')
      .atLocation(locationId)
      .withComponent('containers-core:container', {
        contents: [],
        capacity: { maxWeight: 50, maxItems: 5 },
        isOpen: false, // Starts closed
      })
      .withComponent('items-core:openable', {})
      .build();

    testFixture.reset([room, actor, container]);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Issue 1: Template Capitalization', () => {
    it('should use lowercase "open" in template (matching other actions)', () => {
      // Check the action file template directly by importing it
      const actionDef = require('../../../../data/mods/containers/actions/open_container.action.json');

      expect(actionDef.template).toBeDefined();
      expect(actionDef.template).toBe('open {container}');

      // Should start with lowercase 'open', not uppercase 'Open'
      expect(actionDef.template.charAt(0)).toBe('o'); // lowercase 'o'
      expect(actionDef.template).toMatch(/^open /);
    });

    it('should match template pattern of other item actions (lowercase verb)', () => {
      // Load action definitions directly to verify consistency
      const openContainerAction = require('../../../../data/mods/containers/actions/open_container.action.json');
      const dropItemAction = require('../../../../data/mods/item-handling/actions/drop_item.action.json');
      const pickUpItemAction = require('../../../../data/mods/item-handling/actions/pick_up_item.action.json');

      // All templates should start with lowercase
      expect(openContainerAction.template.charAt(0)).toBe(
        openContainerAction.template.charAt(0).toLowerCase()
      );
      expect(dropItemAction.template.charAt(0)).toBe(
        dropItemAction.template.charAt(0).toLowerCase()
      );
      expect(pickUpItemAction.template.charAt(0)).toBe(
        pickUpItemAction.template.charAt(0).toLowerCase()
      );

      // open_container should follow the same pattern
      expect(openContainerAction.template).toMatch(/^[a-z]/);
    });
  });

  describe('Issue 2: Scope Filter for Open Containers', () => {
    it('scope should exclude containers that are already open', () => {
      // Read the scope file directly
      const fs = require('fs');
      const path = require('path');
      const scopePath = path.resolve(
        __dirname,
        '../../../../data/mods/containers-core/scopes/openable_containers_at_location.scope'
      );
      const scopeContent = fs.readFileSync(scopePath, 'utf8');

      // Verify the scope includes the isOpen filter
      expect(scopeContent).toContain('containers-core:container.isOpen');
      expect(scopeContent).toContain('false');

      // Verify the filter checks that isOpen equals false
      expect(scopeContent).toMatch(
        /{\s*"=="\s*:\s*\[.*containers-core:container\.isOpen.*false.*\]/
      );
    });

    it('scope definition should include location and component checks', () => {
      const fs = require('fs');
      const path = require('path');
      const scopePath = path.resolve(
        __dirname,
        '../../../../data/mods/containers-core/scopes/openable_containers_at_location.scope'
      );
      const scopeContent = fs.readFileSync(scopePath, 'utf8');

      // Should check for container component
      expect(scopeContent).toContain('containers-core:container');

      // Should check for matching location
      expect(scopeContent).toContain('core:position.locationId');
    });
  });

  describe('Scope Filter Validation', () => {
    it('should filter containers correctly in openable_containers_at_location scope', () => {
      // Create room
      const room = new ModEntityBuilder(locationId)
        .asRoom('Test Location')
        .build();

      // Create actor
      const actor = new ModEntityBuilder(actorId)
        .withName('Test Actor')
        .atLocation(locationId)
        .asActor()
        .withComponent('items:inventory', {
          items: [],
          capacity: { maxWeight: 100, maxItems: 10 },
        })
        .build();

      // Create closed container
      const closedContainer = new ModEntityBuilder(containerId)
        .withName('wooden desk')
        .atLocation(locationId)
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxWeight: 50, maxItems: 5 },
          isOpen: false, // Closed
        })
        .withComponent('items-core:openable', {})
        .build();

      // Create open container
      const openContainerId = 'test:open_drawer';
      const openDrawer = new ModEntityBuilder(openContainerId)
        .withName('drawer')
        .atLocation(locationId)
        .withComponent('containers-core:container', {
          contents: [],
          capacity: { maxWeight: 30, maxItems: 3 },
          isOpen: true, // Open
        })
        .withComponent('items-core:openable', {})
        .build();

      // Reset with all entities
      testFixture.reset([room, actor, closedContainer, openDrawer]);

      // Use the unifiedScopeResolver from testEnv if available
      const scopeResolver = testFixture.testEnv?.unifiedScopeResolver;
      expect(scopeResolver).toBeDefined();

      const result = scopeResolver.resolveSync(
        'containers-core:openable_containers_at_location',
        {
          actor: { id: actorId },
        }
      );

      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();

      // Convert Set to Array for easier assertions
      const resultArray = Array.from(result.value);

      // Should only include the closed container
      expect(resultArray).toContain(containerId);
      expect(resultArray).not.toContain(openContainerId);
      expect(resultArray.length).toBe(1);
    });
  });

  describe('Handler Behavior (Regression)', () => {
    it('should still prevent opening already-open containers at execution time', async () => {
      // Open the container first
      await testFixture.entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: containerId,
            componentTypeId: 'containers-core:container',
            componentData: {
              contents: [],
              capacity: { maxWeight: 50, maxItems: 5 },
              isOpen: true,
            },
          },
        ],
        true
      );

      // Attempt to open the already-open container
      await testFixture.executeAction(actorId, containerId);

      // Verify the container is still open (no change)
      const container =
        testFixture.entityManager.getEntityInstance(containerId);
      expect(container.components['containers-core:container'].isOpen).toBe(true);

      // Verify turn ended with failure
      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(false);

      // Verify no container_opened event was dispatched
      const openedEvent = testFixture.events.find(
        (e) => e.eventType === 'containers:container_opened'
      );
      expect(openedEvent).toBeUndefined();
    });
  });
});
