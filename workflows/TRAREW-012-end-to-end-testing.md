# TRAREW-012: End-to-End Testing with Browser Automation

## Priority: 🟡 MEDIUM

**Phase**: 3 - Testing & Validation  
**Story Points**: 3  
**Estimated Time**: 3-4 hours

## Problem Statement

The TraitsRewriter feature needs comprehensive end-to-end testing using real browser automation to validate the complete user experience from character input through trait generation to export functionality. E2E tests must verify UI interactions, workflow states, error handling, and accessibility compliance.

## Requirements

1. Test complete user workflows in real browser environment
2. Validate UI state transitions and user feedback
3. Test character input validation and error display
4. Verify trait generation workflow and progress indicators
5. Test export functionality with actual file downloads
6. Validate accessibility compliance (WCAG AA)
7. Test error scenarios and recovery workflows

## Acceptance Criteria

- [ ] **Complete User Workflow**: Input → Generation → Results → Export tested end-to-end
- [ ] **UI State Management**: All state transitions (empty → loading → results → error) validated
- [ ] **Input Validation**: Real-time character definition validation and error feedback
- [ ] **Generation Workflow**: Progress indicators and workflow completion tested
- [ ] **Export Functionality**: File downloads and format options validated
- [ ] **Accessibility Testing**: WCAG AA compliance verification
- [ ] **Error Recovery**: User-friendly error scenarios and recovery options

## Implementation Details

### File Structure

Create E2E test files using Playwright:

```
/tests/e2e/characterBuilder/
├── traitsRewriterUserWorkflow.e2e.test.js
├── traitsRewriterAccessibility.e2e.test.js
├── traitsRewriterErrorScenarios.e2e.test.js
└── traitsRewriterPerformance.e2e.test.js
```

### E2E Test Framework Setup

```javascript
import { test, expect } from '@playwright/test';
import { TraitsRewriterPage } from '../pages/TraitsRewriterPage.js';

test.describe('TraitsRewriter E2E Tests', () => {
  let traitsRewriterPage;

  test.beforeEach(async ({ page }) => {
    traitsRewriterPage = new TraitsRewriterPage(page);
    await traitsRewriterPage.navigate();
    await traitsRewriterPage.waitForPageLoad();
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });
});
```

### Page Object Model

```javascript
// /tests/e2e/pages/TraitsRewriterPage.js
export class TraitsRewriterPage {
  constructor(page) {
    this.page = page;

    // Define selectors
    this.selectors = {
      characterInput: '#character-definition-input',
      generateBtn: '#generate-btn',
      exportBtn: '#export-btn',
      clearBtn: '#clear-btn',
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',
      exportFormatSelect: '#export-format-select',
      characterNameDisplay: '#character-name-display',
      traitsContainer: '#rewritten-traits-container',
    };
  }

  async navigate() {
    await this.page.goto('/traits-rewriter.html');
  }

  async waitForPageLoad() {
    await this.page.waitForSelector(this.selectors.characterInput);
    await this.page.waitForSelector(this.selectors.generateBtn);
  }

  async inputCharacterDefinition(characterData) {
    await this.page.fill(
      this.selectors.characterInput,
      JSON.stringify(characterData, null, 2)
    );
  }

  async clickGenerate() {
    await this.page.click(this.selectors.generateBtn);
  }

  async waitForGeneration() {
    // Wait for loading state
    await this.page.waitForSelector(this.selectors.loadingState + ':visible');

    // Wait for results or error state
    await this.page.waitForSelector(
      [
        this.selectors.resultsState + ':visible',
        this.selectors.errorState + ':visible',
      ].join(','),
      { timeout: 30000 }
    );
  }

  async isGenerateButtonEnabled() {
    return await this.page.isEnabled(this.selectors.generateBtn);
  }

  async isInLoadingState() {
    return await this.page.isVisible(this.selectors.loadingState);
  }

  async isInResultsState() {
    return await this.page.isVisible(this.selectors.resultsState);
  }

  async isInErrorState() {
    return await this.page.isVisible(this.selectors.errorState);
  }

  async getGeneratedTraits() {
    const traitsElements = await this.page.locator('.trait-section');
    const traits = [];

    for (let i = 0; i < (await traitsElements.count()); i++) {
      const element = traitsElements.nth(i);
      const label = await element.locator('.trait-section-title').textContent();
      const content = await element.locator('.trait-content').textContent();
      traits.push({ label, content });
    }

    return traits;
  }

  async selectExportFormat(format) {
    await this.page.selectOption(this.selectors.exportFormatSelect, format);
  }

  async clickExport() {
    await this.page.click(this.selectors.exportBtn);
  }

  async clearAll() {
    await this.page.click(this.selectors.clearBtn);
  }
}
```

## Test Categories

### 1. Complete User Workflow Tests

#### Happy Path Workflow

```javascript
test('should complete full trait rewriting workflow successfully', async ({
  page,
}) => {
  const traitsRewriterPage = new TraitsRewriterPage(page);
  await traitsRewriterPage.navigate();

  // Valid character definition
  const characterData = {
    'core:name': { text: 'Elena Vasquez' },
    'core:personality': {
      text: 'Analytical software engineer with perfectionist tendencies',
    },
    'core:likes': { text: 'Clean code, challenging algorithms, espresso' },
    'core:fears': { text: 'Public speaking and being seen as incompetent' },
  };

  // Step 1: Input character definition
  await traitsRewriterPage.inputCharacterDefinition(characterData);

  // Step 2: Verify generate button becomes enabled
  await expect(traitsRewriterPage.isGenerateButtonEnabled()).resolves.toBe(
    true
  );

  // Step 3: Generate traits
  await traitsRewriterPage.clickGenerate();

  // Step 4: Wait for generation to complete
  await traitsRewriterPage.waitForGeneration();

  // Step 5: Verify results state
  expect(await traitsRewriterPage.isInResultsState()).toBe(true);

  // Step 6: Verify traits were generated
  const generatedTraits = await traitsRewriterPage.getGeneratedTraits();
  expect(generatedTraits).toHaveLength(3); // personality, likes, fears
  expect(generatedTraits[0].content).toContain('I am');

  // Step 7: Test export functionality
  await traitsRewriterPage.selectExportFormat('text');

  // Setup download expectation
  const downloadPromise = page.waitForEvent('download');
  await traitsRewriterPage.clickExport();
  const download = await downloadPromise;

  // Verify download
  expect(download.suggestedFilename()).toMatch(
    /elena-vasquez-traits-rewriter-\d{4}-\d{2}-\d{2}.*\.txt/
  );
});
```

#### Character Input Validation Workflow

```javascript
test('should validate character input in real-time', async ({ page }) => {
  const traitsRewriterPage = new TraitsRewriterPage(page);
  await traitsRewriterPage.navigate();

  // Test empty input
  expect(await traitsRewriterPage.isGenerateButtonEnabled()).toBe(false);

  // Test invalid JSON
  await traitsRewriterPage.inputCharacterDefinition('{ invalid json');
  await page.waitForTimeout(600); // Debounce delay
  expect(await traitsRewriterPage.isGenerateButtonEnabled()).toBe(false);

  // Verify error message displayed
  const errorElement = page.locator('#input-validation-error');
  await expect(errorElement).toBeVisible();
  await expect(errorElement).toContainText('JSON');

  // Test valid JSON but no traits
  await traitsRewriterPage.inputCharacterDefinition('{"invalid": "structure"}');
  await page.waitForTimeout(600);
  expect(await traitsRewriterPage.isGenerateButtonEnabled()).toBe(false);

  // Test valid character definition
  const validData = {
    'core:name': { text: 'Test Character' },
    'core:personality': { text: 'Test personality' },
  };
  await traitsRewriterPage.inputCharacterDefinition(validData);
  await page.waitForTimeout(600);
  expect(await traitsRewriterPage.isGenerateButtonEnabled()).toBe(true);
});
```

### 2. UI State Management Tests

#### State Transitions

```javascript
test('should manage UI state transitions correctly', async ({ page }) => {
  const traitsRewriterPage = new TraitsRewriterPage(page);
  await traitsRewriterPage.navigate();

  // Initial state should be empty
  expect(await traitsRewriterPage.isInLoadingState()).toBe(false);
  expect(await traitsRewriterPage.isInResultsState()).toBe(false);
  expect(await traitsRewriterPage.isInErrorState()).toBe(false);

  // Input valid character and generate
  const characterData = {
    'core:name': { text: 'Test Character' },
    'core:personality': { text: 'Test personality' },
  };

  await traitsRewriterPage.inputCharacterDefinition(characterData);
  await traitsRewriterPage.clickGenerate();

  // Should transition to loading state
  expect(await traitsRewriterPage.isInLoadingState()).toBe(true);

  // Wait for completion
  await traitsRewriterPage.waitForGeneration();

  // Should be in results state
  expect(await traitsRewriterPage.isInLoadingState()).toBe(false);
  expect(await traitsRewriterPage.isInResultsState()).toBe(true);

  // Clear should reset to empty state
  await traitsRewriterPage.clearAll();
  expect(await traitsRewriterPage.isInResultsState()).toBe(false);
});
```

### 3. Export Functionality Tests

#### File Download Testing

```javascript
test('should export traits in different formats', async ({ page, context }) => {
  // Enable downloads
  await context.grantPermissions(['downloads']);

  const traitsRewriterPage = new TraitsRewriterPage(page);
  await traitsRewriterPage.navigate();

  // Generate some traits first
  const characterData = {
    'core:name': { text: 'Export Test Character' },
    'core:personality': { text: 'Personality for export testing' },
  };

  await traitsRewriterPage.inputCharacterDefinition(characterData);
  await traitsRewriterPage.clickGenerate();
  await traitsRewriterPage.waitForGeneration();

  // Test text export
  await traitsRewriterPage.selectExportFormat('text');

  const textDownloadPromise = page.waitForEvent('download');
  await traitsRewriterPage.clickExport();
  const textDownload = await textDownloadPromise;

  expect(textDownload.suggestedFilename()).toMatch(/\.txt$/);

  // Verify file content
  const textPath = await textDownload.path();
  const textContent = await page.evaluate(async (path) => {
    const response = await fetch(`file://${path}`);
    return await response.text();
  }, textPath);

  expect(textContent).toContain('Character: Export Test Character');
  expect(textContent).toContain('Personality:');

  // Test JSON export
  await traitsRewriterPage.selectExportFormat('json');

  const jsonDownloadPromise = page.waitForEvent('download');
  await traitsRewriterPage.clickExport();
  const jsonDownload = await jsonDownloadPromise;

  expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/);
});
```

### 4. Error Scenario Tests

#### Error Handling and Recovery

```javascript
test('should handle generation errors gracefully', async ({ page }) => {
  const traitsRewriterPage = new TraitsRewriterPage(page);
  await traitsRewriterPage.navigate();

  // Mock a generation failure (this would require test environment setup)
  await page.route('**/llm-proxy-server/**', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'LLM service unavailable' }),
    });
  });

  const characterData = {
    'core:name': { text: 'Error Test Character' },
    'core:personality': { text: 'This should cause an error' },
  };

  await traitsRewriterPage.inputCharacterDefinition(characterData);
  await traitsRewriterPage.clickGenerate();

  // Wait for error state
  await page.waitForSelector('#error-state:visible', { timeout: 10000 });

  expect(await traitsRewriterPage.isInErrorState()).toBe(true);

  // Verify error message is user-friendly
  const errorMessage = await page.locator('#error-message-text').textContent();
  expect(errorMessage).not.toContain('500');
  expect(errorMessage).toContain('service');

  // Test recovery - clear and try again
  await traitsRewriterPage.clearAll();
  expect(await traitsRewriterPage.isInErrorState()).toBe(false);
});
```

### 5. Accessibility Testing

#### WCAG AA Compliance

```javascript
test('should meet WCAG AA accessibility standards', async ({ page }) => {
  const traitsRewriterPage = new TraitsRewriterPage(page);
  await traitsRewriterPage.navigate();

  // Test keyboard navigation
  await page.keyboard.press('Tab');
  await expect(page.locator('#character-definition-input')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.locator('#generate-btn')).toBeFocused();

  // Test ARIA labels and roles
  const generateBtn = page.locator('#generate-btn');
  await expect(generateBtn).toHaveAttribute('role', 'button');

  const characterInput = page.locator('#character-definition-input');
  await expect(characterInput).toHaveAttribute('aria-label');

  // Test contrast ratios (would use axe-playwright addon)
  // await expect(page).toPassAxeTest();

  // Test screen reader compatibility
  const loadingMessage = page.locator('#loading-message');
  await expect(loadingMessage).toHaveAttribute('aria-live', 'polite');
});
```

## Dependencies

**Blocking**:

- TRAREW-008 (Complete TraitsRewriterController implementation)
- TRAREW-011 (Integration testing for service coordination)

**External Dependencies**:

- Playwright testing framework ✅
- Browser automation infrastructure
- File system access for download testing

## Test Environment Setup

### Browser Configuration

```javascript
// playwright.config.js
module.exports = {
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
};
```

### Test Data

```javascript
// /tests/e2e/fixtures/characterData.js
export const testCharacters = {
  simple: {
    'core:name': { text: 'Simple Character' },
    'core:personality': { text: 'Basic personality trait' },
  },

  complex: {
    'core:name': { text: 'Complex Character' },
    'core:personality': {
      text: 'Multi-faceted personality with depth and nuance',
    },
    'core:likes': {
      text: 'Literature, classical music, philosophical discussions',
    },
    'core:fears': { text: 'Existential dread and fear of meaninglessness' },
    'core:goals': {
      text: 'Achieve self-actualization and make meaningful impact',
    },
  },

  withSpecialChars: {
    'core:name': { text: 'Spëcîål Çhãracter' },
    'core:personality': {
      text: 'Has "quotes" and \'apostrophes\' & special chars',
    },
  },
};
```

## Validation Steps

### Step 1: E2E Test Execution

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- traitsRewriterUserWorkflow.e2e.test.js

# Run with UI for debugging
npm run test:e2e -- --headed
```

### Step 2: Cross-Browser Testing

```bash
# Run on all browsers
npm run test:e2e -- --project=chromium --project=firefox --project=webkit
```

### Step 3: Accessibility Validation

```bash
# Run accessibility-specific tests
npm run test:e2e -- traitsRewriterAccessibility.e2e.test.js
```

## Success Metrics

- **User Workflow Completion**: All major user workflows complete successfully
- **Cross-Browser Compatibility**: Tests pass on Chrome, Firefox, and Safari
- **Accessibility Compliance**: WCAG AA standards met
- **Error Recovery**: Graceful handling of error scenarios with user-friendly feedback
- **Performance**: Page loads and interactions within acceptable time limits
- **File Downloads**: Export functionality works correctly across formats

## Next Steps

After completion:

- **TRAREW-013**: Performance testing under load
- **TRAREW-014**: User acceptance testing scenarios

## Implementation Checklist

- [ ] Set up Playwright test framework and configuration
- [ ] Create Page Object Model for TraitsRewriter page
- [ ] Implement complete user workflow E2E tests
- [ ] Implement UI state transition tests
- [ ] Implement input validation E2E tests
- [ ] Implement export functionality tests with file downloads
- [ ] Implement error scenario and recovery tests
- [ ] Implement accessibility compliance tests
- [ ] Create comprehensive test data fixtures
- [ ] Set up cross-browser testing configuration
- [ ] Configure test reporting and failure capture
- [ ] Document E2E testing patterns and maintenance
