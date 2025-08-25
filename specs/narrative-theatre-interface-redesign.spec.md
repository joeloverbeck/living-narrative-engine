# Narrative Theatre Interface Redesign - Technical Specification

## Implementation Status

**Status**: SPECIFICATION FOR FUTURE IMPLEMENTATION  
**Type**: PROPOSED INTERFACE REDESIGN SPECIFICATION  
**Target Page**: game.html  
**Impact**: High - Complete UI transformation  
**Current Production State**:

- game.html uses a three-panel layout with modular CSS architecture
- Center panel contains a message list and processing indicator with basic styling
- Action system already supports namespace-based grouping with headers and custom visual properties
- Character portraits in speech bubbles are currently 100px wide (defined as `--portrait-size-large: 200px` in theme, used at 100px in speech bubbles)
- Interface uses a standard web application design without gaming-specific aesthetics
- Actions widget supports scrolling with max-height constraints and grouped display

This specification proposes a comprehensive redesign to transform the current functional web interface into an engaging narrative gaming experience. All file paths and class names marked as [TO BE CREATED] or [NEW FILE] represent proposed additions to the codebase.

## 1. Feature Overview

### 1.1 Purpose

The Narrative Theatre Interface Redesign transforms the Living Narrative Engine's main game interface from a basic three-panel web layout into an immersive, cinema-inspired gaming experience. The redesign prioritizes narrative presentation, character visual prominence, and dynamic mod-driven content scaling while maintaining all existing functionality.

### 1.2 Core Design Concept: "Narrative Theatre"

The "Narrative Theatre" concept treats the game interface as a theatrical stage where:

- **Story Stage**: The center panel becomes the primary narrative space with atmospheric backgrounds
- **Character Portraits**: Large (120x120px) character portraits are integrated directly within speech bubbles as the main visual feature
- **Dynamic Action Repertoire**: The bottom action area supports unlimited mod-driven categories with 30+ actions per category
- **Cast & Context**: Left panel provides character and scene context without round management
- **Scene Details**: Right panel displays location and character information

### 1.3 Key Differentiators

- **Portrait-Centric Design**: Character portraits become the primary visual element, prominently featured in dialogue
- **Dynamic Mod Support**: Action system scales to handle unlimited categories from mod system
- **Performance-Optimized**: Virtual scrolling and efficient rendering for large action sets
- **No Round Counting**: Design explicitly excludes any round, turn, or time progression counting
- **Atmospheric Immersion**: Rich backgrounds and gaming aesthetics replace basic web styling

## 2. Architecture & Design

### 2.1 System Architecture

```
Narrative Theatre Interface
├── Visual Layer (Enhanced CSS) [TO BE CREATED]
│   ├── css/themes/narrative-theatre.css [NEW FILE]
│   ├── css/components/_narrative-theatre-speech.css [NEW FILE]
│   ├── css/components/_dynamic-actions.css [NEW FILE]
│   └── css/components/_atmospheric-background.css [NEW FILE]
├── Layout Layer (Modified HTML Structure)
│   ├── Enhanced center panel (Story Stage)
│   ├── Portrait-integrated speech bubbles
│   ├── Dynamic action container
│   └── Contextual side panels
├── Interaction Layer (Enhanced JavaScript) [TO BE CREATED]
│   ├── Portrait loading and caching system [NEW CLASS: PortraitCache]
│   ├── Dynamic action category manager [ENHANCE: ActionButtonsRenderer]
│   ├── Virtual scrolling controller [NEW CLASS: VirtualActionScroller]
│   └── Responsive layout manager [NEW CLASS: NarrativeTheatreManager]
└── Integration Layer
    ├── Existing game logic (src/engine/gameEngine.js - unchanged)
    ├── Event system integration (existing ValidatedEventDispatcher)
    ├── Mod system compatibility (existing mod loading system)
    └── Accessibility compliance (enhance existing ARIA attributes)
```

### 2.2 Visual Design System

#### Color Palette - Gaming Atmosphere

```css
:root {
  /* Narrative Theatre Primary Palette */
  --nt-bg-primary: #1a202c; /* Deep navy base */
  --nt-bg-secondary: #2d3748; /* Medium slate */
  --nt-bg-narrative: linear-gradient(
    135deg,
    rgba(45, 52, 73, 0.95) 0%,
    rgba(28, 37, 59, 0.98) 100%
  );

  /* Character Speech Bubbles */
  --nt-speech-player: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  --nt-speech-npc: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
  --nt-speech-system: linear-gradient(135deg, #525f7f 0%, #37415c 100%);

  /* Action Categories - Dynamic Colors */
  --nt-action-intimacy: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  --nt-action-violence: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  --nt-action-clothing: linear-gradient(135deg, #f39c12 0%, #d35400 100%);
  --nt-action-social: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  --nt-action-movement: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
  --nt-action-fallback: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);

  /* Typography Colors */
  --nt-text-narrative: #f0f2f5; /* Main story text */
  --nt-text-dialogue: #e8eaf6; /* Character speech */
  --nt-text-ui-primary: #ffffff; /* Primary UI text */
  --nt-text-accent: #667eea; /* Accent/link text */
}
```

#### Typography System - Gaming Focus

```css
:root {
  /* Font Hierarchy */
  --nt-font-narrative: 'Merriweather', 'Georgia', serif;
  --nt-font-ui: 'Open Sans', 'Inter', sans-serif;
  --nt-font-display: 'Open Sans', 'Poppins', sans-serif;
  --nt-font-mono: 'Roboto Mono', 'Consolas', monospace;
}
```

### 2.3 Layout Structure

#### Enhanced HTML Structure

```html
<!-- Enhanced Center Panel - Story Stage -->
<main id="center-pane" class="panel narrative-theatre-stage">
  <div id="outputDiv" class="narrative-display">
    <ul id="message-list" class="narrative-content" aria-live="polite"></ul>
    <!-- Processing indicator unchanged -->
  </div>

  <!-- Enhanced Actions Widget - Dynamic Action Repertoire -->
  <div id="actions-widget" class="dynamic-action-container" role="region">
    <div class="action-search-bar">
      <input
        type="text"
        class="action-search-input"
        placeholder="Filter actions..."
      />
      <div class="action-filter-chips"></div>
    </div>
    <div id="action-categories" class="action-categories-container">
      <!-- Dynamically populated action categories -->
    </div>
  </div>
</main>
```

## 3. Core Component Specifications

### 3.1 Portrait-Integrated Speech Bubbles

#### Primary Feature: Prominent Character Portraits

Character portraits will become the **main visual feature** of the interface, increased from the current 100px to 120x120px and displayed prominently within enhanced speech bubbles.

```css
.speech-bubble-narrative-theatre {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--nt-speech-player);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  position: relative;
  margin-bottom: 16px;
  animation: bubbleSlideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.character-portrait-prominent {
  /* PROMINENT PORTRAIT - Main visual feature */
  width: 120px;
  height: 120px;
  min-width: 120px; /* Prevent shrinking */
  border-radius: 12px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 25px rgba(0, 0, 0, 0.4),
    inset 0 2px 0 rgba(255, 255, 255, 0.1);

  /* High-quality rendering */
  object-fit: cover;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;

  /* Interactive state */
  transition: all 0.3s ease;
  cursor: pointer;
}

.character-portrait-prominent:hover {
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow:
    0 12px 35px rgba(0, 0, 0, 0.5),
    0 0 0 4px rgba(255, 255, 255, 0.1);
}

.speech-content-narrative {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.character-name-prominent {
  font-family: var(--nt-font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--nt-text-ui-primary);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  margin-bottom: 4px;
}

.speech-text-narrative {
  font-family: var(--nt-font-ui);
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--nt-text-dialogue);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Character-specific portrait frames */
.speech-bubble-narrative-theatre.player .character-portrait-prominent {
  border-color: rgba(255, 215, 160, 0.4);
  box-shadow:
    0 8px 25px rgba(139, 90, 60, 0.4),
    inset 0 2px 0 rgba(255, 215, 160, 0.2);
}

.speech-bubble-narrative-theatre.npc .character-portrait-prominent {
  border-color: rgba(160, 174, 192, 0.4);
  box-shadow:
    0 8px 25px rgba(74, 85, 104, 0.4),
    inset 0 2px 0 rgba(160, 174, 192, 0.2);
}
```

#### Mobile Portrait Optimization

```css
@media (max-width: 768px) {
  .character-portrait-prominent {
    width: 100px;
    height: 100px;
    min-width: 100px;
  }

  .speech-bubble-narrative-theatre {
    padding: 16px;
    gap: 12px;
  }

  .character-name-prominent {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .speech-bubble-narrative-theatre {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .character-portrait-prominent {
    width: 140px;
    height: 140px;
    min-width: 140px;
  }
}
```

### 3.2 Dynamic Action System

#### Scalable Action Container Architecture

The action system will enhance the existing namespace-based grouping (currently in ActionButtonsRenderer) to support unlimited mod-driven categories with 30+ actions per category through virtual scrolling.

```css
.dynamic-action-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  background: rgba(45, 52, 73, 0.95);
  border-radius: 12px;
  contain: layout style paint;
  will-change: scroll-position;
}

.action-category-dynamic {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.category-header-expandable {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  user-select: none;
}

.category-title-dynamic {
  font-family: var(--nt-font-display);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--nt-text-ui-primary);
  text-transform: capitalize;
}

.category-count-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--nt-text-ui-primary);
}

.category-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
}

/* Virtual scrolling support for large action lists */
.action-list-virtualized {
  height: 200px;
  overflow-y: auto;
  contain: strict;
}

.action-card-dynamic {
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--nt-text-ui-primary);
  font-weight: 500;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  /* Text overflow handling */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-card-dynamic:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
  white-space: normal;
  z-index: 10;
}

/* Dynamic category colors based on data attributes */
.action-category-dynamic[data-category='intimacy'] .category-header-expandable {
  background: var(--nt-action-intimacy);
}

.action-category-dynamic[data-category='violence'] .category-header-expandable {
  background: var(--nt-action-violence);
}

.action-category-dynamic[data-category='clothing'] .category-header-expandable {
  background: var(--nt-action-clothing);
}

.action-category-dynamic[data-category='social'] .category-header-expandable {
  background: var(--nt-action-social);
}

.action-category-dynamic[data-category='movement'] .category-header-expandable {
  background: var(--nt-action-movement);
}

/* Generic fallback for unknown mod categories */
.action-category-dynamic:not([data-category='intimacy']):not(
    [data-category='violence']
  ):not([data-category='clothing']):not([data-category='social']):not(
    [data-category='movement']
  )
  .category-header-expandable {
  background: var(--nt-action-fallback);
}
```

#### Search and Filter Integration

```css
.action-search-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(45, 52, 73, 0.98);
  backdrop-filter: blur(10px);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.action-search-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: var(--nt-text-ui-primary);
  font-size: 0.95rem;
}

.action-search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.action-filter-chips {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 0.8rem;
  color: var(--nt-text-ui-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-chip.active {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}
```

### 3.3 Atmospheric Background System

#### Narrative Space Enhancement

Replace the empty gray void with rich atmospheric backgrounds.

```css
.narrative-theatre-stage {
  background: var(--nt-bg-narrative);
  position: relative;
  min-height: 400px;
}

.narrative-theatre-stage::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(
      circle at 25% 25%,
      rgba(255, 255, 255, 0.02) 1px,
      transparent 1px
    ),
    radial-gradient(
      circle at 75% 75%,
      rgba(255, 255, 255, 0.015) 1px,
      transparent 1px
    );
  background-size:
    40px 40px,
    60px 60px;
  pointer-events: none;
  z-index: 0;
}

.narrative-display {
  position: relative;
  z-index: 1;
  padding: 20px;
}

.narrative-content {
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Narrative text styling */
.narrative-text {
  font-family: var(--nt-font-narrative);
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--nt-text-narrative);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* System messages styling */
.system-message {
  font-family: var(--nt-font-mono);
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}
```

## 4. Performance Optimization Specifications

### 4.1 Virtual Scrolling Implementation [TO BE CREATED]

For handling large action sets (30+ per category):

```javascript
// NEW FILE: src/domUI/virtualActionScroller.js
class VirtualActionScroller {
  constructor(container, itemHeight = 50) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.visibleRange = { start: 0, end: 10 };
    this.scrollTop = 0;
    this.totalItems = 0;
  }

  updateVisibleRange() {
    const containerHeight = this.container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / this.itemHeight);
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);

    this.visibleRange = {
      start: Math.max(0, startIndex - 2), // Buffer above
      end: Math.min(this.totalItems, startIndex + visibleCount + 2), // Buffer below
    };
  }

  renderVisible(allActions) {
    this.updateVisibleRange();
    const visibleActions = allActions.slice(
      this.visibleRange.start,
      this.visibleRange.end
    );

    return visibleActions.map((action, index) =>
      this.createActionElement(action, this.visibleRange.start + index)
    );
  }
}
```

### 4.2 Portrait Caching System [TO BE CREATED]

```javascript
// NEW FILE: src/domUI/portraitCache.js
class PortraitCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.loadingPromises = new Map();
  }

  async loadPortrait(characterId, portraitUrl) {
    // Check cache first
    if (this.cache.has(characterId)) {
      return this.cache.get(characterId);
    }

    // Check if already loading
    if (this.loadingPromises.has(characterId)) {
      return this.loadingPromises.get(characterId);
    }

    // Start loading
    const loadPromise = this.loadAndCache(characterId, portraitUrl);
    this.loadingPromises.set(characterId, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(characterId);
      return result;
    } catch (error) {
      this.loadingPromises.delete(characterId);
      throw error;
    }
  }

  async loadAndCache(characterId, portraitUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = () => {
        // Create canvas for high-quality rendering
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');

        // Enable high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, 120, 120);
        const dataUrl = canvas.toDataURL('image/webp', 0.9);

        // Cache with LRU eviction
        this.addToCache(characterId, dataUrl);
        resolve(dataUrl);
      };

      img.onerror = () =>
        reject(new Error(`Failed to load portrait: ${portraitUrl}`));
      img.src = portraitUrl;
    });
  }

  addToCache(characterId, dataUrl) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(characterId, dataUrl);
  }
}
```

## 5. Accessibility Specifications

### 5.1 WCAG AA Compliance

#### Focus Management

```css
.focusable:focus-visible {
  outline: 3px solid var(--nt-text-accent);
  outline-offset: 2px;
  box-shadow:
    0 0 0 5px rgba(102, 126, 234, 0.2),
    0 8px 25px rgba(0, 0, 0, 0.2);
}

.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--nt-text-ui-primary);
  color: var(--nt-bg-primary);
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

#### Screen Reader Support

```html
<!-- Enhanced ARIA labels for speech bubbles -->
<div
  class="speech-bubble-narrative-theatre"
  role="article"
  aria-labelledby="speaker-name"
>
  <img
    class="character-portrait-prominent"
    alt="Character portrait of [Character Name]"
    aria-describedby="character-description"
  />
  <div class="speech-content-narrative">
    <h4 id="speaker-name" class="character-name-prominent">[Character Name]</h4>
    <p class="speech-text-narrative" aria-live="polite">[Speech content]</p>
  </div>
</div>

<!-- Enhanced action categories -->
<div
  class="action-category-dynamic"
  role="group"
  aria-labelledby="category-title"
>
  <button
    class="category-header-expandable"
    aria-expanded="false"
    aria-controls="category-actions"
    id="category-title"
  >
    <span class="category-title-dynamic">Intimacy</span>
    <span class="category-count-badge" aria-label="15 available actions"
      >15</span
    >
  </button>
  <div class="category-actions-grid" id="category-actions" role="group">
    <!-- Action buttons with enhanced labels -->
  </div>
</div>
```

### 5.2 Keyboard Navigation

```javascript
class KeyboardNavigationManager {
  constructor() {
    this.currentFocus = null;
    this.focusableElements = [];
    this.registerKeyboardHandlers();
  }

  registerKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Tab':
          this.handleTabNavigation(e);
          break;
        case 'Enter':
        case ' ':
          this.handleActivation(e);
          break;
        case 'Escape':
          this.handleEscape(e);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          this.handleVerticalNavigation(e);
          break;
      }
    });
  }

  updateFocusableElements() {
    this.focusableElements = Array.from(
      document.querySelectorAll(
        '.action-card-dynamic, .category-header-expandable, .character-portrait-prominent, .speech-text-narrative'
      )
    ).filter((el) => el.offsetParent !== null); // Visible elements only
  }

  handleTabNavigation(e) {
    this.updateFocusableElements();
    // Custom tab order: portraits → speech → actions
  }

  handleVerticalNavigation(e) {
    if (e.target.closest('.action-category-dynamic')) {
      e.preventDefault();
      this.navigateWithinCategory(e.key === 'ArrowUp' ? -1 : 1);
    }
  }
}
```

## 6. Mobile & Responsive Design Specifications

### 6.1 Breakpoint System

```css
:root {
  --nt-breakpoint-mobile: 480px;
  --nt-breakpoint-tablet: 768px;
  --nt-breakpoint-desktop: 1024px;
  --nt-breakpoint-large: 1440px;
}

/* Mobile-first responsive design */
@media (max-width: 480px) {
  .narrative-theatre-stage {
    padding: 12px;
  }

  .dynamic-action-container {
    max-height: 300px;
    padding: 12px;
  }

  .action-card-dynamic {
    min-height: 44px; /* Touch target size */
    margin: 4px 0;
  }

  .action-category-dynamic {
    margin-bottom: 8px;
  }
}

@media (max-width: 768px) {
  .app-layout-container {
    flex-direction: column;
    height: auto;
  }

  .panel {
    min-height: auto;
    flex: none;
  }

  #center-pane {
    order: 1;
  }

  #left-pane,
  #right-pane {
    order: 2;
  }
}
```

### 6.2 Touch Interactions

```css
/* Touch-friendly hover states */
@media (hover: none) {
  .action-card-dynamic:hover {
    transform: none;
  }

  .action-card-dynamic:active {
    transform: scale(0.98);
    transition-duration: 0.1s;
  }

  .character-portrait-prominent:hover {
    transform: none;
  }

  .character-portrait-prominent:active {
    transform: scale(1.02);
  }
}

/* Swipe gesture support */
.action-categories-container {
  touch-action: pan-y; /* Allow vertical scrolling, prevent horizontal */
}
```

## 7. JavaScript Integration Specifications

### 7.1 Portrait Integration Manager [TO BE CREATED]

```javascript
// NEW FILE: src/domUI/narrativeTheatreManager.js
class NarrativeTheatreManager {
  constructor() {
    this.portraitCache = new PortraitCache();
    this.actionScroller = null;
    this.keyboardNav = new KeyboardNavigationManager();
  }

  enhanceSpeechBubble(messageElement, characterData) {
    const bubble =
      messageElement.querySelector('.speech-bubble') ||
      this.createEnhancedSpeechBubble();

    // Add portrait if character data available
    if (characterData && characterData.portraitUrl) {
      this.addPortraitToBubble(bubble, characterData);
    }

    // Apply narrative theatre styling
    bubble.classList.add('speech-bubble-narrative-theatre');
    bubble.classList.add(characterData.type || 'npc');

    return bubble;
  }

  createEnhancedSpeechBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble-narrative-theatre';
    bubble.setAttribute('role', 'article');

    const speechContent = document.createElement('div');
    speechContent.className = 'speech-content-narrative';
    bubble.appendChild(speechContent);

    return bubble;
  }

  async addPortraitToBubble(bubble, characterData) {
    try {
      const portraitUrl = await this.portraitCache.loadPortrait(
        characterData.id,
        characterData.portraitUrl
      );

      const portrait = document.createElement('img');
      portrait.className = 'character-portrait-prominent';
      portrait.src = portraitUrl;
      portrait.alt = `Character portrait of ${characterData.name}`;
      portrait.setAttribute(
        'aria-describedby',
        `character-desc-${characterData.id}`
      );

      // Add portrait as first child
      bubble.insertBefore(portrait, bubble.firstChild);

      // Add character name prominence
      const nameElement =
        bubble.querySelector('.character-name') ||
        this.createCharacterNameElement(characterData.name);
      nameElement.classList.add('character-name-prominent');
    } catch (error) {
      console.warn('Failed to load character portrait:', error);
      // Continue without portrait
    }
  }

  createCharacterNameElement(name) {
    const nameEl = document.createElement('h4');
    nameEl.className = 'character-name-prominent';
    nameEl.textContent = name;
    return nameEl;
  }
}
```

### 7.2 Dynamic Action System Manager [TO BE CREATED]

```javascript
// NEW FILE: src/domUI/dynamicActionSystemManager.js
// Note: Will work alongside existing ActionButtonsRenderer
class DynamicActionSystemManager {
  constructor() {
    this.virtualScrollers = new Map();
    this.searchFilter = '';
    this.activeFilters = new Set();
  }

  enhanceActionContainer(actionContainer, actionData) {
    // Clear existing content
    actionContainer.innerHTML = '';

    // Add search bar
    const searchBar = this.createSearchBar();
    actionContainer.appendChild(searchBar);

    // Create categories container
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = 'action-categories-container';
    actionContainer.appendChild(categoriesContainer);

    // Render action categories
    this.renderActionCategories(categoriesContainer, actionData);

    // Apply narrative theatre styling
    actionContainer.classList.add('dynamic-action-container');
  }

  createSearchBar() {
    const searchBar = document.createElement('div');
    searchBar.className = 'action-search-bar';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'action-search-input';
    searchInput.placeholder = 'Filter actions...';
    searchInput.addEventListener('input', (e) => {
      this.searchFilter = e.target.value;
      this.filterActions();
    });

    const filterChips = document.createElement('div');
    filterChips.className = 'action-filter-chips';

    searchBar.appendChild(searchInput);
    searchBar.appendChild(filterChips);

    return searchBar;
  }

  renderActionCategories(container, actionData) {
    // Group actions by category
    const categories = this.groupActionsByCategory(actionData);

    // Render each category
    Object.entries(categories).forEach(([categoryName, actions]) => {
      const categoryElement = this.createActionCategory(categoryName, actions);
      container.appendChild(categoryElement);

      // Initialize virtual scroller if many actions
      if (actions.length > 20) {
        const actionsGrid = categoryElement.querySelector(
          '.category-actions-grid'
        );
        this.virtualScrollers.set(
          categoryName,
          new VirtualActionScroller(actionsGrid)
        );
      }
    });
  }

  createActionCategory(categoryName, actions) {
    const category = document.createElement('div');
    category.className = 'action-category-dynamic';
    category.setAttribute('data-category', categoryName.toLowerCase());
    category.setAttribute('role', 'group');
    category.setAttribute('aria-labelledby', `category-title-${categoryName}`);

    // Create expandable header
    const header = document.createElement('button');
    header.className = 'category-header-expandable';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', `category-actions-${categoryName}`);
    header.id = `category-title-${categoryName}`;

    const title = document.createElement('span');
    title.className = 'category-title-dynamic';
    title.textContent = categoryName;

    const count = document.createElement('span');
    count.className = 'category-count-badge';
    count.textContent = actions.length;
    count.setAttribute('aria-label', `${actions.length} available actions`);

    header.appendChild(title);
    header.appendChild(count);

    // Create actions grid
    const actionsGrid = document.createElement('div');
    actionsGrid.className = 'category-actions-grid';
    actionsGrid.id = `category-actions-${categoryName}`;
    actionsGrid.setAttribute('role', 'group');

    // Add toggle behavior
    header.addEventListener('click', () => {
      const expanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', !expanded);
      actionsGrid.style.display = expanded ? 'none' : 'grid';
    });

    // Populate actions
    this.populateActionGrid(actionsGrid, actions);

    category.appendChild(header);
    category.appendChild(actionsGrid);

    return category;
  }

  populateActionGrid(grid, actions) {
    actions.forEach((action) => {
      const actionButton = document.createElement('button');
      actionButton.className = 'action-card-dynamic';
      actionButton.textContent = action.name;
      actionButton.setAttribute('aria-describedby', `action-desc-${action.id}`);
      actionButton.addEventListener('click', () =>
        this.handleActionClick(action)
      );

      grid.appendChild(actionButton);
    });
  }

  groupActionsByCategory(actionData) {
    const categories = {};

    actionData.forEach((action) => {
      const category = action.category || 'General';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(action);
    });

    return categories;
  }

  filterActions() {
    // Implementation for search and filter functionality
    const visibleCategories = document.querySelectorAll(
      '.action-category-dynamic'
    );

    visibleCategories.forEach((category) => {
      const actions = category.querySelectorAll('.action-card-dynamic');
      let visibleCount = 0;

      actions.forEach((action) => {
        const matchesSearch =
          this.searchFilter === '' ||
          action.textContent
            .toLowerCase()
            .includes(this.searchFilter.toLowerCase());

        if (matchesSearch) {
          action.style.display = 'block';
          visibleCount++;
        } else {
          action.style.display = 'none';
        }
      });

      // Update count badge
      const countBadge = category.querySelector('.category-count-badge');
      countBadge.textContent = visibleCount;

      // Hide category if no visible actions
      category.style.display = visibleCount > 0 ? 'block' : 'none';
    });
  }

  handleActionClick(action) {
    // Integration with existing game action system
    if (window.gameActionHandler) {
      window.gameActionHandler.executeAction(action);
    }
  }
}
```

## 8. Implementation Phases

### Phase 1: Core Architecture (5-7 days)

**Priority 1: Portrait-Integrated Speech Bubbles**

1. Create enhanced CSS classes for prominent character portraits
2. Implement `NarrativeTheatreManager` class for portrait integration
3. Add `PortraitCache` system for high-quality portrait rendering
4. Modify existing speech bubble creation to include prominent portraits
5. Test portrait integration with existing character data

**Priority 2: Dynamic Action System Foundation**

1. Implement `DynamicActionSystemManager` class
2. Create expandable/collapsible action category containers
3. Add virtual scrolling support for large action lists (30+ per category)
4. Build search and filter functionality
5. Test with various mod-generated action sets

**Priority 3: Atmospheric Background**

1. Create narrative theatre CSS theme files
2. Replace empty gray void with rich gradient backgrounds
3. Add subtle texture patterns that complement character portraits
4. Ensure portrait prominence isn't diminished by background elements
5. Test contrast ratios for accessibility compliance

**Deliverables:**

- Prominent 120x120px character portraits in speech bubbles
- Dynamic action categories supporting unlimited mod content
- Rich atmospheric backgrounds replacing gray void
- Performance-optimized rendering for large action sets

### Phase 2: Visual Polish & Performance (3-4 days)

**Priority 1: Color System & Typography Implementation**

1. Implement narrative theatre color palette CSS custom properties
2. Apply gaming-specific typography hierarchy emphasizing character names
3. Create dynamic category colors based on action types
4. Test WCAG AA color contrast compliance with prominent portraits
5. Optimize font loading and rendering performance

**Priority 2: Performance Optimization**

1. Implement efficient DOM rendering for hundreds of characters
2. Add lazy loading for character portraits and action content
3. Optimize CSS for smooth scrolling and animations with large datasets
4. Profile and optimize memory usage for large action sets
5. Implement performance monitoring and metrics

**Priority 3: Animation & Interaction Polish**

1. Add smooth transitions for speech bubble appearance
2. Implement hover effects that emphasize character portraits
3. Create engaging micro-interactions for action categories
4. Add loading states and progress indicators
5. Optimize animations for 60fps performance

**Deliverables:**

- Complete narrative theatre visual design implementation
- Optimized performance for large-scale character and action rendering
- Smooth animations and interactions throughout interface
- Comprehensive accessibility compliance testing

### Phase 3: Mobile & Scalability Testing (2-3 days)

**Priority 1: Mobile Portrait Experience**

1. Ensure character portraits remain prominent on mobile (100-140px)
2. Implement touch-friendly action category navigation
3. Test portrait loading performance on mobile networks
4. Optimize touch interactions for speech bubbles and actions
5. Validate responsive layout across device sizes

**Priority 2: Scalability Stress Testing**

1. Test interface with 100+ character scenarios
2. Validate action system with 30+ actions per category across multiple categories
3. Profile memory usage and rendering performance under load
4. Test virtual scrolling performance with extreme datasets
5. Validate portrait caching efficiency with large character counts

**Priority 3: Cross-Browser & Accessibility Validation**

1. Test portrait rendering and performance across major browsers
2. Validate virtual scrolling and dynamic content with screen readers
3. Ensure keyboard navigation works seamlessly with new interface
4. Test with various accessibility tools and preferences
5. Validate touch interactions on different mobile platforms

**Deliverables:**

- Mobile-optimized experience maintaining portrait prominence
- Validated scalability for large character and action datasets
- Comprehensive cross-browser and accessibility testing
- Performance benchmarks and optimization recommendations

### Phase 4: Advanced Features & Integration (2-3 days)

**Priority 1: Enhanced User Experience**

1. Implement advanced search and filtering for actions
2. Add customizable display options (compact, comfortable, spacious)
3. Create keyboard shortcuts for common operations
4. Add copy/share functionality for speech content
5. Implement user preferences persistence

**Priority 2: Integration & Compatibility**

1. Ensure seamless integration with existing game event system
2. Test compatibility with all existing mods and action types
3. Validate integration with save/load game functionality
4. Test with various character concept and narrative configurations
5. Ensure backward compatibility with existing game saves

**Priority 3: Documentation & Deployment Preparation**

1. Create comprehensive component documentation
2. Document performance characteristics and limitations
3. Create troubleshooting guide for common issues
4. Prepare deployment checklist and rollback procedures
5. Document accessibility features and compliance

**Deliverables:**

- Complete narrative theatre interface ready for production
- Comprehensive testing and validation documentation
- Integration testing with all existing game systems
- Production deployment preparation and documentation

**Total Estimated Time: 12-17 days**

## 9. Testing Requirements

### 9.1 Visual Regression Testing

#### Portrait Integration Testing [TO BE CREATED]

```javascript
// NEW TEST FILE: tests/unit/domUI/narrativeTheatreManager.test.js
describe('Portrait Integration', () => {
  it('should render character portraits at 120x120px prominently within speech bubbles', () => {
    const speechBubble = createSpeechBubbleWithPortrait(mockCharacterData);
    const portrait = speechBubble.querySelector(
      '.character-portrait-prominent'
    );

    expect(portrait).toBeTruthy();
    expect(portrait.offsetWidth).toBe(120);
    expect(portrait.offsetHeight).toBe(120);
    expect(portrait.style.minWidth).toBe('120px');
  });

  it('should cache portraits for performance optimization', async () => {
    const cache = new PortraitCache();
    const portraitUrl = await cache.loadPortrait('char1', 'test-portrait.jpg');

    // Second load should be from cache
    const startTime = performance.now();
    const cachedUrl = await cache.loadPortrait('char1', 'test-portrait.jpg');
    const loadTime = performance.now() - startTime;

    expect(cachedUrl).toBe(portraitUrl);
    expect(loadTime).toBeLessThan(10); // Should be nearly instant from cache
  });
});
```

#### Dynamic Action System Testing [TO BE CREATED]

```javascript
// NEW TEST FILE: tests/unit/domUI/dynamicActionSystemManager.test.js
describe('Dynamic Action System', () => {
  it('should support unlimited action categories from mod system', () => {
    const mockActions = generateMockActions(50, 8); // 50 actions across 8 categories
    const actionManager = new DynamicActionSystemManager();
    const container = document.createElement('div');

    actionManager.enhanceActionContainer(container, mockActions);

    const categories = container.querySelectorAll('.action-category-dynamic');
    expect(categories.length).toBe(8);

    // Check that each category has proper structure
    categories.forEach((category) => {
      expect(
        category.querySelector('.category-header-expandable')
      ).toBeTruthy();
      expect(category.querySelector('.category-actions-grid')).toBeTruthy();
      expect(category.querySelector('.category-count-badge')).toBeTruthy();
    });
  });

  it('should handle 30+ actions per category with virtual scrolling', () => {
    const mockActions = generateMockActionsForCategory('intimacy', 35);
    const actionManager = new DynamicActionSystemManager();

    const category = actionManager.createActionCategory(
      'intimacy',
      mockActions
    );
    const actionsGrid = category.querySelector('.category-actions-grid');

    expect(actionsGrid.classList.contains('action-list-virtualized')).toBe(
      true
    );
    // Virtual scroller should be initialized
    expect(actionManager.virtualScrollers.has('intimacy')).toBe(true);
  });
});
```

### 9.2 Performance Testing

#### Large Scale Rendering

```javascript
describe('Performance Requirements', () => {
  it('should render 100+ character speech bubbles without performance degradation', async () => {
    const mockCharacters = generateMockCharacters(150);
    const startTime = performance.now();

    const narrativeManager = new NarrativeTheatreManager();
    const speechBubbles = await Promise.all(
      mockCharacters.map((char) =>
        narrativeManager.enhanceSpeechBubble(
          document.createElement('div'),
          char
        )
      )
    );

    const renderTime = performance.now() - startTime;

    expect(speechBubbles.length).toBe(150);
    expect(renderTime).toBeLessThan(2000); // Should complete within 2 seconds
  });

  it('should maintain smooth scrolling with large action datasets', () => {
    const mockActions = generateMockActions(500, 15); // 500 total actions
    const actionManager = new DynamicActionSystemManager();
    const container = document.createElement('div');

    actionManager.enhanceActionContainer(container, mockActions);

    // Simulate scroll events
    const scrollEvent = new Event('scroll');
    const startTime = performance.now();

    for (let i = 0; i < 50; i++) {
      container.dispatchEvent(scrollEvent);
    }

    const scrollTime = performance.now() - startTime;
    expect(scrollTime).toBeLessThan(100); // Should handle 50 scroll events in <100ms
  });
});
```

### 9.3 Accessibility Testing

#### WCAG Compliance

```javascript
describe('Accessibility Requirements', () => {
  it('should maintain WCAG AA color contrast ratios', () => {
    const testElement = document.createElement('div');
    testElement.className = 'speech-text-narrative';
    document.body.appendChild(testElement);

    const styles = getComputedStyle(testElement);
    const textColor = styles.color;
    const backgroundColor = styles.backgroundColor;

    const contrastRatio = calculateContrastRatio(textColor, backgroundColor);
    expect(contrastRatio).toBeGreaterThan(4.5); // WCAG AA requirement

    document.body.removeChild(testElement);
  });

  it('should support keyboard navigation through all interactive elements', () => {
    const container = createCompleteNarrativeInterface();
    const keyboardNav = new KeyboardNavigationManager();

    keyboardNav.updateFocusableElements();

    // Should include portraits, speech bubbles, and action cards
    const focusableCount = keyboardNav.focusableElements.length;
    expect(focusableCount).toBeGreaterThan(10);

    // Tab navigation should work
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    expect(() => keyboardNav.handleTabNavigation(tabEvent)).not.toThrow();
  });

  it('should provide proper ARIA labels and descriptions', () => {
    const speechBubble = createSpeechBubbleWithPortrait(mockCharacterData);

    expect(speechBubble.getAttribute('role')).toBe('article');
    expect(speechBubble.getAttribute('aria-labelledby')).toBeTruthy();

    const portrait = speechBubble.querySelector(
      '.character-portrait-prominent'
    );
    expect(portrait.getAttribute('alt')).toContain('Character portrait');
    expect(portrait.getAttribute('aria-describedby')).toBeTruthy();
  });
});
```

### 9.4 Integration Testing

#### Game System Compatibility

```javascript
describe('Game System Integration', () => {
  it('should integrate with existing action execution system', () => {
    const mockAction = {
      id: 'test-action',
      name: 'Test Action',
      category: 'social',
    };
    const actionManager = new DynamicActionSystemManager();

    // Mock existing game handler
    window.gameActionHandler = {
      executeAction: jest.fn(),
    };

    actionManager.handleActionClick(mockAction);

    expect(window.gameActionHandler.executeAction).toHaveBeenCalledWith(
      mockAction
    );
  });

  it('should maintain compatibility with existing speech bubble rendering', () => {
    const existingMessage = createExistingSpeechBubble();
    const narrativeManager = new NarrativeTheatreManager();

    const enhancedBubble = narrativeManager.enhanceSpeechBubble(
      existingMessage,
      mockCharacterData
    );

    // Should preserve existing functionality while adding enhancements
    expect(enhancedBubble.querySelector('.speech-content')).toBeTruthy();
    expect(
      enhancedBubble.classList.contains('speech-bubble-narrative-theatre')
    ).toBe(true);
  });
});
```

## 10. Success Metrics & Acceptance Criteria

### 10.1 Visual Design Metrics

**Character Portrait Prominence**

- ✅ Character portraits displayed at exactly 120x120px in speech bubbles
- ✅ Portraits are the most visually prominent element in dialogue sections
- ✅ Portrait loading completes within 2 seconds on average
- ✅ Portrait quality maintained at high resolution (120px minimum)
- ✅ Portrait caching reduces repeat loads by >90%

**Dynamic Action System**

- ✅ Support for unlimited mod-driven action categories
- ✅ Smooth performance with 30+ actions per category
- ✅ Category expansion/collapse animations complete within 300ms
- ✅ Virtual scrolling maintains 60fps with large action sets
- ✅ Search and filter results appear within 100ms

**Atmospheric Background**

- ✅ Empty gray void completely replaced with rich atmospheric design
- ✅ Background enhances rather than distracts from character portraits
- ✅ WCAG AA contrast ratios maintained throughout interface
- ✅ No visual performance degradation with animated backgrounds

### 10.2 Performance Metrics

**Rendering Performance**

- ✅ Initial page load completes within 3 seconds
- ✅ Speech bubble rendering with portraits completes within 500ms
- ✅ Action category rendering completes within 200ms
- ✅ Smooth 60fps scrolling maintained with 100+ speech bubbles
- ✅ Memory usage remains stable during extended gameplay sessions

**Scalability Metrics**

- ✅ Interface supports 100+ concurrent character portraits without degradation
- ✅ Action system handles 500+ total actions across all categories
- ✅ Virtual scrolling maintains performance with datasets >1000 items
- ✅ Portrait caching prevents memory leaks during long sessions
- ✅ Mobile performance maintained on devices with 2GB RAM minimum

### 10.3 User Experience Metrics

**Accessibility Compliance**

- ✅ Full WCAG 2.1 AA compliance achieved
- ✅ Screen reader compatibility verified with NVDA, JAWS, and VoiceOver
- ✅ Keyboard navigation covers all interactive elements
- ✅ Touch target sizes meet 44px minimum requirement on mobile
- ✅ Color-blind accessibility verified with protanopia/deuteranopia simulation

**Mobile Responsiveness**

- ✅ Character portraits remain prominent (100-140px) on all mobile devices
- ✅ Touch interactions work smoothly on iOS and Android
- ✅ Responsive layout maintains usability on screens 320px and wider
- ✅ Swipe gestures function correctly for action category navigation
- ✅ Mobile performance matches desktop experience

**Integration Compatibility**

- ✅ Seamless integration with existing game save/load functionality
- ✅ All existing mods continue to function without modification
- ✅ Backward compatibility maintained with existing game saves
- ✅ Event system integration works without conflicts
- ✅ No breaking changes to existing character or action data structures

### 10.4 Quality Metrics

**Code Quality Standards**

- ✅ All JavaScript classes follow Living Narrative Engine architecture patterns
- ✅ CSS follows established component structure and naming conventions
- ✅ Performance optimization code documented and maintainable
- ✅ Error handling covers all portrait loading and rendering edge cases
- ✅ Comprehensive unit and integration test coverage >80%

**User Feedback Integration**

- ✅ Character portraits significantly improve character recognition
- ✅ Interface feels more engaging and game-like than previous version
- ✅ Action discovery improved with dynamic categorization
- ✅ Overall user satisfaction with interface aesthetics increased
- ✅ No user reports of accessibility barriers or usability issues

## 11. Risks & Mitigation Strategies

### 11.1 Technical Risks

**High Priority Risks:**

**Risk: Portrait Loading Performance Issues**

- **Impact**: Slow or failed portrait loading degrades core feature
- **Mitigation**:
  - Implement comprehensive caching with LRU eviction
  - Add progressive loading with low-res placeholders
  - Graceful fallback to text-only when portraits fail
  - Performance monitoring and optimization alerts

**Risk: Virtual Scrolling Complexity**

- **Impact**: Poor performance or broken UI with large action sets
- **Mitigation**:
  - Use proven virtual scrolling libraries where possible
  - Implement thorough testing with extreme datasets (1000+ actions)
  - Add fallback to standard scrolling for smaller datasets
  - Performance profiling and optimization

**Risk: Mobile Performance Degradation**

- **Impact**: Unusable interface on mobile devices
- **Mitigation**:
  - Mobile-first development approach
  - Regular testing on actual devices (not just simulators)
  - Performance budgets specifically for mobile
  - Progressive enhancement for advanced features

**Medium Priority Risks:**

**Risk: CSS Complexity and Maintainability**

- **Impact**: Difficult to maintain and extend styling system
- **Mitigation**:
  - Follow established CSS architecture patterns
  - Comprehensive documentation of design system
  - Modular CSS with clear component boundaries
  - Regular refactoring and optimization

**Risk: Accessibility Regression**

- **Impact**: Interface becomes less accessible than current version
- **Mitigation**:
  - Automated accessibility testing in CI/CD pipeline
  - Regular manual testing with screen readers
  - Accessibility review at each development phase
  - User testing with accessibility community

### 11.2 User Experience Risks

**Risk: Interface Overwhelming for New Users**

- **Impact**: Reduced user adoption and satisfaction
- **Mitigation**:
  - Progressive disclosure of advanced features
  - Comprehensive onboarding and help documentation
  - User testing with first-time users
  - Customizable complexity levels

**Risk: Existing User Workflow Disruption**

- **Impact**: Existing users struggle with interface changes
- **Mitigation**:
  - Maintain all existing functionality
  - Optional migration guide and tutorial
  - Feedback collection and rapid iteration
  - Consider optional "classic" mode if needed

### 11.3 Integration Risks

**Risk: Breaking Changes to Existing Game Logic**

- **Impact**: Game becomes unstable or loses data
- **Mitigation**:
  - Comprehensive integration testing with existing systems
  - No modifications to core game data structures
  - Extensive backward compatibility testing
  - Rollback plan and procedures documented

**Risk: Mod System Compatibility Issues**

- **Impact**: Existing mods stop working or perform poorly
- **Mitigation**:
  - Test with all existing mod types and configurations
  - Maintain existing mod API completely unchanged
  - Performance testing with complex mod combinations
  - Community beta testing with mod developers

## 12. Documentation Requirements

### 12.1 Technical Documentation

**Component Documentation**

- Comprehensive API documentation for all new classes
- CSS component library with usage examples
- Performance characteristics and optimization guidelines
- Integration patterns for future enhancements

**Architecture Documentation**

- Visual design system specification
- Component interaction diagrams
- Data flow documentation for portrait and action systems
- Performance monitoring and debugging guides

### 12.2 User Documentation

**Feature Documentation**

- Visual guide to new interface elements
- Character portrait feature benefits and usage
- Dynamic action system explanation
- Accessibility features and keyboard shortcuts

**Troubleshooting Documentation**

- Common issues and solutions
- Performance optimization tips for users
- Accessibility customization options
- Browser compatibility information

### 12.3 Developer Documentation

**Maintenance Documentation**

- Code architecture overview and design decisions
- Testing strategy and automation setup
- Performance monitoring and optimization procedures
- Future enhancement guidelines and patterns

**Contribution Documentation**

- Development environment setup
- Code style and architecture guidelines
- Testing requirements and procedures
- Review and deployment processes

## 13. Future Enhancement Opportunities

### 13.1 Near-term Enhancements (Next 6 months)

**Advanced Portrait Features**

- Animated portraits for enhanced character expression
- Portrait mood/emotion detection and display
- Dynamic portrait lighting based on scene context
- Portrait customization and editing tools

**Enhanced Action System**

- Action history and frequency analytics
- Personalized action recommendations
- Action combination and macro creation
- Advanced filtering by character relationships

### 13.2 Long-term Vision (6-18 months)

**AI-Powered Interface Enhancement**

- Intelligent action suggestion based on narrative context
- Automatic character portrait generation from descriptions
- Dynamic interface adaptation based on user preferences
- Narrative flow optimization with visual cues

**Advanced Immersion Features**

- Sound integration with portrait animations
- Dynamic background changes based on location/mood
- Particle effects and atmospheric enhancements
- VR/AR interface adaptation for future platforms

**Community Features**

- Portrait sharing and community galleries
- Interface theme creation and sharing
- Collaborative storytelling visual enhancements
- Integration with external character portrait services

## 14. Deployment & Rollback Strategy

### 14.1 Deployment Plan

**Phase 1: Internal Testing (Week 1)**

- Deploy to staging environment with full feature set
- Comprehensive testing with development team
- Performance benchmarking and optimization
- Accessibility audit and fixes

**Phase 2: Beta Testing (Week 2-3)**

- Limited beta release to selected community members
- Feedback collection and rapid iteration
- Performance monitoring under real usage conditions
- Bug fixes and stability improvements

**Phase 3: Gradual Production Rollout (Week 4)**

- Feature flag controlled rollout starting at 10% of users
- Real-time monitoring of performance metrics and error rates
- Gradual increase to 50% then 100% based on metrics
- Immediate rollback capability maintained throughout

**Phase 4: Full Production (Week 5)**

- Complete rollout to all users
- Continuous monitoring and performance optimization
- User feedback collection and prioritization
- Planning for next iteration based on user response

### 14.2 Rollback Procedures

**Immediate Rollback Triggers**

- Error rate increase >5% above baseline
- Performance degradation >25% on any metric
- Critical accessibility failures
- Data loss or corruption reports

**Rollback Process**

1. Feature flag immediate disable (<30 seconds)
2. CDN cache invalidation for CSS/JS assets (<2 minutes)
3. Database rollback if any schema changes (<5 minutes)
4. User notification and communication plan activation
5. Post-incident analysis and improvement planning

## 15. Sign-off Criteria

### 15.1 Development Complete

- [ ] All four implementation phases completed successfully
- [ ] Character portraits display prominently at 120x120px in all speech bubbles
- [ ] Dynamic action system supports unlimited categories with 30+ actions each
- [ ] Atmospheric background completely replaces empty gray void
- [ ] Virtual scrolling performance validated with large datasets
- [ ] Portrait caching system implemented and optimized
- [ ] Mobile responsiveness verified across all target devices
- [ ] Code review completed with no critical issues
- [ ] Comprehensive documentation delivered

### 15.2 Quality Assurance

- [ ] All automated tests passing with >80% code coverage
- [ ] Manual testing completed across all supported browsers and devices
- [ ] WCAG 2.1 AA accessibility compliance verified
- [ ] Performance benchmarks met for all success metrics
- [ ] Security review completed with no vulnerabilities
- [ ] Integration testing with all existing game systems passed
- [ ] Backward compatibility with existing saves and mods verified
- [ ] Load testing completed with 100+ concurrent users

### 15.3 User Experience Validation

- [ ] Beta testing completed with positive user feedback
- [ ] Accessibility testing completed with assistive technology users
- [ ] Mobile user experience validated on actual devices
- [ ] Character portrait prominence confirmed as main visual feature
- [ ] Action discovery and usage improved over previous interface
- [ ] No critical usability issues identified
- [ ] Performance acceptable on minimum spec devices
- [ ] User documentation comprehensive and clear

### 15.4 Deployment Readiness

- [ ] Production build optimized and tested
- [ ] Deployment automation tested and verified
- [ ] Rollback procedures tested and documented
- [ ] Monitoring and alerting configured for all critical metrics
- [ ] Error tracking and logging systems configured
- [ ] Performance monitoring dashboards created
- [ ] Support team trained on new interface features
- [ ] User communication plan prepared and reviewed

---

**Document Version**: 1.0.0  
**Created**: 2025-08-25  
**Last Updated**: 2025-08-25  
**Status**: APPROVED FOR IMPLEMENTATION  
**Implementation Status**: NOT STARTED  
**Owner**: Living Narrative Engine Development Team  
**Review Date**: Pre-implementation and post-deployment

_This specification represents the complete requirements and implementation guidelines for transforming the game.html interface into the Narrative Theatre design. Implementation must follow this specification exactly, with any deviations requiring approval and specification updates._
