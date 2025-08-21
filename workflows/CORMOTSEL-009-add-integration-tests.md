# CORMOTSEL-009: Add Integration Tests

## Priority: P2 (Medium)
## Estimated Effort: 1-1.5 hours
## Status: TODO

## Problem Statement
Integration tests are needed to verify the end-to-end flow of the Core Motivations Generator with the new dropdown implementation, ensuring all components work together correctly.

## Implementation Details

### Test File Location
Create: `tests/integration/coreMotivationsGenerator/coreMotivationsSelector.integration.test.js`

### Step 1: End-to-End Flow Tests
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import CoreMotivationsGeneratorController from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import CharacterBuilderService from '../../../src/characterBuilder/services/characterBuilderService.js';
import { 
  saveCharacterConcept, 
  saveThematicDirection,
  saveClichés,
  clearAllData 
} from '../../../src/characterBuilder/repositories/storageRepository.js';

describe('Core Motivations Selector - Integration Tests', () => {
  let dom;
  let controller;
  let characterBuilderService;
  
  beforeEach(async () => {
    // Setup DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <select id="direction-selector">
            <option value="">-- Choose a thematic direction --</option>
          </select>
          <button id="generate-btn" disabled>Generate Core Motivations</button>
          <div id="message-container"></div>
          <div id="selected-direction-display"></div>
          <div id="loading-indicator" style="display: none;"></div>
          <div id="results-container"></div>
        </body>
      </html>
    `);
    
    global.document = dom.window.document;
    global.window = dom.window;
    
    // Clear any existing data
    await clearAllData();
    
    // Initialize real service
    characterBuilderService = new CharacterBuilderService({
      logger: console,
      llmService: mockLLMService
    });
    
    // Initialize controller with real service
    controller = new CoreMotivationsGeneratorController({
      characterBuilderService,
      eventBus: mockEventBus,
      logger: console
    });
  });
  
  afterEach(async () => {
    await clearAllData();
    dom.window.close();
  });
  
  describe('Complete User Flow', () => {
    it('should load directions from multiple concepts with clichés', async () => {
      // Setup test data
      const concept1 = await saveCharacterConcept({
        id: 'concept-1',
        title: 'Adventure Hero',
        description: 'A brave adventurer'
      });
      
      const concept2 = await saveCharacterConcept({
        id: 'concept-2',
        title: 'Dark Villain',
        description: 'An evil mastermind'
      });
      
      const direction1 = await saveThematicDirection({
        id: 'dir-1',
        conceptId: 'concept-1',
        title: 'The Reluctant Hero',
        description: 'Forced into adventure'
      });
      
      const direction2 = await saveThematicDirection({
        id: 'dir-2',
        conceptId: 'concept-2',
        title: 'Power at Any Cost',
        description: 'Seeking ultimate power'
      });
      
      const direction3 = await saveThematicDirection({
        id: 'dir-3',
        conceptId: 'concept-1',
        title: 'Seeking Glory',
        description: 'Fame and fortune'
      });
      
      // Add clichés only to some directions
      await saveClichés('dir-1', [
        { text: 'The call to adventure', category: 'plot' },
        { text: 'Mentor figure appears', category: 'character' }
      ]);
      
      await saveClichés('dir-2', [
        { text: 'Corruption by power', category: 'theme' },
        { text: 'Betrayal of allies', category: 'plot' }
      ]);
      
      // direction 3 has no clichés - should be filtered out
      
      // Initialize controller
      await controller.initialize();
      
      // Verify dropdown population
      const selector = document.getElementById('direction-selector');
      const optgroups = selector.querySelectorAll('optgroup');
      
      expect(optgroups.length).toBe(2); // Two concepts
      
      // Check first concept group
      const adventureGroup = Array.from(optgroups).find(
        og => og.label === 'Adventure Hero'
      );
      expect(adventureGroup).toBeTruthy();
      
      const adventureOptions = adventureGroup.querySelectorAll('option');
      expect(adventureOptions.length).toBe(1); // Only dir-1 has clichés
      expect(adventureOptions[0].textContent).toBe('The Reluctant Hero');
      
      // Check second concept group
      const villainGroup = Array.from(optgroups).find(
        og => og.label === 'Dark Villain'
      );
      expect(villainGroup).toBeTruthy();
      
      const villainOptions = villainGroup.querySelectorAll('option');
      expect(villainOptions.length).toBe(1);
      expect(villainOptions[0].textContent).toBe('Power at Any Cost');
    });
    
    it('should handle direction selection and enable generation', async () => {
      // Setup minimal test data
      await saveCharacterConcept({
        id: 'test-concept',
        title: 'Test Concept'
      });
      
      await saveThematicDirection({
        id: 'test-dir',
        conceptId: 'test-concept',
        title: 'Test Direction'
      });
      
      await saveClichés('test-dir', [
        { text: 'Test cliché' }
      ]);
      
      await controller.initialize();
      
      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      
      // Initially disabled
      expect(generateBtn.disabled).toBe(true);
      
      // Select a direction
      selector.value = 'test-dir';
      selector.dispatchEvent(new Event('change'));
      
      // Should enable generate button
      expect(generateBtn.disabled).toBe(false);
      expect(controller.selectedDirectionId).toBe('test-dir');
      
      // Clear selection
      selector.value = '';
      selector.dispatchEvent(new Event('change'));
      
      // Should disable generate button
      expect(generateBtn.disabled).toBe(true);
      expect(controller.selectedDirectionId).toBeNull();
    });
  });
  
  describe('Cross-Concept Verification', () => {
    it('should correctly filter and organize complex data structures', async () => {
      // Create a more complex scenario
      const concepts = [];
      const directions = [];
      
      // Create 3 concepts
      for (let i = 1; i <= 3; i++) {
        concepts.push(await saveCharacterConcept({
          id: `concept-${i}`,
          title: `Concept ${String.fromCharCode(67 - i + 1)}` // C, B, A for reverse alpha
        }));
      }
      
      // Create multiple directions per concept
      for (let c = 1; c <= 3; c++) {
        for (let d = 1; d <= 3; d++) {
          const dirId = `dir-${c}-${d}`;
          directions.push(await saveThematicDirection({
            id: dirId,
            conceptId: `concept-${c}`,
            title: `Direction ${c}-${String.fromCharCode(67 - d + 1)}` // C, B, A
          }));
          
          // Only add clichés to some directions
          if (d !== 2) { // Skip middle direction in each concept
            await saveClichés(dirId, [
              { text: `Cliché for ${dirId}` }
            ]);
          }
        }
      }
      
      await controller.initialize();
      
      const selector = document.getElementById('direction-selector');
      const optgroups = selector.querySelectorAll('optgroup');
      
      // Should have 3 concepts
      expect(optgroups.length).toBe(3);
      
      // Check alphabetical ordering of concepts
      expect(optgroups[0].label).toBe('Concept A');
      expect(optgroups[1].label).toBe('Concept B');
      expect(optgroups[2].label).toBe('Concept C');
      
      // Each concept should have 2 directions (middle one filtered out)
      optgroups.forEach(og => {
        const options = og.querySelectorAll('option');
        expect(options.length).toBe(2);
        
        // Check alphabetical ordering within group
        const titles = Array.from(options).map(o => o.textContent);
        const sorted = [...titles].sort();
        expect(titles).toEqual(sorted);
      });
    });
  });
  
  describe('Empty State Handling', () => {
    it('should show appropriate message when no directions exist', async () => {
      // No data created
      await controller.initialize();
      
      const selector = document.getElementById('direction-selector');
      const messageContainer = document.getElementById('message-container');
      
      expect(selector.disabled).toBe(true);
      expect(selector.innerHTML).toContain('No thematic directions available');
    });
    
    it('should show specific message when directions exist but have no clichés', async () => {
      // Create directions without clichés
      await saveCharacterConcept({
        id: 'concept-1',
        title: 'Test Concept'
      });
      
      await saveThematicDirection({
        id: 'dir-1',
        conceptId: 'concept-1',
        title: 'Direction without clichés'
      });
      
      await controller.initialize();
      
      const messageContainer = document.getElementById('message-container');
      expect(messageContainer.innerHTML).toContain('none have associated clichés');
      expect(messageContainer.innerHTML).toContain('Go to the Clichés Generator');
    });
  });
  
  describe('Data Persistence', () => {
    it('should maintain selection state across operations', async () => {
      // Setup data
      await saveCharacterConcept({
        id: 'persist-concept',
        title: 'Persistent Concept'
      });
      
      await saveThematicDirection({
        id: 'persist-dir',
        conceptId: 'persist-concept',
        title: 'Persistent Direction'
      });
      
      await saveClichés('persist-dir', [
        { text: 'Persistent cliché' }
      ]);
      
      await controller.initialize();
      
      // Make selection
      const selector = document.getElementById('direction-selector');
      selector.value = 'persist-dir';
      selector.dispatchEvent(new Event('change'));
      
      // Verify state
      expect(controller.selectedDirectionId).toBe('persist-dir');
      expect(controller.currentDirection.title).toBe('Persistent Direction');
      expect(controller.currentConcept.title).toBe('Persistent Concept');
      
      // Simulate some operation that might affect state
      await controller.refreshIfNeeded();
      
      // State should persist
      expect(controller.selectedDirectionId).toBe('persist-dir');
    });
  });
});
```

### Step 2: Performance Tests
```javascript
describe('Performance Tests', () => {
  it('should handle large numbers of directions efficiently', async () => {
    const startTime = Date.now();
    
    // Create many concepts and directions
    for (let c = 1; c <= 10; c++) {
      await saveCharacterConcept({
        id: `perf-concept-${c}`,
        title: `Performance Concept ${c}`
      });
      
      for (let d = 1; d <= 10; d++) {
        const dirId = `perf-dir-${c}-${d}`;
        await saveThematicDirection({
          id: dirId,
          conceptId: `perf-concept-${c}`,
          title: `Direction ${c}-${d}`
        });
        
        // Add clichés to 80% of directions
        if (Math.random() > 0.2) {
          await saveClichés(dirId, [
            { text: `Cliché for ${dirId}` }
          ]);
        }
      }
    }
    
    // Initialize and measure time
    await controller.initialize();
    const loadTime = Date.now() - startTime;
    
    // Should complete in reasonable time
    expect(loadTime).toBeLessThan(2000); // 2 seconds max
    
    // Verify all data loaded correctly
    const selector = document.getElementById('direction-selector');
    const options = selector.querySelectorAll('option[value]');
    
    // Should have filtered to ~80 directions
    expect(options.length).toBeGreaterThan(70);
    expect(options.length).toBeLessThan(90);
  });
});
```

### Step 3: Error Recovery Tests
```javascript
describe('Error Recovery', () => {
  it('should handle missing concepts gracefully', async () => {
    // Create orphaned direction (concept doesn't exist)
    localStorage.setItem('thematic-directions', JSON.stringify([
      {
        id: 'orphan-dir',
        conceptId: 'non-existent-concept',
        title: 'Orphaned Direction'
      }
    ]));
    
    localStorage.setItem('cliches-orphan-dir', JSON.stringify([
      { text: 'Some cliché' }
    ]));
    
    await controller.initialize();
    
    // Should still load but with fallback concept title
    const selector = document.getElementById('direction-selector');
    const optgroups = selector.querySelectorAll('optgroup');
    
    expect(optgroups.length).toBeGreaterThan(0);
    
    const orphanGroup = Array.from(optgroups).find(
      og => og.label.includes('Unknown Concept')
    );
    expect(orphanGroup).toBeTruthy();
  });
  
  it('should recover from service failures', async () => {
    // Mock service to fail once then succeed
    let callCount = 0;
    jest.spyOn(characterBuilderService, 'getAllThematicDirectionsWithConcepts')
      .mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Service temporarily unavailable');
        }
        return Promise.resolve([]);
      });
    
    // First attempt should fail gracefully
    await controller.initialize();
    
    // Should show error state
    const messageContainer = document.getElementById('message-container');
    expect(messageContainer.innerHTML).toContain('Failed to load');
    
    // Retry should succeed
    await controller.initialize();
    
    // Should now show empty state (no data)
    expect(messageContainer.innerHTML).not.toContain('Failed');
  });
});
```

## Acceptance Criteria
- [ ] End-to-end flow from page load to selection works
- [ ] Multiple concepts with directions are handled correctly
- [ ] Filtering for clichés works across all concepts
- [ ] Empty states are shown appropriately
- [ ] Performance is acceptable with many directions
- [ ] Error recovery mechanisms work
- [ ] Data persistence is maintained
- [ ] All integration tests pass

## Dependencies
- **CORMOTSEL-001** through **CORMOTSEL-008**: Implementation and unit tests must be complete

## Test Environment Setup
```javascript
// Test utilities needed
const mockLLMService = {
  generateCoreMotivations: jest.fn().mockResolvedValue({
    motivations: ['Test motivation'],
    contradictions: ['Test contradiction'],
    centralQuestion: 'Test question?'
  })
};

const mockEventBus = {
  dispatch: jest.fn(),
  subscribe: jest.fn()
};
```

## Running Tests
```bash
# Run integration tests
npm run test:integration

# Run specific test file
npm test tests/integration/coreMotivationsGenerator/coreMotivationsSelector.integration.test.js

# Run with coverage
npm run test:integration -- --coverage
```

## Manual Testing Checklist
After automated tests pass, perform manual testing:

- [ ] Create 3+ character concepts
- [ ] Add 5+ thematic directions across concepts
- [ ] Add clichés to some but not all directions
- [ ] Open Core Motivations Generator page
- [ ] Verify only directions with clichés appear
- [ ] Verify directions are grouped by concept
- [ ] Select different directions and verify state updates
- [ ] Generate core motivations for selected direction
- [ ] Test keyboard navigation (Tab, Arrow keys)
- [ ] Test with screen reader
- [ ] Check performance with 50+ directions
- [ ] Test error recovery (corrupt localStorage data)

## Related Files
- **Test Data Helpers**: `tests/common/helpers/testDataBuilder.js`
- **Storage Repository**: `src/characterBuilder/repositories/storageRepository.js`
- **Character Builder Service**: `src/characterBuilder/services/characterBuilderService.js`

## Notes
- Integration tests use real services where possible
- Mock only external dependencies (LLM service)
- Test realistic user scenarios
- Include edge cases and error conditions