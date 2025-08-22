# Index.html UI Redesign Specification

## Overview

This specification defines the redesign of the main index.html page for the Living Narrative Engine to transform it from a plain list of buttons into a visually appealing, categorized interface that better represents the application's capabilities.

## Current State Analysis

### Existing Layout
- Centered vertical layout with basic styling
- Simple heading "Living Narrative Engine" (3rem font size)
- 8 undifferentiated buttons in vertical arrangement:
  - Start New Game
  - Load Game  
  - Anatomy Visualizer
  - Character Concepts Manager
  - Thematic Direction Generator
  - Thematic Directions Manager
  - Clichés Generator
  - Core Motivations Generator
- Minimal CSS styling with basic hover states
- No visual hierarchy or categorization

### Available Assets
- Logo: `android-chrome-192x192.png` (green "LNE" geometric design)
- Existing CSS framework in `css/style.css`

## Design Goals

1. **Visual Hierarchy**: Create clear information architecture
2. **Categorization**: Group related functionality logically
3. **Brand Identity**: Incorporate the LNE logo prominently
4. **Accessibility**: Maintain WCAG AA compliance
5. **User Experience**: Improve navigation and discoverability
6. **Responsive Design**: Work across device sizes

## Design Specification

### 1. Layout Structure

#### Header Section
```
┌─────────────────────────────────────────┐
│  [Logo]  Living Narrative Engine        │
│                                         │
│  Tagline: "Create immersive narratives" │
└─────────────────────────────────────────┘
```

**Specifications:**
- Logo positioned left-aligned, 64px height
- Title text: 2.5rem, maintain current font
- Tagline: 1rem, subtitle styling, muted color
- Total header height: ~120px

#### Main Content Grid
```
┌─────────────────────────────────────────────────────────────┐
│                     GAME OPERATIONS                        │
│  ┌─────────────┐        ┌─────────────┐                    │
│  │   🎮        │        │   📁        │                    │
│  │             │        │             │                    │
│  │ Start New   │        │ Load Game   │                    │
│  │   Game      │        │             │                    │
│  └─────────────┘        └─────────────┘                    │
│                                                             │
│                    ANATOMY SYSTEM                          │
│                 ┌─────────────┐                            │
│                 │   🫀        │                            │
│                 │             │                            │
│                 │  Anatomy    │                            │
│                 │ Visualizer  │                            │
│                 └─────────────┘                            │
│                                                             │
│                 CHARACTER BUILDING                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   👤     │  │   💭     │  │   📋     │  │   ✨     │   │
│  │          │  │          │  │          │  │          │   │
│  │Character │  │Thematic  │  │Thematic  │  │ Clichés  │   │
│  │Concepts  │  │Direction │  │Direction │  │Generator │   │
│  │ Manager  │  │Generator │  │ Manager  │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│                 ┌─────────────┐                            │
│                 │   🧠        │                            │
│                 │             │                            │
│                 │Core Motiv.  │                            │
│                 │ Generator   │                            │
│                 └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Button Categories & Styling

#### Game Operations (Green Theme)
**Color Palette:**
- Primary: `#8BC34A` (matching logo green)
- Hover: `#7CB342`
- Text: `#2E7D32`
- Background: `#F1F8E9`

**Buttons:**
1. **Start New Game** 
   - Icon: 🎮 (game controller)
   - Action: Launch new game
   
2. **Load Game**
   - Icon: 📁 (folder)
   - Action: Load existing save

#### Anatomy System (Blue Theme)  
**Color Palette:**
- Primary: `#2196F3`
- Hover: `#1976D2`
- Text: `#0D47A1`
- Background: `#E3F2FD`

**Buttons:**
1. **Anatomy Visualizer**
   - Icon: 🫀 (anatomical heart)
   - Action: Open anatomy visualization tool

#### Character Building (Purple/Orange Theme)
**Color Palette:**
- Primary: `#FF9800` (orange) / `#9C27B0` (purple)
- Hover: `#F57C00` / `#7B1FA2`
- Text: `#E65100` / `#4A148C`
- Background: `#FFF3E0` / `#F3E5F5`

**Buttons:**
1. **Character Concepts Manager**
   - Icon: 👤 (person silhouette)
   - Color: Orange theme
   
2. **Thematic Direction Generator**
   - Icon: 💭 (thought bubble)
   - Color: Purple theme
   
3. **Thematic Directions Manager**
   - Icon: 📋 (clipboard)
   - Color: Orange theme
   
4. **Clichés Generator**
   - Icon: ✨ (sparkles)
   - Color: Purple theme
   
5. **Core Motivations Generator**
   - Icon: 🧠 (brain)
   - Color: Orange theme

### 3. Button Design Specifications

#### Layout & Dimensions
- Button size: 180px × 140px
- Icon area: 80px × 60px (upper portion)
- Text area: 100px × 80px (lower portion)
- Border radius: 12px
- Margin: 16px between buttons
- Grid gap: 24px between sections

#### Typography
- Button text: 14px, font-weight: 500
- Line height: 1.2
- Text alignment: center
- Max 2 lines with text truncation

#### Icon Specifications
- Size: 32px × 32px
- Position: Center-aligned in upper 60px of button
- Margin-bottom: 8px from text
- Use Unicode emoji initially (can be replaced with custom icons later)

#### Interaction States
```css
/* Normal State */
button {
  background: [category-background];
  border: 2px solid [category-primary];
  color: [category-text];
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Hover State */
button:hover {
  background: [category-primary];
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

/* Focus State */
button:focus {
  outline: 3px solid [category-primary];
  outline-offset: 2px;
}

/* Active State */
button:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
```

### 4. Responsive Design

#### Desktop (1200px+)
- 4-column grid for Character Building section
- 2-column grid for Game Operations
- 1-column for Anatomy System
- Container max-width: 1200px

#### Tablet (768px - 1199px)
- 2-column grid for Character Building section
- 2-column grid for Game Operations
- 1-column for Anatomy System
- Container padding: 32px

#### Mobile (< 768px)
- 1-column grid for all sections
- Button width: 90vw (max 300px)
- Container padding: 16px
- Reduced spacing between sections

### 5. Accessibility Features

#### Keyboard Navigation
- Tab order follows logical reading sequence
- Visual focus indicators with high contrast
- Enter/Space key activation

#### Screen Reader Support
- Semantic section headings (h2 level)
- Descriptive button text
- ARIA labels where needed
- Proper color contrast ratios (minimum 4.5:1)

#### Color & Visual Design
- Icons supplement, not replace, text labels
- Color coding provides additional context, not primary meaning
- High contrast mode compatibility

### 6. Section Headers

Each category should have a clear header:

```html
<section class="button-category">
  <h2 class="category-title">Game Operations</h2>
  <div class="category-description">Start playing or continue your adventure</div>
  <div class="button-grid">
    <!-- buttons -->
  </div>
</section>
```

**Header Styling:**
- Title: 1.5rem, font-weight: 600
- Description: 1rem, muted color
- Margin-bottom: 24px

### 7. CSS Class Structure

```css
.main-header {
  /* Header section with logo and title */
}

.logo {
  /* Logo styling */
}

.main-title {
  /* Main title styling */
}

.tagline {
  /* Subtitle/tagline styling */
}

.main-content {
  /* Main content container */
}

.button-category {
  /* Category section wrapper */
}

.category-title {
  /* Category heading */
}

.category-description {
  /* Category description */
}

.button-grid {
  /* Grid layout for buttons */
}

.nav-button {
  /* Base button class */
}

.nav-button--game {
  /* Game category buttons */
}

.nav-button--anatomy {
  /* Anatomy category buttons */
}

.nav-button--character {
  /* Character building buttons */
}

.button-icon {
  /* Icon styling within buttons */
}

.button-text {
  /* Text styling within buttons */
}
```

### 8. Implementation Priority

1. **Phase 1**: HTML structure and basic CSS grid
2. **Phase 2**: Button styling and hover states
3. **Phase 3**: Icon integration and refinement
4. **Phase 4**: Responsive design and mobile optimization
5. **Phase 5**: Accessibility testing and refinement

### 9. Future Enhancements

- Custom SVG icons to replace Unicode emoji
- Subtle animations and micro-interactions
- Category expansion/collapse functionality
- Recently used functionality indicators
- Integration with user preferences/themes

## Technical Notes

- Maintain existing JavaScript event handlers
- Preserve current routing and navigation
- Use CSS Grid and Flexbox for layout
- Consider CSS custom properties for theming
- Ensure compatibility with existing CSS framework

## Success Metrics

- Improved visual hierarchy and navigation clarity
- Maintained accessibility compliance (WCAG AA)
- Responsive design across all device sizes
- Enhanced brand presence through logo integration
- Logical categorization improving user workflow