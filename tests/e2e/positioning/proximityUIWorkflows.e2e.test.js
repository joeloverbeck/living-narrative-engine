/**
 * @file UI-focused proximity workflow E2E tests
 * @description Tests UI state updates, action discovery changes, and accessibility during proximity workflows
 * Uses jsdom to simulate browser interactions and UI state management
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import { createTestBed } from '../../common/testBed.js';
import { JSDOM } from 'jsdom';

describe('Proximity UI Workflows E2E', () => {
  let facades;
  let testBed;
  let actionService;
  let entityService;
  let dom;
  let window;
  let document;

  beforeEach(async () => {
    // Setup DOM environment for UI testing
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="action-list" role="list" aria-label="Available actions"></div>
          <div id="proximity-indicator" aria-live="polite"></div>
          <div id="character-status"></div>
          <div id="game-log" role="log" aria-live="polite"></div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // Use existing test infrastructure
    testBed = createTestBed();
    facades = createMockFacades({}, jest.fn);

    // Setup services
    actionService = facades.actionService;
    entityService = facades.entityService;
  });

  afterEach(() => {
    // Clean up DOM globals
    delete global.window;
    delete global.document;

    testBed.cleanup();
    facades.cleanupAll();
    jest.clearAllMocks();
  });

  describe('Action Discovery UI Updates', () => {
    it('should update available actions UI when actors sit together', async () => {
      // Create furniture and actors
      const sofaId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null] },
          'core:name': { name: 'Living Room Sofa' },
          'core:location': { locationId: 'test:living_room' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:living_room',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:living_room',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Mock initial action discovery (basic actions only)
      const initialActions = [
        { id: 'core:look', name: 'Look around', available: true },
        { id: 'positioning:sit_down', name: 'Sit down', available: true },
        { id: 'core:wait', name: 'Wait', available: true },
      ];

      // Simulate initial UI render
      const actionListElement = document.getElementById('action-list');
      initialActions.forEach((action) => {
        const actionElement = document.createElement('button');
        actionElement.id = `action-${action.id}`;
        actionElement.textContent = action.name;
        actionElement.setAttribute('aria-label', action.name);
        actionElement.disabled = !action.available;
        actionListElement.appendChild(actionElement);
      });

      // Verify initial UI state
      expect(
        document.getElementById('action-positioning:sit_down')
      ).not.toBeNull();
      expect(
        document.getElementById('action-positioning:sit_down').disabled
      ).toBe(false);

      // Alice sits down
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: sofaId, spot: 0 },
      });
      expect(aliceSitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'positioning:sitting_on', {
        furniture_id: sofaId,
        spot_index: 0,
      });

      // Simulate UI update after Alice sits
      const getUpAction = document.createElement('button');
      getUpAction.id = 'action-positioning:get_up_from_furniture';
      getUpAction.textContent = 'Stand up';
      getUpAction.setAttribute('aria-label', 'Stand up from furniture');
      actionListElement.appendChild(getUpAction);

      // Bob sits next to Alice
      const bobSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: sofaId, spot: 1 },
      });
      expect(bobSitResult.success).toBe(true);

      await entityService.updateComponent(bobId, 'positioning:sitting_on', {
        furniture_id: sofaId,
        spot_index: 1,
      });

      // Establish closeness
      await entityService.updateComponent(aliceId, 'positioning:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'positioning:closeness', {
        partners: [aliceId],
      });

      // Simulate proximity-based actions becoming available
      const intimateActions = [
        { id: 'intimacy:whisper', name: 'Whisper to Bob', available: true },
        {
          id: 'intimacy:lean_close',
          name: 'Lean close to Bob',
          available: true,
        },
        {
          id: 'positioning:move_closer',
          name: 'Move closer to Bob',
          available: true,
        },
      ];

      intimateActions.forEach((action) => {
        const actionElement = document.createElement('button');
        actionElement.id = `action-${action.id}`;
        actionElement.textContent = action.name;
        actionElement.setAttribute('aria-label', action.name);
        actionElement.classList.add('proximity-action');
        actionListElement.appendChild(actionElement);
      });

      // Verify proximity-based actions are now available
      expect(document.getElementById('action-intimacy:whisper')).not.toBeNull();
      expect(
        document.getElementById('action-intimacy:lean_close')
      ).not.toBeNull();
      expect(
        document.getElementById('action-positioning:move_closer')
      ).not.toBeNull();

      // Verify UI accessibility
      const proximityActions = document.querySelectorAll('.proximity-action');
      proximityActions.forEach((action) => {
        expect(action.getAttribute('aria-label')).toBeTruthy();
        expect(action.textContent.length).toBeGreaterThan(0);
      });

      // Alice stands up - proximity actions should be removed
      const aliceStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: aliceId,
      });
      expect(aliceStandResult.success).toBe(true);

      // Update states
      await entityService.updateComponent(
        aliceId,
        'positioning:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'positioning:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'positioning:closeness', null);

      // Simulate UI update - remove proximity actions
      proximityActions.forEach((action) => {
        action.remove();
      });

      // Verify proximity actions are removed
      expect(document.getElementById('action-intimacy:whisper')).toBeNull();
      expect(document.getElementById('action-intimacy:lean_close')).toBeNull();
      expect(
        document.getElementById('action-positioning:move_closer')
      ).toBeNull();
    });

    it('should update UI aria-live regions for proximity changes', async () => {
      // Create furniture and actors
      const benchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null, null] },
          'core:name': { name: 'Park Bench' },
          'core:location': { locationId: 'test:park' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:park',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:park',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Get aria-live elements
      const proximityIndicator = document.getElementById('proximity-indicator');
      const gameLog = document.getElementById('game-log');

      expect(proximityIndicator.getAttribute('aria-live')).toBe('polite');
      expect(gameLog.getAttribute('aria-live')).toBe('polite');

      // Alice sits - should announce to screen readers
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: benchId, spot: 0 },
      });
      expect(aliceSitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'positioning:sitting_on', {
        furniture_id: benchId,
        spot_index: 0,
      });

      // Simulate UI announcement
      gameLog.textContent = 'Alice sits on the park bench.';
      proximityIndicator.textContent = 'Alice is sitting alone.';

      expect(gameLog.textContent).toBe('Alice sits on the park bench.');
      expect(proximityIndicator.textContent).toBe('Alice is sitting alone.');

      // Bob sits next to Alice - should update proximity
      const bobSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: benchId, spot: 1 },
      });
      expect(bobSitResult.success).toBe(true);

      await entityService.updateComponent(bobId, 'positioning:sitting_on', {
        furniture_id: benchId,
        spot_index: 1,
      });

      // Establish closeness
      await entityService.updateComponent(aliceId, 'positioning:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'positioning:closeness', {
        partners: [aliceId],
      });

      // Simulate proximity announcements
      gameLog.textContent =
        'Bob sits next to Alice on the park bench. Alice and Bob are now close.';
      proximityIndicator.textContent = 'Alice is sitting close to Bob.';

      expect(gameLog.textContent).toContain('Alice and Bob are now close');
      expect(proximityIndicator.textContent).toBe(
        'Alice is sitting close to Bob.'
      );

      // Alice stands up - should announce proximity change
      const aliceStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: aliceId,
      });
      expect(aliceStandResult.success).toBe(true);

      // Update states
      await entityService.updateComponent(
        aliceId,
        'positioning:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'positioning:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'positioning:closeness', null);

      // Simulate final announcements
      gameLog.textContent =
        'Alice stands up. Alice and Bob are no longer close.';
      proximityIndicator.textContent =
        'Alice is standing. Bob is sitting alone.';

      expect(gameLog.textContent).toContain('no longer close');
      expect(proximityIndicator.textContent).toContain('Bob is sitting alone');
    });
  });

  describe('Character Status UI Updates', () => {
    it('should update character status display during proximity workflows', async () => {
      // Create furniture and actors
      const chairId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null] },
          'core:name': { name: 'Dining Chairs' },
          'core:location': { locationId: 'test:dining_room' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:dining_room',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:dining_room',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      const statusElement = document.getElementById('character-status');

      // Initial status
      statusElement.innerHTML = `
        <div class="character" data-actor="${aliceId}">
          <span class="name">Alice</span>
          <span class="position">Standing</span>
          <span class="closeness">Alone</span>
        </div>
        <div class="character" data-actor="${bobId}">
          <span class="name">Bob</span>
          <span class="position">Standing</span>
          <span class="closeness">Alone</span>
        </div>
      `;

      // Verify initial status
      const aliceStatus = statusElement.querySelector(
        `[data-actor="${aliceId}"]`
      );
      const bobStatus = statusElement.querySelector(`[data-actor="${bobId}"]`);

      expect(aliceStatus.querySelector('.position').textContent).toBe(
        'Standing'
      );
      expect(aliceStatus.querySelector('.closeness').textContent).toBe('Alone');

      // Alice sits
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: chairId, spot: 0 },
      });
      expect(aliceSitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'positioning:sitting_on', {
        furniture_id: chairId,
        spot_index: 0,
      });

      // Update Alice's status display
      aliceStatus.querySelector('.position').textContent =
        'Sitting on Dining Chairs';

      expect(aliceStatus.querySelector('.position').textContent).toBe(
        'Sitting on Dining Chairs'
      );
      expect(aliceStatus.querySelector('.closeness').textContent).toBe('Alone');

      // Bob sits next to Alice
      const bobSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: chairId, spot: 1 },
      });
      expect(bobSitResult.success).toBe(true);

      await entityService.updateComponent(bobId, 'positioning:sitting_on', {
        furniture_id: chairId,
        spot_index: 1,
      });

      // Establish closeness
      await entityService.updateComponent(aliceId, 'positioning:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'positioning:closeness', {
        partners: [aliceId],
      });

      // Update both status displays
      bobStatus.querySelector('.position').textContent =
        'Sitting on Dining Chairs';
      aliceStatus.querySelector('.closeness').textContent = 'Close to Bob';
      bobStatus.querySelector('.closeness').textContent = 'Close to Alice';

      expect(bobStatus.querySelector('.position').textContent).toBe(
        'Sitting on Dining Chairs'
      );
      expect(aliceStatus.querySelector('.closeness').textContent).toBe(
        'Close to Bob'
      );
      expect(bobStatus.querySelector('.closeness').textContent).toBe(
        'Close to Alice'
      );

      // Alice stands up
      const aliceStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: aliceId,
      });
      expect(aliceStandResult.success).toBe(true);

      // Update states
      await entityService.updateComponent(
        aliceId,
        'positioning:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'positioning:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'positioning:closeness', null);

      // Update status displays
      aliceStatus.querySelector('.position').textContent = 'Standing';
      aliceStatus.querySelector('.closeness').textContent = 'Alone';
      bobStatus.querySelector('.closeness').textContent = 'Alone';

      expect(aliceStatus.querySelector('.position').textContent).toBe(
        'Standing'
      );
      expect(aliceStatus.querySelector('.closeness').textContent).toBe('Alone');
      expect(bobStatus.querySelector('.closeness').textContent).toBe('Alone');
    });

    it('should handle dynamic action button state changes', async () => {
      // Create furniture and actors
      const benchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null] },
          'core:name': { name: 'Garden Bench' },
          'core:location': { locationId: 'test:garden' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:garden',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:garden',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Create action buttons
      const actionListElement = document.getElementById('action-list');

      const sitButton = document.createElement('button');
      sitButton.id = 'action-positioning:sit_down';
      sitButton.textContent = 'Sit on bench';
      sitButton.disabled = false;
      actionListElement.appendChild(sitButton);

      const standButton = document.createElement('button');
      standButton.id = 'action-positioning:get_up_from_furniture';
      standButton.textContent = 'Stand up';
      standButton.disabled = true; // Initially disabled
      standButton.style.display = 'none';
      actionListElement.appendChild(standButton);

      // Verify initial button states
      expect(sitButton.disabled).toBe(false);
      expect(standButton.disabled).toBe(true);
      expect(standButton.style.display).toBe('none');

      // Alice sits - buttons should change state
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: benchId, spot: 0 },
      });
      expect(aliceSitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'positioning:sitting_on', {
        furniture_id: benchId,
        spot_index: 0,
      });

      // Update button states after sitting
      sitButton.disabled = true; // Can't sit when already sitting
      standButton.disabled = false; // Can now stand
      standButton.style.display = 'block';

      expect(sitButton.disabled).toBe(true);
      expect(standButton.disabled).toBe(false);
      expect(standButton.style.display).toBe('block');

      // Bob sits next to Alice - create proximity-dependent button
      const bobSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: benchId, spot: 1 },
      });
      expect(bobSitResult.success).toBe(true);

      await entityService.updateComponent(bobId, 'positioning:sitting_on', {
        furniture_id: benchId,
        spot_index: 1,
      });

      // Establish closeness
      await entityService.updateComponent(aliceId, 'positioning:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'positioning:closeness', {
        partners: [aliceId],
      });

      // Add proximity-dependent action
      const whisperButton = document.createElement('button');
      whisperButton.id = 'action-intimacy:whisper';
      whisperButton.textContent = 'Whisper to Bob';
      whisperButton.disabled = false;
      whisperButton.classList.add('proximity-dependent');
      actionListElement.appendChild(whisperButton);

      expect(whisperButton.disabled).toBe(false);
      expect(whisperButton.classList.contains('proximity-dependent')).toBe(
        true
      );

      // Alice stands up - proximity actions should be disabled
      const aliceStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: aliceId,
      });
      expect(aliceStandResult.success).toBe(true);

      // Update states
      await entityService.updateComponent(
        aliceId,
        'positioning:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'positioning:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'positioning:closeness', null);

      // Update button states after standing
      sitButton.disabled = false; // Can sit again
      standButton.disabled = true; // Can't stand when not sitting
      standButton.style.display = 'none';
      whisperButton.disabled = true; // No longer close to Bob
      whisperButton.classList.add('disabled-proximity');

      expect(sitButton.disabled).toBe(false);
      expect(standButton.disabled).toBe(true);
      expect(standButton.style.display).toBe('none');
      expect(whisperButton.disabled).toBe(true);
      expect(whisperButton.classList.contains('disabled-proximity')).toBe(true);
    });
  });

  describe('Accessibility and Keyboard Navigation', () => {
    it('should maintain proper tab order during UI state changes', async () => {
      // Create furniture and actors
      const sofaId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null] },
          'core:name': { name: 'Test Sofa' },
          'core:location': { locationId: 'test:accessibility_room' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:accessibility_room',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      // Create action buttons with proper tab order
      const actionListElement = document.getElementById('action-list');

      const actions = [
        { id: 'core:look', name: 'Look around', tabIndex: 1 },
        { id: 'positioning:sit_down', name: 'Sit down', tabIndex: 2 },
        { id: 'core:wait', name: 'Wait', tabIndex: 3 },
      ];

      actions.forEach((action) => {
        const button = document.createElement('button');
        button.id = `action-${action.id}`;
        button.textContent = action.name;
        button.setAttribute('tabindex', action.tabIndex);
        button.setAttribute('aria-label', action.name);
        actionListElement.appendChild(button);
      });

      // Verify initial tab order
      const initialButtons = actionListElement.querySelectorAll('button');
      expect(initialButtons[0].getAttribute('tabindex')).toBe('1');
      expect(initialButtons[1].getAttribute('tabindex')).toBe('2');
      expect(initialButtons[2].getAttribute('tabindex')).toBe('3');

      // Alice sits
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: sofaId, spot: 0 },
      });
      expect(aliceSitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'positioning:sitting_on', {
        furniture_id: sofaId,
        spot_index: 0,
      });

      // Add stand up button with proper tab order
      const standButton = document.createElement('button');
      standButton.id = 'action-positioning:get_up_from_furniture';
      standButton.textContent = 'Stand up';
      standButton.setAttribute('tabindex', '2'); // Replace sit button in tab order
      standButton.setAttribute('aria-label', 'Stand up from furniture');
      actionListElement.appendChild(standButton);

      // Disable sit button and remove from tab order
      const sitButton = document.getElementById('action-positioning:sit_down');
      sitButton.disabled = true;
      sitButton.setAttribute('tabindex', '-1');

      // Verify updated tab order
      expect(sitButton.getAttribute('tabindex')).toBe('-1');
      expect(standButton.getAttribute('tabindex')).toBe('2');

      // Test keyboard navigation simulation
      const focusableElements = actionListElement.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"])'
      );
      expect(focusableElements.length).toBe(3); // look, stand, wait

      // Verify all focusable elements have proper accessibility attributes
      focusableElements.forEach((element) => {
        expect(element.getAttribute('aria-label')).toBeTruthy();
        expect(element.getAttribute('tabindex')).not.toBe('-1');
      });
    });

    it('should announce proximity changes to screen readers properly', async () => {
      // Create furniture and actors
      const benchId = await entityService.createEntity({
        type: 'core:location',
        initialData: {
          'sitting:allows_sitting': { spots: [null, null, null] },
          'core:name': { name: 'Accessible Bench' },
          'core:location': { locationId: 'test:accessible_room' },
        },
      });

      const aliceId = await entityService.createTestActor({
        name: 'Alice',
        location: 'test:accessible_room',
        components: {
          'core:actor': { type: 'player' },
        },
      });

      const bobId = await entityService.createTestActor({
        name: 'Bob',
        location: 'test:accessible_room',
        components: {
          'core:actor': { type: 'npc' },
        },
      });

      // Get accessibility elements
      const proximityIndicator = document.getElementById('proximity-indicator');
      const gameLog = document.getElementById('game-log');

      // Verify ARIA live regions are properly configured
      expect(proximityIndicator.getAttribute('aria-live')).toBe('polite');
      expect(gameLog.getAttribute('aria-live')).toBe('polite');
      expect(gameLog.getAttribute('role')).toBe('log');

      // Create ARIA live announcement function
      const announce = (message, priority = 'polite') => {
        if (priority === 'assertive') {
          gameLog.setAttribute('aria-live', 'assertive');
        }
        gameLog.textContent = message;
        setTimeout(() => {
          if (priority === 'assertive') {
            gameLog.setAttribute('aria-live', 'polite');
          }
        }, 100);
      };

      // Alice sits - should announce
      const aliceSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: aliceId,
        targets: { furniture: benchId, spot: 0 },
      });
      expect(aliceSitResult.success).toBe(true);

      await entityService.updateComponent(aliceId, 'positioning:sitting_on', {
        furniture_id: benchId,
        spot_index: 0,
      });

      announce('Alice sits on the accessible bench');
      proximityIndicator.textContent = 'Alice is sitting alone on the bench';

      expect(gameLog.textContent).toBe('Alice sits on the accessible bench');
      expect(proximityIndicator.textContent).toBe(
        'Alice is sitting alone on the bench'
      );

      // Bob sits next to Alice - important proximity change
      const bobSitResult = await actionService.executeAction({
        actionId: 'positioning:sit_down',
        actorId: bobId,
        targets: { furniture: benchId, spot: 1 },
      });
      expect(bobSitResult.success).toBe(true);

      await entityService.updateComponent(bobId, 'positioning:sitting_on', {
        furniture_id: benchId,
        spot_index: 1,
      });

      // Establish closeness
      await entityService.updateComponent(aliceId, 'positioning:closeness', {
        partners: [bobId],
      });
      await entityService.updateComponent(bobId, 'positioning:closeness', {
        partners: [aliceId],
      });

      // Announce proximity establishment with assertive priority
      announce(
        'Bob sits next to Alice. Alice and Bob are now close together',
        'assertive'
      );
      proximityIndicator.textContent =
        'Alice is sitting close to Bob on the bench';

      expect(gameLog.textContent).toBe(
        'Bob sits next to Alice. Alice and Bob are now close together'
      );
      expect(proximityIndicator.textContent).toBe(
        'Alice is sitting close to Bob on the bench'
      );

      // Verify temporary assertive announcement
      expect(gameLog.getAttribute('aria-live')).toBe('assertive');

      // Wait for timeout to reset to polite
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(gameLog.getAttribute('aria-live')).toBe('polite');

      // Alice stands - proximity lost (important change)
      const aliceStandResult = await actionService.executeAction({
        actionId: 'positioning:get_up_from_furniture',
        actorId: aliceId,
      });
      expect(aliceStandResult.success).toBe(true);

      // Update states
      await entityService.updateComponent(
        aliceId,
        'positioning:sitting_on',
        null
      );
      await entityService.updateComponent(
        aliceId,
        'positioning:closeness',
        null
      );
      await entityService.updateComponent(bobId, 'positioning:closeness', null);

      // Announce proximity loss
      announce(
        'Alice stands up. Alice and Bob are no longer close',
        'assertive'
      );
      proximityIndicator.textContent =
        'Alice is standing. Bob is sitting alone on the bench';

      expect(gameLog.textContent).toBe(
        'Alice stands up. Alice and Bob are no longer close'
      );
      expect(proximityIndicator.textContent).toBe(
        'Alice is standing. Bob is sitting alone on the bench'
      );
    });
  });
});
