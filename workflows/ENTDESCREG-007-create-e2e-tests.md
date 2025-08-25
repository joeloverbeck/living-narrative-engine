# ENTDESCREG-007: Create End-to-End Tests

**Priority**: High  
**Dependencies**: ENTDESCREG-004 (Rule Integration)  
**Estimated Effort**: 1 day

## Overview

Create comprehensive end-to-end tests that validate the complete user experience of entity description updates from the player's perspective, ensuring the feature works correctly in real gameplay scenarios.

## Background

End-to-end tests verify that description changes are visible to users and other characters in the game, testing the complete user journey from action initiation to visible result in the game interface.

## Acceptance Criteria

- [ ] Create E2E test suite for user-visible description changes
- [ ] Test description visibility between multiple characters
- [ ] Verify UI updates reflect description changes
- [ ] Test complex multi-character scenarios
- [ ] Validate user story completion from start to finish
- [ ] Ensure consistent behavior across different contexts
- [ ] All E2E tests pass in browser environment

## Technical Requirements

### Files to Create

**`tests/e2e/actions/clothingActions.e2e.test.js`**

### Test Environment Setup

#### Browser Test Configuration

```javascript
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { createE2ETestBed } from '../../common/e2eTestBed.js';
import { startGameServer } from '../../common/gameServerSetup.js';

describe('Clothing Actions E2E', () => {
  let testBed;
  let gameServer;
  let browser;
  let page;

  beforeAll(async () => {
    gameServer = await startGameServer({
      mods: ['core', 'clothing'],
      port: 3001,
    });

    testBed = await createE2ETestBed({
      serverUrl: 'http://localhost:3001',
      headless: process.env.CI === 'true',
    });

    browser = testBed.browser;
  });

  afterAll(async () => {
    await testBed.cleanup();
    await gameServer.stop();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:3001');
  });

  afterEach(async () => {
    await page.close();
  });
});
```

### Required Test Categories

#### 1. Single Character Description Updates

```javascript
describe('Single Character Description Updates', () => {
  it('should update character appearance visible to player', async () => {
    // Setup: Create character with clothing in game
    await page.evaluate(() => {
      return gameEngine.createTestScenario({
        player: 'Alice',
        clothing: ['red_hat', 'blue_shirt'],
        location: 'bedroom',
      });
    });

    // Get initial character description
    const initialDescription = await page.evaluate(() => {
      return gameEngine.getEntityDescription('Alice');
    });
    expect(initialDescription).toContain('red hat');
    expect(initialDescription).toContain('blue shirt');

    // Action: Remove clothing through game interface
    await page.click('[data-action="remove-clothing"][data-item="red_hat"]');

    // Wait for action to complete and UI to update
    await page.waitForSelector('[data-status="action-complete"]');

    // Verify: Updated description visible in UI
    const updatedDescription = await page.evaluate(() => {
      return gameEngine.getEntityDescription('Alice');
    });
    expect(updatedDescription).not.toContain('red hat');
    expect(updatedDescription).toContain('blue shirt');

    // Verify: UI reflects the change
    const characterPanel = await page.$(
      '[data-character="Alice"] .description'
    );
    const displayedDescription = await characterPanel.textContent();
    expect(displayedDescription).not.toContain('red hat');
  });

  it('should handle multiple clothing removals correctly', async () => {
    // Test removing multiple items in sequence
    // Verify each removal updates the description
    // Confirm final state shows no removed items
  });
});
```

#### 2. Multi-Character Interaction Tests

```javascript
describe('Multi-Character Interactions', () => {
  it('should update appearance visible to other characters', async () => {
    // Setup: Two characters in same location
    await page.evaluate(() => {
      return gameEngine.createTestScenario({
        characters: [
          { id: 'Alice', clothing: ['hat', 'dress'], location: 'living_room' },
          { id: 'Bob', clothing: ['shirt', 'pants'], location: 'living_room' },
        ],
      });
    });

    // Switch to Bob's perspective
    await page.click('[data-character-switch="Bob"]');

    // Get Alice's description from Bob's view
    const initialView = await page.evaluate(() => {
      return gameEngine.lookAtCharacter('Alice');
    });
    expect(initialView).toContain('hat');
    expect(initialView).toContain('dress');

    // Switch to Alice and remove clothing
    await page.click('[data-character-switch="Alice"]');
    await page.click('[data-action="remove-clothing"][data-item="hat"]');
    await page.waitForSelector('[data-status="action-complete"]');

    // Switch back to Bob's perspective
    await page.click('[data-character-switch="Bob"]');

    // Verify: Bob sees Alice's updated appearance
    const updatedView = await page.evaluate(() => {
      return gameEngine.lookAtCharacter('Alice');
    });
    expect(updatedView).not.toContain('hat');
    expect(updatedView).toContain('dress');
  });

  it('should maintain consistency across character perspectives', async () => {
    // Test that all characters see the same updated description
    // Verify no desync between different viewpoints
  });
});
```

#### 3. NPC Behavior Tests

```javascript
describe('NPC Behavior with Description Changes', () => {
  it('should handle NPC clothing changes automatically', async () => {
    // Setup: NPC with automated clothing behavior
    await page.evaluate(() => {
      return gameEngine.createTestScenario({
        npcs: [
          {
            id: 'shopkeeper',
            clothing: ['apron', 'hat'],
            behaviors: ['remove_hat_indoors'],
            location: 'shop',
          },
        ],
        player: 'customer',
        location: 'shop',
      });
    });

    // Trigger NPC behavior that removes clothing
    await page.evaluate(() => {
      return gameEngine.triggerNPCBehavior('shopkeeper', 'remove_hat_indoors');
    });

    // Wait for NPC action to complete
    await page.waitForSelector('[data-npc-action="complete"]');

    // Verify: Player sees updated NPC description
    const npcDescription = await page.evaluate(() => {
      return gameEngine.lookAtCharacter('shopkeeper');
    });
    expect(npcDescription).not.toContain('hat');
    expect(npcDescription).toContain('apron');
  });

  it('should handle automated clothing changes during dialogue', async () => {
    // Test NPC clothing changes during conversation
    // Verify description updates are visible mid-dialogue
  });
});
```

#### 4. Complex Scenario Tests

```javascript
describe('Complex Game Scenarios', () => {
  it('should maintain consistency across multiple clothing operations', async () => {
    // Setup: Complex scenario with multiple characters
    await page.evaluate(() => {
      return gameEngine.createTestScenario({
        characters: [
          { id: 'Alice', clothing: ['hat', 'coat', 'boots'] },
          { id: 'Bob', clothing: ['shirt', 'pants'] },
          { id: 'Carol', clothing: ['dress', 'jewelry'] },
        ],
        location: 'party_room',
        scenario: 'clothing_party',
      });
    });

    // Execute multiple simultaneous clothing changes
    await Promise.all([
      page.evaluate(() =>
        gameEngine.executeAction('Alice', 'remove_clothing', 'hat')
      ),
      page.evaluate(() =>
        gameEngine.executeAction('Bob', 'remove_clothing', 'shirt')
      ),
      page.evaluate(() =>
        gameEngine.executeAction('Carol', 'remove_clothing', 'jewelry')
      ),
    ]);

    // Wait for all actions to complete
    await page.waitForFunction(() => {
      return (
        document.querySelectorAll('[data-status="action-complete"]').length >= 3
      );
    });

    // Verify: All descriptions updated correctly
    const descriptions = await page.evaluate(() => ({
      alice: gameEngine.getEntityDescription('Alice'),
      bob: gameEngine.getEntityDescription('Bob'),
      carol: gameEngine.getEntityDescription('Carol'),
    }));

    expect(descriptions.alice).not.toContain('hat');
    expect(descriptions.bob).not.toContain('shirt');
    expect(descriptions.carol).not.toContain('jewelry');
  });

  it('should handle error recovery gracefully in UI', async () => {
    // Test scenarios where description generation fails
    // Verify UI shows appropriate error messages
    // Confirm user can continue playing despite errors
  });
});
```

#### 5. Performance and Responsiveness Tests

```javascript
describe('Performance and Responsiveness', () => {
  it('should update descriptions within acceptable time limits', async () => {
    // Setup: Character with complex clothing configuration
    await page.evaluate(() => {
      return gameEngine.createTestScenario({
        character: 'fashionista',
        clothing: Array.from({ length: 20 }, (_, i) => `item_${i}`),
        location: 'dressing_room',
      });
    });

    // Measure time for clothing removal and description update
    const startTime = Date.now();

    await page.click('[data-action="remove-clothing"][data-item="item_0"]');
    await page.waitForSelector('[data-status="action-complete"]');

    const endTime = Date.now();
    const actionTime = endTime - startTime;

    // Verify: Action completes within 2 seconds
    expect(actionTime).toBeLessThan(2000);

    // Verify: Description actually updated
    const description = await page.evaluate(() => {
      return gameEngine.getEntityDescription('fashionista');
    });
    expect(description).not.toContain('item_0');
  });

  it('should handle high-frequency clothing changes smoothly', async () => {
    // Test rapid succession of clothing changes
    // Verify UI remains responsive
    // Confirm no race conditions in description updates
  });
});
```

## Test Data and Scenarios

### Game Scenarios

- Single character clothing changes
- Multi-character interactions
- NPC automated behaviors
- Complex party/group scenarios
- High-performance stress tests

### UI Elements to Test

- Character description panels
- Action buttons and interfaces
- Status indicators and feedback
- Error message displays
- Multi-character view switching

### User Interactions

- Click-based clothing removal
- Keyboard shortcuts (if applicable)
- Drag-and-drop interactions
- Context menu actions
- Batch operations

## Definition of Done

- [ ] Complete E2E test suite covering all user stories
- [ ] All tests pass in headless browser environment
- [ ] Tests work correctly in multiple browsers (Chrome, Firefox)
- [ ] Complex multi-character scenarios validated
- [ ] Performance requirements met in browser tests
- [ ] UI responsiveness verified under various conditions
- [ ] Error scenarios handled gracefully in user interface
- [ ] Test execution completes within 5 minutes

## Browser Compatibility

### Target Browsers

- Chrome/Chromium (primary)
- Firefox (secondary)
- Safari (if resources permit)
- Edge (if resources permit)

### Testing Infrastructure

- Headless mode for CI/CD pipeline
- Visual mode for local development
- Screenshot capture for failed tests
- Video recording for complex scenarios

## Related Specification Sections

- **Section 4.3**: End-to-End Tests requirements
- **Section 1.1**: Problem Statement - User visible behavior
- **Section 5.1**: Functional Requirements - User experience
- **Section 5.2**: Performance Requirements - Response times

## Next Steps

After completion, proceed to quality assurance phase:

- **ENTDESCREG-008** (Performance Validation)
- **ENTDESCREG-009** (Error Handling Validation)
- **ENTDESCREG-010** (Final Review)
