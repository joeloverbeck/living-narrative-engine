# CLIGEN-016: End-to-End Testing

## Summary

Create comprehensive end-to-end tests for the Clichés Generator page, validating the complete user journey from page load to cliché generation and display, including performance testing and cross-browser compatibility.

## Parent Issue

- **Phase**: Phase 4 - Testing & Integration
- **Specification**: [Clichés Generator Implementation Specification](../specs/cliches-generator.spec.md)
- **Overview**: [CLIGEN-000](./CLIGEN-000-implementation-overview.md)

## Description

This ticket focuses on creating end-to-end tests that validate the complete user experience of the Clichés Generator. The tests must cover the entire user journey from initial page load through cliché generation and display, validate the UI interactions and state changes, ensure proper error handling and recovery, measure performance benchmarks, and verify cross-browser functionality.

## Acceptance Criteria

- [ ] E2E test file created at `tests/e2e/clichesGenerator.e2e.test.js`
- [ ] Performance test file created at `tests/performance/clichesGeneratorPerformance.test.js`
- [ ] Tests cover complete user journey workflows
- [ ] Tests validate UI interactions and state changes
- [ ] Tests verify LLM integration end-to-end
- [ ] Tests measure and validate performance requirements
- [ ] Tests handle error scenarios gracefully
- [ ] Tests work across major browsers (Chrome, Firefox, Safari, Edge)
- [ ] All tests pass consistently in CI/CD pipeline
- [ ] Test execution time < 60 seconds

## Technical Requirements

### End-to-End Test Suite

```javascript
// tests/e2e/clichesGenerator.e2e.test.js

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import puppeteer from 'puppeteer';
import { ClichesE2ETestBed } from '../common/clichesE2ETestBed.js';

describe('Clichés Generator - End-to-End Tests', () => {
  let testBed;
  let browser;
  let page;

  beforeAll(async () => {
    testBed = new ClichesE2ETestBed();
    await testBed.initialize();

    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 50, // Slow down for visibility during development
    });
  });

  afterAll(async () => {
    await browser.close();
    await testBed.cleanup();
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // Setup viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Mock LLM service
    await testBed.mockLLMService(page);

    // Navigate to page
    await page.goto(testBed.getPageURL('cliches-generator.html'));

    // Wait for page to initialize
    await page.waitForSelector('#cliches-generator-container', {
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await page.close();
  });

  describe('Page Initialization', () => {
    it('should load and initialize the page successfully', async () => {
      // Verify page title
      const title = await page.title();
      expect(title).toContain('Clichés Generator');

      // Verify main container exists
      const container = await page.$('#cliches-generator-container');
      expect(container).toBeTruthy();

      // Verify header content
      const header = await page.$eval('h1', (el) => el.textContent);
      expect(header).toBe('Clichés Generator');

      // Verify subtitle
      const subtitle = await page.$eval(
        '.header-subtitle',
        (el) => el.textContent
      );
      expect(subtitle).toBe('Identify overused tropes to avoid');
    });

    it('should load thematic directions in dropdown', async () => {
      // Wait for dropdown to populate
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1,
        { timeout: 5000 }
      );

      // Count options
      const optionCount = await page.$$eval(
        '#direction-selector option',
        (options) => options.length
      );

      expect(optionCount).toBeGreaterThan(1); // Should have default option + directions

      // Verify default option
      const defaultOption = await page.$eval(
        '#direction-selector option[value=""]',
        (el) => el.textContent
      );
      expect(defaultOption).toBe('-- Choose a thematic direction --');
    });

    it('should have generate button disabled initially', async () => {
      const generateBtn = await page.$('#generate-btn');
      const isDisabled = await page.evaluate((el) => el.disabled, generateBtn);

      expect(isDisabled).toBe(true);
    });
  });

  describe('Direction Selection', () => {
    it('should display direction details when selected', async () => {
      // Wait for dropdown to populate
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );

      // Select first available direction
      await page.select('#direction-selector', 'direction-1');

      // Wait for direction display to appear
      await page.waitForSelector(
        '#selected-direction-display[style*="block"]',
        {
          visible: true,
          timeout: 3000,
        }
      );

      // Verify direction content is displayed
      const directionContent = await page.$eval(
        '#direction-content',
        (el) => el.textContent.length > 0
      );
      expect(directionContent).toBe(true);

      // Verify original concept is displayed
      await page.waitForSelector('#original-concept-display[style*="block"]', {
        visible: true,
      });

      const conceptContent = await page.$eval(
        '#concept-content',
        (el) => el.textContent.length > 0
      );
      expect(conceptContent).toBe(true);
    });

    it('should enable generate button after direction selection', async () => {
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );

      await page.select('#direction-selector', 'direction-1');

      // Wait for button to be enabled
      await page.waitForFunction(
        () => !document.querySelector('#generate-btn').disabled,
        { timeout: 3000 }
      );

      const generateBtn = await page.$('#generate-btn');
      const isDisabled = await page.evaluate((el) => el.disabled, generateBtn);

      expect(isDisabled).toBe(false);
    });
  });

  describe('Cliché Generation Workflow', () => {
    beforeEach(async () => {
      // Setup for generation tests
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );
      await page.select('#direction-selector', 'direction-new');
    });

    it('should complete full generation workflow', async () => {
      // Click generate button
      await page.click('#generate-btn');

      // Verify loading state
      const loadingState = await page.waitForSelector('.loading-state', {
        visible: true,
        timeout: 1000,
      });
      expect(loadingState).toBeTruthy();

      // Wait for generation to complete
      await page.waitForSelector('.cliches-results', {
        visible: true,
        timeout: 15000, // Allow time for LLM generation
      });

      // Verify results are displayed
      const resultsContainer = await page.$('.cliches-results');
      expect(resultsContainer).toBeTruthy();

      // Verify category cards are present
      const categoryCards = await page.$$('.category-card');
      expect(categoryCards.length).toBeGreaterThan(0);

      // Verify specific categories
      const expectedCategories = [
        'names',
        'physicalDescriptions',
        'personalityTraits',
        'skillsAbilities',
        'typicalLikes',
        'typicalDislikes',
        'commonFears',
        'genericGoals',
        'backgroundElements',
        'overusedSecrets',
        'speechPatterns',
      ];

      for (const category of expectedCategories) {
        const card = await page.$(`[data-category="${category}"]`);
        expect(card).toBeTruthy();
      }

      // Verify tropes section
      const tropesSection = await page.$('.tropes-section');
      expect(tropesSection).toBeTruthy();
    });

    it('should display existing clichés for previously generated directions', async () => {
      // Select direction that already has clichés
      await page.select('#direction-selector', 'direction-existing');

      // Should immediately show results (no loading)
      await page.waitForSelector('.cliches-results', {
        visible: true,
        timeout: 2000,
      });

      // Verify no loading state was shown
      const loadingState = await page.$('.loading-state');
      expect(loadingState).toBeFalsy();

      // Verify "exists" message
      const existsMessage = await page.$('.exists-message');
      expect(existsMessage).toBeTruthy();
    });

    it('should handle generation errors gracefully', async () => {
      // Configure mock to return error
      await testBed.mockLLMServiceError(
        page,
        'Service temporarily unavailable'
      );

      await page.click('#generate-btn');

      // Wait for error state
      await page.waitForSelector('.error-state', {
        visible: true,
        timeout: 10000,
      });

      // Verify error message
      const errorMessage = await page.$eval(
        '.error-message',
        (el) => el.textContent
      );
      expect(errorMessage).toContain('generation failed');

      // Verify retry button exists
      const retryBtn = await page.$('.retry-btn');
      expect(retryBtn).toBeTruthy();
    });
  });

  describe('UI Interactions', () => {
    beforeEach(async () => {
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );
      await page.select('#direction-selector', 'direction-1');
      await page.click('#generate-btn');
      await page.waitForSelector('.cliches-results', { timeout: 15000 });
    });

    it('should expand and collapse category cards', async () => {
      const firstCard = await page.$('.category-card');

      // Verify initial state (expanded)
      const isInitiallyExpanded = await page.evaluate(
        (el) => !el.classList.contains('collapsed'),
        firstCard
      );
      expect(isInitiallyExpanded).toBe(true);

      // Click to collapse
      const header = await firstCard.$('.category-header');
      await header.click();

      // Verify collapsed state
      const isCollapsed = await page.evaluate(
        (el) => el.classList.contains('collapsed'),
        firstCard
      );
      expect(isCollapsed).toBe(true);

      // Click to expand
      await header.click();

      // Verify expanded state
      const isExpanded = await page.evaluate(
        (el) => !el.classList.contains('collapsed'),
        firstCard
      );
      expect(isExpanded).toBe(true);
    });

    it('should scroll smoothly between categories', async () => {
      // Click on a category link (if navigation exists)
      const categoryLinks = await page.$$('.category-nav a');

      if (categoryLinks.length > 0) {
        await categoryLinks[0].click();

        // Verify smooth scrolling occurred
        const scrollTop = await page.evaluate(() => window.pageYOffset);
        expect(scrollTop).toBeGreaterThan(0);
      }
    });

    it('should maintain state when switching between directions', async () => {
      // Note current results
      const firstResults = await page.$$('.category-card');
      const firstCount = firstResults.length;

      // Switch to another direction
      await page.select('#direction-selector', 'direction-2');
      await page.click('#generate-btn');
      await page.waitForSelector('.cliches-results', { timeout: 15000 });

      // Verify different results
      const secondResults = await page.$$('.category-card');
      expect(secondResults.length).toBe(firstCount); // Same structure

      // Switch back to first direction
      await page.select('#direction-selector', 'direction-1');

      // Should immediately show cached results
      await page.waitForSelector('.cliches-results', { timeout: 2000 });

      const cachedResults = await page.$$('.category-card');
      expect(cachedResults.length).toBe(firstCount);
    });
  });

  describe('Back Navigation', () => {
    it('should navigate back to main menu', async () => {
      const backBtn = await page.$('#back-to-menu-btn');

      if (backBtn) {
        await backBtn.click();

        // Verify navigation occurred
        const newURL = page.url();
        expect(newURL).not.toContain('cliches-generator');
      }
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Switch to mobile viewport
      await page.setViewport({ width: 375, height: 667 });

      // Reload to ensure responsive layout
      await page.reload();
      await page.waitForSelector('#cliches-generator-container');

      // Verify mobile layout adaptations
      const container = await page.$('.cliches-generator-main');
      const containerClass = await page.evaluate(
        (el) => el.className,
        container
      );

      // Should have responsive classes or structure
      expect(containerClass).toMatch(/mobile|responsive|stacked/);
    });

    it('should maintain functionality on tablet viewport', async () => {
      // Switch to tablet viewport
      await page.setViewport({ width: 768, height: 1024 });

      await page.reload();
      await page.waitForSelector('#cliches-generator-container');

      // Test key functionality still works
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );

      await page.select('#direction-selector', 'direction-1');
      await page.click('#generate-btn');

      const results = await page.waitForSelector('.cliches-results', {
        timeout: 15000,
      });
      expect(results).toBeTruthy();
    });
  });
});
```

### Performance Test Suite

```javascript
// tests/performance/clichesGeneratorPerformance.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer from 'puppeteer';
import { ClichesPerformanceTestBed } from '../common/clichesPerformanceTestBed.js';

describe('Clichés Generator - Performance Tests', () => {
  let testBed;
  let browser;
  let page;

  beforeAll(async () => {
    testBed = new ClichesPerformanceTestBed();
    await testBed.initialize();

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    await browser.close();
    await testBed.cleanup();
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // Enable performance tracking
    await page.tracing.start({
      path: `./test-results/trace-${Date.now()}.json`,
      screenshots: true,
    });

    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    await page.tracing.stop();
    await page.close();
  });

  describe('Page Load Performance', () => {
    it('should load within performance budget', async () => {
      const startTime = Date.now();

      await page.goto(testBed.getPageURL('cliches-generator.html'));

      // Wait for full initialization
      await page.waitForSelector('#cliches-generator-container');
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );

      const loadTime = Date.now() - startTime;

      // Should load in under 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    it('should meet Core Web Vitals thresholds', async () => {
      await page.goto(testBed.getPageURL('cliches-generator.html'));

      // Measure Core Web Vitals
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals = {};

            entries.forEach((entry) => {
              if (entry.entryType === 'largest-contentful-paint') {
                vitals.LCP = entry.renderTime || entry.loadTime;
              }
              if (entry.entryType === 'first-input') {
                vitals.FID = entry.processingStart - entry.startTime;
              }
              if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                vitals.CLS = (vitals.CLS || 0) + entry.value;
              }
            });

            // Return after collecting some metrics
            setTimeout(() => resolve(vitals), 1000);
          });

          observer.observe({
            entryTypes: [
              'largest-contentful-paint',
              'first-input',
              'layout-shift',
            ],
          });
        });
      });

      // Core Web Vitals thresholds
      if (vitals.LCP) expect(vitals.LCP).toBeLessThan(2500); // 2.5s
      if (vitals.FID) expect(vitals.FID).toBeLessThan(100); // 100ms
      if (vitals.CLS) expect(vitals.CLS).toBeLessThan(0.1); // 0.1
    });

    it('should have reasonable bundle size', async () => {
      const response = await page.goto(
        testBed.getPageURL('cliches-generator.js')
      );
      const bundleSize = parseInt(response.headers()['content-length'] || '0');
      const bundleSizeKB = bundleSize / 1024;

      // Should be under 500KB
      expect(bundleSizeKB).toBeLessThan(500);
    });
  });

  describe('Generation Performance', () => {
    beforeEach(async () => {
      await page.goto(testBed.getPageURL('cliches-generator.html'));
      await testBed.mockLLMService(page);
      await page.waitForSelector('#cliches-generator-container');
    });

    it('should generate clichés within time limit', async () => {
      await page.waitForFunction(
        () => document.querySelector('#direction-selector').options.length > 1
      );
      await page.select('#direction-selector', 'direction-1');

      const startTime = Date.now();
      await page.click('#generate-btn');

      await page.waitForSelector('.cliches-results', { timeout: 15000 });

      const generationTime = Date.now() - startTime;

      // Should complete within 10 seconds
      expect(generationTime).toBeLessThan(10000);
    });

    it('should handle concurrent generations efficiently', async () => {
      // Open multiple tabs
      const pages = await Promise.all([
        browser.newPage(),
        browser.newPage(),
        browser.newPage(),
      ]);

      // Setup each page
      for (const p of pages) {
        await p.goto(testBed.getPageURL('cliches-generator.html'));
        await testBed.mockLLMService(p);
        await p.waitForSelector('#cliches-generator-container');
        await p.waitForFunction(
          () => document.querySelector('#direction-selector').options.length > 1
        );
        await p.select('#direction-selector', 'direction-1');
      }

      const startTime = Date.now();

      // Start generation on all pages simultaneously
      await Promise.all(pages.map((p) => p.click('#generate-btn')));

      // Wait for all to complete
      await Promise.all(
        pages.map((p) =>
          p.waitForSelector('.cliches-results', { timeout: 20000 })
        )
      );

      const totalTime = Date.now() - startTime;

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(15000);

      // Cleanup
      await Promise.all(pages.map((p) => p.close()));
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during typical usage', async () => {
      await page.goto(testBed.getPageURL('cliches-generator.html'));
      await testBed.mockLLMService(page);

      // Measure initial memory
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await page.waitForFunction(
          () => document.querySelector('#direction-selector').options.length > 1
        );
        await page.select('#direction-selector', `direction-${i + 1}`);
        await page.click('#generate-btn');
        await page.waitForSelector('.cliches-results', { timeout: 15000 });
      }

      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      // Measure final memory
      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return 0;
      });

      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory - initialMemory;
        const increasePercentage = (memoryIncrease / initialMemory) * 100;

        // Memory increase should be reasonable (< 50%)
        expect(increasePercentage).toBeLessThan(50);
      }
    });
  });

  describe('Network Performance', () => {
    it('should minimize network requests', async () => {
      const requests = [];

      page.on('request', (request) => {
        requests.push(request.url());
      });

      await page.goto(testBed.getPageURL('cliches-generator.html'));
      await page.waitForSelector('#cliches-generator-container');

      // Filter out test setup requests
      const appRequests = requests.filter(
        (url) =>
          url.includes('cliches-generator') ||
          url.includes('.js') ||
          url.includes('.css')
      );

      // Should make minimal requests
      expect(appRequests.length).toBeLessThan(10);
    });

    it('should cache resources effectively', async () => {
      // First visit
      await page.goto(testBed.getPageURL('cliches-generator.html'));
      await page.waitForSelector('#cliches-generator-container');

      // Second visit - resources should be cached
      const responses = [];
      page.on('response', (response) => {
        responses.push({
          url: response.url(),
          fromCache: response.fromCache(),
        });
      });

      await page.goto(testBed.getPageURL('cliches-generator.html'));

      const cachedResponses = responses.filter((r) => r.fromCache);
      const totalResponses = responses.length;

      if (totalResponses > 0) {
        const cacheHitRate = (cachedResponses.length / totalResponses) * 100;

        // Good cache hit rate expected
        expect(cacheHitRate).toBeGreaterThan(70);
      }
    });
  });
});
```

### Cross-Browser Test Configuration

```javascript
// tests/e2e/crossBrowser.config.js

const browsers = [
  {
    name: 'chrome',
    product: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  {
    name: 'firefox',
    product: 'firefox',
    args: [],
  },
  // Safari and Edge would require additional setup
];

export const runCrossBrowserTests = async (testSuite) => {
  const results = {};

  for (const browserConfig of browsers) {
    console.log(`Running tests on ${browserConfig.name}...`);

    try {
      const puppeteer = require(
        browserConfig.product === 'firefox' ? 'puppeteer-firefox' : 'puppeteer'
      );
      const browser = await puppeteer.launch({
        ...browserConfig,
        headless: true,
      });

      const result = await testSuite(browser);
      results[browserConfig.name] = { success: true, result };

      await browser.close();
    } catch (error) {
      results[browserConfig.name] = { success: false, error };
    }
  }

  return results;
};
```

## Implementation Steps

1. **Create E2E Test Infrastructure** (60 minutes)
   - Setup Puppeteer configuration
   - Create test bed utilities
   - Configure browser options

2. **Implement User Journey Tests** (120 minutes)
   - Page initialization tests
   - Direction selection tests
   - Generation workflow tests
   - UI interaction tests

3. **Implement Performance Tests** (90 minutes)
   - Page load performance
   - Generation performance
   - Memory usage tests
   - Network performance tests

4. **Implement Error Handling Tests** (60 minutes)
   - Network failure scenarios
   - LLM service errors
   - Validation failures
   - Recovery mechanisms

5. **Cross-Browser Testing Setup** (30 minutes)
   - Configure multiple browsers
   - Test compatibility
   - Handle browser-specific differences

6. **CI/CD Integration** (30 minutes)
   - Configure test execution
   - Setup performance budgets
   - Add to build pipeline

## Dependencies

### Depends On

- CLIGEN-005: ClichesGeneratorController (for UI functionality)
- CLIGEN-009: HTML Page Structure (for DOM elements)
- CLIGEN-015: Build Configuration (for bundled page)
- Fully implemented UI components

### Blocks

- Production deployment validation
- Performance optimization decisions
- User acceptance testing

## Estimated Effort

- **Estimated Hours**: 4 hours
- **Complexity**: Medium
- **Risk**: Medium (due to cross-browser and performance requirements)

## Success Metrics

- [ ] All E2E tests pass consistently across browsers
- [ ] Performance requirements validated (< 2s load, < 10s generation)
- [ ] Core Web Vitals within thresholds
- [ ] No memory leaks detected
- [ ] Test execution completes in < 60 seconds
- [ ] Cross-browser compatibility confirmed
- [ ] Error scenarios handled gracefully
- [ ] User workflows validated end-to-end

## Testing Strategy

### Test Categories

1. **Functional Tests**: Core user workflows
2. **Performance Tests**: Speed and resource usage
3. **Compatibility Tests**: Cross-browser functionality
4. **Error Tests**: Failure scenarios and recovery

### Test Environment

- **Local Development**: Full browser with debugging
- **CI/CD**: Headless browsers for speed
- **Staging**: Real environment testing
- **Production**: Monitoring and alerting

### Performance Budgets

- **Page Load**: < 2 seconds
- **Generation Time**: < 10 seconds
- **Bundle Size**: < 500KB
- **Memory Usage**: < 100MB
- **LCP**: < 2.5s
- **FID**: < 100ms
- **CLS**: < 0.1

## Notes

- Use Puppeteer for consistent cross-browser testing
- Mock LLM service for predictable test execution
- Include visual regression testing if needed
- Monitor performance trends over time
- Test on various network conditions
- Include accessibility testing in future iterations
- Consider adding load testing for high concurrency

## Related Files

- E2E Tests: `tests/e2e/clichesGenerator.e2e.test.js`
- Performance Tests: `tests/performance/clichesGeneratorPerformance.test.js`
- Test Bed: `tests/common/clichesE2ETestBed.js`
- Cross-Browser Config: `tests/e2e/crossBrowser.config.js`
- CI Config: `.github/workflows/e2e-tests.yml`
- Performance Config: `tests/performance/performance.config.js`

---

**Ticket Status**: Ready for Development
**Priority**: High (Phase 4 - Testing)
**Labels**: testing, e2e-test, performance-test, cliches-generator, phase-4, puppeteer
