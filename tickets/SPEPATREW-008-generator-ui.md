# SPEPATREW-008: Update Speech Patterns Generator UI Display

## Objective
Update the UI in `speech-patterns-generator.html` to display structured speech patterns grouped by category with context tags, and fix animation issues causing patterns to disappear.

## Priority
**Medium** - UI enhancement and bug fix

## Estimated Effort
1 day

## Dependencies
- **SPEPATREW-007** must be completed (processor validates structured format)

## Files to Touch
- `speech-patterns-generator.html` (update display rendering)
- Embedded `<style>` section in same file (CSS updates)
- Embedded `<script>` section in same file (display logic)

## Implementation Details

### HTML Structure Changes

**Current**: Simple list
```html
<ul class="patterns-list">
  <li>pattern text</li>
</ul>
```

**New**: Grouped structure
```html
<div class="speech-patterns">
  <div class="pattern-group">
    <h3 class="pattern-type">Feline Verbal Tics</h3>
    <div class="pattern-contexts">
      <span class="context-label">Contexts:</span>
      <span class="context-tag">casual</span>
      <span class="context-tag">manipulative</span>
    </div>
    <div class="pattern-examples">
      <span class="examples-label">Examples:</span>
      <ul>
        <li>"Oh meow-y goodness..."</li>
        <li>"Purr-haps you could..."</li>
      </ul>
    </div>
  </div>
</div>
```

### CSS Additions
Add styles for:
- `.pattern-group` - Container for each category
- `.pattern-type` - Category heading
- `.pattern-contexts` - Context tags section
- `.context-tag` - Individual context badge
- `.pattern-examples` - Examples section
- Responsive design for context tags
- Stable animations (no disappearing)

### JavaScript Display Logic
Update pattern rendering to:
1. Detect if patterns are structured or legacy
2. Render structured format with grouping
3. Render legacy format as simple list
4. Handle both formats gracefully

### Animation Fix Investigation
1. Identify problematic animations/transitions
2. Replace with stable alternatives
3. Use opacity transitions only (no transform or height)
4. Test thoroughly for disappearing content
5. Ensure patterns remain visible after generation

### Key CSS Changes
```css
/* Replace problematic animations */
.pattern-group {
  opacity: 1;
  transition: opacity 0.3s ease-in;
}

.pattern-group.entering {
  opacity: 0;
}

/* Avoid height/transform animations */
/* Avoid animations on dynamically sized content */
```

## Out of Scope
- **DO NOT** modify backend services
- **DO NOT** change response processing logic
- **DO NOT** update prompt generation
- **DO NOT** modify export functionality (covered in SPEPATREW-009)
- **DO NOT** add new features beyond structured display
- **DO NOT** change LLM integration
- **DO NOT** modify other HTML files

## Acceptance Criteria

### Visual Display Tests (Manual)
1. Structured patterns display in grouped format
2. Each group has visible category heading
3. Context tags render as styled badges
4. Examples list properly indented
5. Multiple groups separated clearly
6. Legacy patterns still display as simple list
7. No patterns disappear after generation
8. Smooth fade-in animation for new patterns
9. Responsive design works on narrow screens
10. Context tags wrap properly when many

### Animation Tests (Manual)
11. Generate patterns multiple times - no disappearing
12. Patterns remain visible throughout animation
13. No flickering or jumping during transitions
14. Scroll behavior smooth and predictable
15. No layout shifts after animation completes

### Format Detection Tests
16. Structured format automatically uses grouped display
17. Legacy format automatically uses simple list
18. Detection works on page load
19. Detection works after generation

### Accessibility Tests
20. Semantic HTML used (h3 for headings, ul for lists)
21. Proper heading hierarchy
22. Color contrast meets WCAG AA
23. Keyboard navigation works
24. Screen reader compatible structure

### Invariants
- File remains single HTML file
- All JavaScript remains embedded
- All CSS remains embedded
- No external dependencies added
- Export functionality unchanged
- Generation workflow unchanged
- Backward compatible with legacy format display

## Validation Commands
```bash
# Type check (if applicable)
npm run typecheck

# Lint HTML/JS (if linter configured)
npm run lint

# Manual testing required - see checklist
```

## Manual Testing Checklist
```
[ ] Open speech-patterns-generator.html in browser
[ ] Load character with structured patterns
[ ] Verify grouped display renders correctly
[ ] Check context tags display
[ ] Check examples format properly
[ ] Generate new patterns 5 times
[ ] Verify no disappearing content
[ ] Test with legacy format patterns
[ ] Verify simple list displays
[ ] Test on mobile viewport size
[ ] Test keyboard navigation
[ ] Test with screen reader (if available)
```

## Animation Bug Investigation Steps
1. Open browser DevTools
2. Inspect `.pattern-group` elements
3. Check computed styles during animation
4. Identify problematic CSS properties
5. Test with `animation: none !important;`
6. Isolate causing property
7. Replace with stable alternative
8. Verify fix with repeated generations

## Definition of Done
- [ ] Structured format displays with grouping
- [ ] Category headings styled correctly
- [ ] Context tags render as badges
- [ ] Examples properly indented
- [ ] Legacy format still displays as list
- [ ] Animation issue fixed (no disappearing)
- [ ] Manual testing checklist completed
- [ ] Responsive design verified
- [ ] Accessibility requirements met
- [ ] Code review completed
- [ ] Screenshots documented for review
