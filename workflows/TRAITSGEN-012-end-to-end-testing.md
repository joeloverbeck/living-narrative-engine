# TRAITSGEN-012: End-to-End Testing and Validation

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Testing/Validation
- **Priority**: High
- **Estimated Effort**: 1.5 days
- **Dependencies**: TRAITSGEN-008 (Build Config), TRAITSGEN-011 (Quality Assurance)

## Description
Create and execute comprehensive end-to-end tests that validate the complete traits generator functionality from user interaction through final results. This includes browser automation, user workflow validation, and production readiness verification.

## Requirements

### E2E Test Framework Setup

#### Test Environment Configuration
```javascript
// E2E Test Configuration
const e2eConfig = {
  testFramework: 'playwright', // Or jest-puppeteer
  browsers: ['chromium', 'firefox', 'webkit'],
  viewports: [
    { width: 1920, height: 1080 }, // Desktop
    { width: 768, height: 1024 },  // Tablet
    { width: 375, height: 667 }    // Mobile
  ],
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  retries: 2
};
```

#### File Structure
```
tests/e2e/
├── traitsGenerator/
│   ├── traitsGeneratorE2E.test.js
│   ├── userWorkflows.test.js
│   ├── accessibility.test.js
│   ├── performance.test.js
│   └── crossBrowser.test.js
└── common/
    ├── pageObjects/
    │   └── TraitsGeneratorPage.js
    ├── fixtures/
    │   ├── testConcepts.json
    │   ├── testDirections.json
    │   └── mockLLMResponses.json
    └── helpers/
        ├── e2eTestHelpers.js
        └── accessibilityHelpers.js
```

### Core E2E Test Implementation

#### File: `tests/e2e/traitsGenerator/traitsGeneratorE2E.test.js`
```javascript
import { test, expect } from '@playwright/test';
import { TraitsGeneratorPage } from '../common/pageObjects/TraitsGeneratorPage.js';

test.describe('Traits Generator E2E Tests', () => {
  let page;
  let traitsGeneratorPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    traitsGeneratorPage = new TraitsGeneratorPage(page);
    await traitsGeneratorPage.goto();
  });

  test('Complete traits generation workflow', async () => {
    // Navigate to traits generator
    await traitsGeneratorPage.goto();
    await expect(page).toHaveTitle(/Traits Generator/);

    // Select thematic direction
    await traitsGeneratorPage.selectDirection('haunted-detective');
    await expect(traitsGeneratorPage.coreMotivationsList).toBeVisible();

    // Fill user inputs
    await traitsGeneratorPage.fillUserInputs({
      coreMotivation: 'Seeking justice for victims who cannot speak',
      internalContradiction: 'Uses supernatural means while being a skeptic',
      centralQuestion: 'Can the dead truly find peace through earthly justice?'
    });

    // Verify generate button is enabled
    await expect(traitsGeneratorPage.generateButton).toBeEnabled();

    // Mock LLM response for test
    await traitsGeneratorPage.mockLLMResponse();

    // Generate traits
    await traitsGeneratorPage.clickGenerate();

    // Wait for results
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });

    // Verify all trait categories are displayed
    const traitCategories = [
      'names-section', 'physical-section', 'personality-section',
      'strengths-weaknesses-section', 'likes-dislikes-section', 
      'fears-section', 'goals-section', 'notes-section',
      'profile-section', 'secrets-section'
    ];

    for (const category of traitCategories) {
      await expect(traitsGeneratorPage.getTraitSection(category)).toBeVisible();
    }

    // Verify export button is available
    await expect(traitsGeneratorPage.exportButton).toBeVisible();

    // Test export functionality
    const downloadPromise = page.waitForEvent('download');
    await traitsGeneratorPage.clickExport();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/^traits_.*\.txt$/);
  });

  test('Direction filtering works correctly', async () => {
    await traitsGeneratorPage.goto();

    // Get all direction options
    const directionOptions = await traitsGeneratorPage.getDirectionOptions();
    
    // Verify only eligible directions are shown (with both clichés and core motivations)
    expect(directionOptions.length).toBeGreaterThan(0);
    
    // Each option should have both requirements met
    for (const option of directionOptions) {
      const directionId = await option.getAttribute('value');
      if (directionId) {
        await traitsGeneratorPage.selectDirection(directionId);
        
        // Should show core motivations (indicating both requirements met)
        await expect(traitsGeneratorPage.coreMotivationsList).toBeVisible();
        
        // Clear selection for next iteration
        await traitsGeneratorPage.clearDirection();
      }
    }
  });

  test('User input validation works correctly', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.selectDirection('haunted-detective');

    // Try to generate with empty inputs
    await expect(traitsGeneratorPage.generateButton).toBeDisabled();

    // Fill only core motivation
    await traitsGeneratorPage.fillUserInput('coreMotivation', 'Test motivation');
    await expect(traitsGeneratorPage.generateButton).toBeDisabled();

    // Fill internal contradiction
    await traitsGeneratorPage.fillUserInput('internalContradiction', 'Test contradiction');
    await expect(traitsGeneratorPage.generateButton).toBeDisabled();

    // Fill central question - now should be enabled
    await traitsGeneratorPage.fillUserInput('centralQuestion', 'Test question');
    await expect(traitsGeneratorPage.generateButton).toBeEnabled();

    // Test clearing a field disables button
    await traitsGeneratorPage.clearUserInput('coreMotivation');
    await expect(traitsGeneratorPage.generateButton).toBeDisabled();
  });

  test('Error handling displays properly', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.selectDirection('haunted-detective');
    await traitsGeneratorPage.fillValidUserInputs();

    // Mock LLM service failure
    await traitsGeneratorPage.mockLLMFailure();

    // Attempt generation
    await traitsGeneratorPage.clickGenerate();

    // Verify error state is displayed
    await expect(traitsGeneratorPage.errorContainer).toBeVisible({ timeout: 5000 });
    await expect(traitsGeneratorPage.errorMessage).toContainText('Generation failed');
    await expect(traitsGeneratorPage.retryButton).toBeVisible();

    // Test retry functionality
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickRetry();

    // Should show results after retry
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
  });

  test('Loading states display correctly', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.selectDirection('haunted-detective');
    await traitsGeneratorPage.fillValidUserInputs();

    // Mock slow LLM response
    await traitsGeneratorPage.mockSlowLLMResponse();

    // Start generation
    await traitsGeneratorPage.clickGenerate();

    // Verify loading state
    await expect(traitsGeneratorPage.loadingContainer).toBeVisible();
    await expect(traitsGeneratorPage.loadingMessage).toContainText('Generating');
    await expect(traitsGeneratorPage.generateButton).toBeDisabled();

    // Wait for completion
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 15000 });
    await expect(traitsGeneratorPage.loadingContainer).toBeHidden();
  });
});
```

### User Workflow Tests

#### File: `tests/e2e/traitsGenerator/userWorkflows.test.js`
```javascript
import { test, expect } from '@playwright/test';
import { TraitsGeneratorPage } from '../common/pageObjects/TraitsGeneratorPage.js';

test.describe('User Workflow Tests', () => {
  let page;
  let traitsGeneratorPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    traitsGeneratorPage = new TraitsGeneratorPage(page);
  });

  test('First-time user workflow', async () => {
    // Simulate first-time user experience
    await traitsGeneratorPage.goto();

    // Verify page loads with proper empty states
    await expect(traitsGeneratorPage.directionSelector).toHaveValue('');
    await expect(traitsGeneratorPage.coreMotivationsEmpty).toBeVisible();
    await expect(traitsGeneratorPage.generateButton).toBeDisabled();

    // Follow natural workflow progression
    await traitsGeneratorPage.selectFirstAvailableDirection();
    await expect(traitsGeneratorPage.coreMotivationsList).toBeVisible();

    await traitsGeneratorPage.fillValidUserInputs();
    await expect(traitsGeneratorPage.generateButton).toBeEnabled();

    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickGenerate();

    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
    await expect(traitsGeneratorPage.exportButton).toBeVisible();
  });

  test('Power user workflow - multiple generations', async () => {
    await traitsGeneratorPage.goto();

    // First generation
    await traitsGeneratorPage.selectDirection('haunted-detective');
    await traitsGeneratorPage.fillValidUserInputs();
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickGenerate();
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });

    // Generate different traits for same direction
    await traitsGeneratorPage.clickGenerateMore();
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });

    // Switch to different direction
    await traitsGeneratorPage.selectDirection('time-loop-investigator');
    await traitsGeneratorPage.fillUserInputs({
      coreMotivation: 'Breaking cycles of tragedy',
      internalContradiction: 'Remembers what others forget but forgets what matters',
      centralQuestion: 'Can knowing the future change the past?'
    });
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickGenerate();
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
  });

  test('Export and save workflow', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.completeBasicGeneration();

    // Test text export
    const downloadPromise = page.waitForEvent('download');
    await traitsGeneratorPage.clickExport();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/^traits_.*\.txt$/);

    // Verify export content (if possible to read)
    const downloadPath = await download.path();
    if (downloadPath) {
      const fs = await import('fs');
      const content = fs.readFileSync(downloadPath, 'utf-8');
      
      expect(content).toContain('CHARACTER TRAITS');
      expect(content).toContain('NAMES');
      expect(content).toContain('PHYSICAL DESCRIPTION');
      expect(content).toContain('USER INPUTS');
    }
  });

  test('Error recovery workflow', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.selectDirection('haunted-detective');
    await traitsGeneratorPage.fillValidUserInputs();

    // Simulate network error
    await traitsGeneratorPage.mockNetworkError();
    await traitsGeneratorPage.clickGenerate();
    await expect(traitsGeneratorPage.errorContainer).toBeVisible();

    // User recovers by retrying
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickRetry();
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });

    // Simulate LLM timeout
    await traitsGeneratorPage.clickGenerateMore();
    await traitsGeneratorPage.mockLLMTimeout();
    await expect(traitsGeneratorPage.errorContainer).toBeVisible();

    // User clears and starts over
    await traitsGeneratorPage.clickErrorClear();
    await expect(traitsGeneratorPage.directionSelector).toHaveValue('');
  });
});
```

### Accessibility E2E Tests

#### File: `tests/e2e/traitsGenerator/accessibility.test.js`
```javascript
import { test, expect } from '@playwright/test';
import { TraitsGeneratorPage } from '../common/pageObjects/TraitsGeneratorPage.js';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility E2E Tests', () => {
  let page;
  let traitsGeneratorPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    traitsGeneratorPage = new TraitsGeneratorPage(page);
    await traitsGeneratorPage.goto();
    await injectAxe(page);
  });

  test('Page meets WCAG 2.1 AA standards', async () => {
    // Check initial page accessibility
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });

    // Check accessibility after direction selection
    await traitsGeneratorPage.selectFirstAvailableDirection();
    await checkA11y(page);

    // Check accessibility with form filled
    await traitsGeneratorPage.fillValidUserInputs();
    await checkA11y(page);

    // Check accessibility of results
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickGenerate();
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
    await checkA11y(page);

    // Check accessibility of error state
    await traitsGeneratorPage.mockLLMFailure();
    await traitsGeneratorPage.clickGenerateMore();
    await expect(traitsGeneratorPage.errorContainer).toBeVisible();
    await checkA11y(page);
  });

  test('Keyboard navigation works correctly', async () => {
    // Tab through all interactive elements
    await page.keyboard.press('Tab'); // Direction selector
    await expect(traitsGeneratorPage.directionSelector).toBeFocused();

    await traitsGeneratorPage.selectFirstAvailableDirection();

    await page.keyboard.press('Tab'); // Core motivation input
    await expect(traitsGeneratorPage.coreMotivationInput).toBeFocused();

    await page.keyboard.press('Tab'); // Internal contradiction input
    await expect(traitsGeneratorPage.internalContradictionInput).toBeFocused();

    await page.keyboard.press('Tab'); // Central question input
    await expect(traitsGeneratorPage.centralQuestionInput).toBeFocused();

    await page.keyboard.press('Tab'); // Generate button
    await expect(traitsGeneratorPage.generateButton).toBeFocused();

    await page.keyboard.press('Tab'); // Clear button
    await expect(traitsGeneratorPage.clearButton).toBeFocused();
  });

  test('Keyboard shortcuts work correctly', async () => {
    await traitsGeneratorPage.selectFirstAvailableDirection();
    await traitsGeneratorPage.fillValidUserInputs();

    // Test Ctrl+Enter for generate
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await page.keyboard.press('Control+Enter');
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });

    // Test Ctrl+E for export
    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+KeyE');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^traits_.*\.txt$/);

    // Test Ctrl+Shift+Del for clear
    await page.keyboard.press('Control+Shift+Delete');
    await expect(traitsGeneratorPage.directionSelector).toHaveValue('');
  });

  test('Screen reader announcements work', async () => {
    // Monitor aria-live regions for announcements
    const liveRegion = page.locator('[aria-live="polite"]');
    
    await traitsGeneratorPage.selectFirstAvailableDirection();
    // Should announce direction selection
    
    await traitsGeneratorPage.fillValidUserInputs();
    await traitsGeneratorPage.mockSuccessfulLLMResponse();
    await traitsGeneratorPage.clickGenerate();
    
    // Should announce generation start
    await expect(liveRegion).toContainText('Generating');
    
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
    // Should announce completion
    await expect(liveRegion).toContainText('Traits generated successfully');
  });
});
```

### Performance E2E Tests

#### File: `tests/e2e/traitsGenerator/performance.test.js`
```javascript
import { test, expect } from '@playwright/test';
import { TraitsGeneratorPage } from '../common/pageObjects/TraitsGeneratorPage.js';

test.describe('Performance E2E Tests', () => {
  let page;
  let traitsGeneratorPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    traitsGeneratorPage = new TraitsGeneratorPage(page);
  });

  test('Page loads within performance budget', async () => {
    const startTime = Date.now();
    
    await traitsGeneratorPage.goto();
    await expect(page.locator('h1')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 second budget
  });

  test('Generation completes within reasonable time', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.selectFirstAvailableDirection();
    await traitsGeneratorPage.fillValidUserInputs();
    await traitsGeneratorPage.mockSuccessfulLLMResponse();

    const startTime = Date.now();
    await traitsGeneratorPage.clickGenerate();
    await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
    const generationTime = Date.now() - startTime;

    expect(generationTime).toBeLessThan(8000); // 8 second budget for generation
  });

  test('UI remains responsive during generation', async () => {
    await traitsGeneratorPage.goto();
    await traitsGeneratorPage.selectFirstAvailableDirection();
    await traitsGeneratorPage.fillValidUserInputs();
    await traitsGeneratorPage.mockSlowLLMResponse();

    await traitsGeneratorPage.clickGenerate();

    // UI should remain interactive during generation
    await expect(traitsGeneratorPage.clearButton).toBeEnabled();
    
    // Direction selector should still work
    await traitsGeneratorPage.selectDirection('time-loop-investigator');
    await expect(traitsGeneratorPage.directionSelector).toHaveValue('time-loop-investigator');
  });

  test('Memory usage remains stable', async () => {
    await traitsGeneratorPage.goto();

    // Perform multiple generations to test for memory leaks
    for (let i = 0; i < 5; i++) {
      await traitsGeneratorPage.selectFirstAvailableDirection();
      await traitsGeneratorPage.fillValidUserInputs();
      await traitsGeneratorPage.mockSuccessfulLLMResponse();
      await traitsGeneratorPage.clickGenerate();
      await expect(traitsGeneratorPage.resultsContainer).toBeVisible({ timeout: 10000 });
      await traitsGeneratorPage.clearAll();
    }

    // Check for JavaScript heap size (if available)
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        };
      }
      return null;
    });

    if (memoryInfo) {
      // Heap usage should be reasonable
      const heapUsageRatio = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
      expect(heapUsageRatio).toBeLessThan(0.8); // Less than 80% heap usage
    }
  });
});
```

### Page Object Implementation

#### File: `tests/e2e/common/pageObjects/TraitsGeneratorPage.js`
```javascript
export class TraitsGeneratorPage {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.directionSelector = page.locator('#direction-selector');
    this.coreMotivationInput = page.locator('#core-motivation-input');
    this.internalContradictionInput = page.locator('#internal-contradiction-input');
    this.centralQuestionInput = page.locator('#central-question-input');
    this.generateButton = page.locator('#generate-button');
    this.clearButton = page.locator('#clear-button');
    this.exportButton = page.locator('#export-button');
    this.retryButton = page.locator('#retry-button');
    
    // Containers
    this.loadingContainer = page.locator('#loading-container');
    this.errorContainer = page.locator('#error-container');
    this.resultsContainer = page.locator('#results-container');
    this.coreMotivationsList = page.locator('#core-motivations-list');
    this.coreMotivationsEmpty = page.locator('#core-motivations-empty');
    
    // Messages
    this.loadingMessage = page.locator('#loading-message');
    this.errorMessage = page.locator('#error-message');
  }

  async goto() {
    await this.page.goto('/traits-generator.html');
  }

  async selectDirection(directionId) {
    await this.directionSelector.selectOption(directionId);
  }

  async selectFirstAvailableDirection() {
    const options = await this.directionSelector.locator('option:not([value=""])').all();
    if (options.length > 0) {
      const value = await options[0].getAttribute('value');
      await this.selectDirection(value);
    }
  }

  async fillUserInput(field, value) {
    const input = this.page.locator(`#${field.replace(/([A-Z])/g, '-$1').toLowerCase()}-input`);
    await input.fill(value);
  }

  async fillUserInputs({ coreMotivation, internalContradiction, centralQuestion }) {
    if (coreMotivation) await this.fillUserInput('coreMotivation', coreMotivation);
    if (internalContradiction) await this.fillUserInput('internalContradiction', internalContradiction);
    if (centralQuestion) await this.fillUserInput('centralQuestion', centralQuestion);
  }

  async fillValidUserInputs() {
    await this.fillUserInputs({
      coreMotivation: 'Test core motivation for character development',
      internalContradiction: 'Test internal contradiction that creates complexity',
      centralQuestion: 'Test central question that drives the narrative?'
    });
  }

  async clearUserInput(field) {
    const input = this.page.locator(`#${field.replace(/([A-Z])/g, '-$1').toLowerCase()}-input`);
    await input.clear();
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async clickExport() {
    await this.exportButton.click();
  }

  async clickRetry() {
    await this.retryButton.click();
  }

  async clickGenerateMore() {
    await this.page.locator('#generate-more-button').click();
  }

  async clickErrorClear() {
    await this.page.locator('#error-clear-button').click();
  }

  async clearAll() {
    await this.clearButton.click();
  }

  async clearDirection() {
    await this.directionSelector.selectOption('');
  }

  getTraitSection(sectionId) {
    return this.page.locator(`#${sectionId}`);
  }

  async getDirectionOptions() {
    return await this.directionSelector.locator('option:not([value=""])').all();
  }

  async completeBasicGeneration() {
    await this.selectFirstAvailableDirection();
    await this.fillValidUserInputs();
    await this.mockSuccessfulLLMResponse();
    await this.clickGenerate();
    await this.page.waitForSelector('#results-container:not([hidden])', { timeout: 10000 });
  }

  // Mock methods for testing
  async mockSuccessfulLLMResponse() {
    await this.page.route('**/llm-proxy-server/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          names: [
            { name: 'Aria', justification: 'Subverts typical naming' },
            { name: 'Kai', justification: 'Gender-neutral choice' },
            { name: 'Zara', justification: 'Avoids stereotypes' }
          ],
          physicalDescription: 'Tall figure with silver-streaked hair and shifting eyes that tell stories of survival.',
          personality: [
            { trait: 'Cautiously optimistic', explanation: 'Believes while expecting disappointment' },
            { trait: 'Intellectually curious', explanation: 'Driven to understand rather than judge' },
            { trait: 'Emotionally guarded', explanation: 'Protects through careful distance' }
          ],
          strengths: ['Analytical thinking', 'Pattern recognition'],
          weaknesses: ['Overthinking', 'Difficulty trusting'],
          likes: ['Ancient puzzles', 'Quiet mornings', 'Honest conversations'],
          dislikes: ['Crowds', 'Rushed decisions', 'Dishonesty'],
          fears: ['Being truly understood', 'Losing control'],
          goals: {
            shortTerm: ['Solve current case', 'Understand new abilities'],
            longTerm: 'Find balance between worlds'
          },
          notes: ['Keeps detailed dream journal', 'Collects vintage keys', 'Speaks to ravens'],
          profile: 'A detective who walks between the living and dead, using supernatural insights to solve cases while struggling with the personal cost of seeing beyond the veil.',
          secrets: ['Can communicate with spirits', 'Inherited abilities from grandmother']
        })
      });
    });
  }

  async mockLLMFailure() {
    await this.page.route('**/llm-proxy-server/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' })
      });
    });
  }

  async mockSlowLLMResponse() {
    await this.page.route('**/llm-proxy-server/**', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ /* valid response */ })
        });
      }, 3000);
    });
  }

  async mockLLMTimeout() {
    await this.page.route('**/llm-proxy-server/**', route => {
      // Never respond to simulate timeout
    });
  }

  async mockNetworkError() {
    await this.page.route('**/llm-proxy-server/**', route => {
      route.abort('failed');
    });
  }
}
```

## Cross-Browser Testing

### Browser Compatibility Matrix
Test across multiple browsers and versions:

```javascript
const browserMatrix = {
  desktop: {
    chrome: ['latest', 'latest-1'],
    firefox: ['latest', 'latest-1'], 
    safari: ['latest'],
    edge: ['latest']
  },
  mobile: {
    chrome: ['latest'],
    safari: ['latest'],
    samsung: ['latest']
  }
};
```

### Responsive Design Testing
Test across various screen sizes and orientations:

```javascript
const deviceMatrix = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'Tablet Landscape', width: 1024, height: 768 },
  { name: 'Mobile Portrait', width: 375, height: 667 },
  { name: 'Mobile Landscape', width: 667, height: 375 }
];
```

## Production Readiness Validation

### Environment Testing
Test in production-like environments:

- **Staging Environment**: Full production configuration
- **CDN Integration**: Assets served from CDN
- **HTTPS**: Secure connections required
- **Load Testing**: Multiple concurrent users
- **Network Conditions**: Various connection speeds

### Data Validation
Validate with production-like data:

- **Large Datasets**: Test with extensive concept/direction databases
- **Edge Cases**: Test with unusual or extreme data
- **Internationalization**: Test with non-English content
- **Special Characters**: Test with various character encodings

## Acceptance Criteria

### Functional E2E Requirements
- [ ] Complete user workflow functions correctly across all browsers
- [ ] Direction filtering works accurately with dual requirements
- [ ] User input validation prevents invalid submissions
- [ ] Generation workflow handles success and failure scenarios
- [ ] Export functionality creates proper text files
- [ ] Error recovery mechanisms work reliably

### Accessibility E2E Requirements
- [ ] Page meets WCAG 2.1 AA standards in all states
- [ ] Keyboard navigation works completely without mouse
- [ ] Screen reader announcements provide appropriate feedback
- [ ] High contrast mode renders properly
- [ ] Text scaling up to 200% maintains functionality

### Performance E2E Requirements
- [ ] Page loads within 3 second budget
- [ ] Generation completes within 8 second budget
- [ ] UI remains responsive during all operations
- [ ] Memory usage remains stable over multiple operations
- [ ] Bundle size meets web performance standards

### Cross-Browser Requirements
- [ ] Functionality identical across Chrome, Firefox, Safari, Edge
- [ ] Mobile browsers provide full functionality
- [ ] Responsive design works across all screen sizes
- [ ] Touch interactions work properly on mobile devices

### Production Readiness Requirements
- [ ] Works correctly in staging environment
- [ ] Handles production data volumes
- [ ] Secure HTTPS connections function properly
- [ ] CDN asset delivery works correctly
- [ ] Load testing passes with acceptable performance

## Files Modified
- **NEW**: `tests/e2e/traitsGenerator/traitsGeneratorE2E.test.js`
- **NEW**: `tests/e2e/traitsGenerator/userWorkflows.test.js`
- **NEW**: `tests/e2e/traitsGenerator/accessibility.test.js`
- **NEW**: `tests/e2e/traitsGenerator/performance.test.js`
- **NEW**: `tests/e2e/traitsGenerator/crossBrowser.test.js`
- **NEW**: `tests/e2e/common/pageObjects/TraitsGeneratorPage.js`
- **NEW**: E2E test configuration and helper files

## Dependencies For Next Tickets
This end-to-end testing completes the implementation and validation of the traits generator feature.

## Notes
- Use realistic test data that matches production usage patterns
- Focus on user-centric scenarios rather than technical implementation details
- Ensure tests are reliable and can run in CI/CD environment
- Consider test execution time and optimize for development workflow
- Document any browser-specific issues or workarounds needed