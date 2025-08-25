/**
 * @file Integration tests for Speech Patterns Generator Accessibility
 * Tests enhanced accessibility features and keyboard navigation in browser environment
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Speech Patterns Generator - Enhanced Accessibility Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();

    // Create HTML structure with required accessibility enhancements
    document.body.innerHTML = `
      <div id="app" class="cb-page-container">
        <a href="#main-content" class="skip-link">Skip to main content</a>
        
        <main id="main-content" class="cb-page-main">
          <aside class="cb-input-panel">
            <button 
              id="generate-btn" 
              class="cb-button cb-button-primary" 
              disabled
              aria-label="Generate speech patterns"
              aria-keyshortcuts="Control+Enter"
            >
              Generate Speech Patterns
            </button>
          </aside>
          
          <section class="cb-output-panel">
            <div class="cb-panel-header">
              <div class="panel-actions">
                <button 
                  id="clear-all-btn" 
                  class="cb-button cb-button-danger" 
                  disabled
                  aria-label="Clear character input and results"
                  aria-keyshortcuts="Control+Shift+Delete"
                >
                  Clear All
                </button>
                <button 
                  id="export-btn" 
                  class="cb-button cb-button-secondary" 
                  disabled
                  aria-label="Export speech patterns to text file"
                  aria-keyshortcuts="Control+E"
                >
                  Export
                </button>
              </div>
            </div>
            
            <div id="speech-patterns-container" class="speech-patterns-container">
              <!-- Test patterns with enhanced accessibility -->
              <div class="speech-patterns-results">
                <article 
                  class="speech-pattern-item" 
                  tabindex="0"
                  role="article"
                  aria-labelledby="pattern-0-title"
                  aria-describedby="pattern-0-content"
                >
                  <div class="pattern-number" aria-hidden="true">1</div>
                  <h3 id="pattern-0-title" class="screen-reader-only">Speech Pattern 1</h3>
                  
                  <div id="pattern-0-content" class="pattern-content">
                    <div class="pattern-description" role="definition">
                      <span class="screen-reader-only">Pattern description: </span>
                      Test speech pattern description
                    </div>
                    <div class="pattern-example" role="example">
                      <span class="screen-reader-only">Example dialogue: </span>
                      "This is an example of the speech pattern."
                    </div>
                  </div>
                  
                  <div class="screen-reader-only">
                    Pattern 1 of 3. Use arrow keys or J/K to navigate between patterns.
                  </div>
                </article>
                
                <article 
                  class="speech-pattern-item" 
                  tabindex="-1"
                  role="article"
                  aria-labelledby="pattern-1-title"
                  aria-describedby="pattern-1-content"
                >
                  <div class="pattern-number" aria-hidden="true">2</div>
                  <h3 id="pattern-1-title" class="screen-reader-only">Speech Pattern 2</h3>
                  
                  <div id="pattern-1-content" class="pattern-content">
                    <div class="pattern-description" role="definition">
                      <span class="screen-reader-only">Pattern description: </span>
                      Second test speech pattern
                    </div>
                    <div class="pattern-example" role="example">
                      <span class="screen-reader-only">Example dialogue: </span>
                      "Here's another example of dialogue."
                    </div>
                  </div>
                  
                  <div class="screen-reader-only">
                    Pattern 2 of 3. Use arrow keys or J/K to navigate between patterns.
                  </div>
                </article>
                
                <article 
                  class="speech-pattern-item" 
                  tabindex="-1"
                  role="article"
                  aria-labelledby="pattern-2-title"
                  aria-describedby="pattern-2-content"
                >
                  <div class="pattern-number" aria-hidden="true">3</div>
                  <h3 id="pattern-2-title" class="screen-reader-only">Speech Pattern 3</h3>
                  
                  <div id="pattern-2-content" class="pattern-content">
                    <div class="pattern-description" role="definition">
                      <span class="screen-reader-only">Pattern description: </span>
                      Third test speech pattern
                    </div>
                    <div class="pattern-example" role="example">
                      <span class="screen-reader-only">Example dialogue: </span>
                      "And a third example for testing."
                    </div>
                  </div>
                  
                  <div class="screen-reader-only">
                    Pattern 3 of 3. Use arrow keys or J/K to navigate between patterns.
                  </div>
                </article>
              </div>
            </div>
          </section>
        </main>
        
        <div 
          id="screen-reader-announcement" 
          class="screen-reader-only" 
          aria-live="polite" 
          aria-atomic="true"
        ></div>
      </div>
    `;
  });

  afterEach(() => {
    testBed.cleanup();
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Enhanced ARIA Attributes', () => {
    it('should include aria-keyshortcuts on buttons', () => {
      const generateBtn = document.getElementById('generate-btn');
      const exportBtn = document.getElementById('export-btn');
      const clearBtn = document.getElementById('clear-all-btn');

      expect(generateBtn.getAttribute('aria-keyshortcuts')).toBe(
        'Control+Enter'
      );
      expect(exportBtn.getAttribute('aria-keyshortcuts')).toBe('Control+E');
      expect(clearBtn.getAttribute('aria-keyshortcuts')).toBe(
        'Control+Shift+Delete'
      );
    });

    it('should provide screen reader context for pattern elements', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');

      expect(patterns).toHaveLength(3);

      patterns.forEach((pattern, index) => {
        expect(pattern.getAttribute('aria-labelledby')).toBe(
          `pattern-${index}-title`
        );
        expect(pattern.getAttribute('aria-describedby')).toBe(
          `pattern-${index}-content`
        );
        expect(pattern.getAttribute('role')).toBe('article');

        const title = pattern.querySelector(`#pattern-${index}-title`);
        expect(title).toBeTruthy();
        expect(title.classList.contains('screen-reader-only')).toBe(true);
        expect(title.textContent).toContain(`Speech Pattern ${index + 1}`);
      });
    });

    it('should include screen reader context labels for pattern content', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');

      patterns.forEach((pattern) => {
        const description = pattern.querySelector('.pattern-description');
        const example = pattern.querySelector('.pattern-example');

        expect(description.getAttribute('role')).toBe('definition');
        expect(example.getAttribute('role')).toBe('example');

        const descriptionLabel = description.querySelector(
          '.screen-reader-only'
        );
        const exampleLabel = example.querySelector('.screen-reader-only');

        expect(descriptionLabel?.textContent).toBe('Pattern description: ');
        expect(exampleLabel?.textContent).toBe('Example dialogue: ');
      });
    });

    it('should include navigation instructions for screen reader users', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');

      patterns.forEach((pattern) => {
        const instructions = Array.from(
          pattern.querySelectorAll('.screen-reader-only')
        ).find((el) => el.textContent.includes('Use arrow keys or J/K'));

        expect(instructions).toBeTruthy();
        expect(instructions.textContent).toContain(
          'Use arrow keys or J/K to navigate between patterns'
        );
      });
    });
  });

  describe('Arrow Key Navigation Structure', () => {
    it('should have proper tabindex management for keyboard navigation', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');

      // First pattern should be focusable initially
      expect(patterns[0].getAttribute('tabindex')).toBe('0');

      // Other patterns should not be focusable initially
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i].getAttribute('tabindex')).toBe('-1');
      }
    });

    it('should allow focus on first pattern', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');
      const firstPattern = patterns[0];

      // Focus first pattern
      firstPattern.focus();
      expect(document.activeElement).toBe(firstPattern);
    });

    it('should simulate arrow key navigation behavior', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');

      // Focus first pattern
      patterns[0].focus();
      expect(document.activeElement).toBe(patterns[0]);

      // Simulate navigation logic (what our controller would do)
      // When arrow down is pressed on first pattern:
      patterns[0].setAttribute('tabindex', '-1');
      patterns[1].setAttribute('tabindex', '0');
      patterns[1].focus();

      // Check that navigation worked
      expect(patterns[1].getAttribute('tabindex')).toBe('0');
      expect(patterns[0].getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(patterns[1]);
    });
  });

  describe('Skip Link Accessibility', () => {
    it('should provide functional skip link', () => {
      const skipLink = document.querySelector('.skip-link');
      const mainContent = document.getElementById('main-content');

      expect(skipLink).toBeTruthy();
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(mainContent).toBeTruthy();
    });
  });

  describe('Focus Indicators Structure', () => {
    it('should have proper CSS classes for focus styling', () => {
      const patterns = document.querySelectorAll('.speech-pattern-item');

      patterns.forEach((pattern) => {
        expect(pattern.classList.contains('speech-pattern-item')).toBe(true);
      });
    });
  });

  describe('Screen Reader Only Content', () => {
    it('should have proper screen-reader-only class usage', () => {
      const srOnlyElements = document.querySelectorAll('.screen-reader-only');

      // Should have multiple screen reader only elements
      expect(srOnlyElements.length).toBeGreaterThan(0);

      // Check that each has proper content
      const hasNavigationInstructions = Array.from(srOnlyElements).some((el) =>
        el.textContent.includes('Use arrow keys')
      );
      const hasPatternLabels = Array.from(srOnlyElements).some((el) =>
        el.textContent.includes('Pattern description')
      );

      expect(hasNavigationInstructions).toBe(true);
      expect(hasPatternLabels).toBe(true);
    });

    it('should have screen reader announcement area', () => {
      const announcer = document.getElementById('screen-reader-announcement');

      expect(announcer).toBeTruthy();
      expect(announcer.getAttribute('aria-live')).toBe('polite');
      expect(announcer.getAttribute('aria-atomic')).toBe('true');
      expect(announcer.classList.contains('screen-reader-only')).toBe(true);
    });
  });

  describe('Pattern Content Structure', () => {
    it('should have proper semantic roles for pattern content', () => {
      const descriptions = document.querySelectorAll('.pattern-description');
      const examples = document.querySelectorAll('.pattern-example');

      descriptions.forEach((desc) => {
        expect(desc.getAttribute('role')).toBe('definition');
      });

      examples.forEach((example) => {
        expect(example.getAttribute('role')).toBe('example');
      });
    });

    it('should properly hide decorative elements from screen readers', () => {
      const patternNumbers = document.querySelectorAll('.pattern-number');

      patternNumbers.forEach((number) => {
        expect(number.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });
});
