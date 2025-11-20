# Visual Testing

This directory contains browser-based visual tests that require manual interaction and visual verification.

## Files

### movement-action-test.html

Browser-based visual test for movement actions.

**Purpose**: Visual verification of movement action rendering and interaction in a browser environment.

**How to Use**:
1. Open the file directly in a web browser:
   ```bash
   # Option 1: Direct file open
   open tests/visual/movement-action-test.html  # macOS
   xdg-open tests/visual/movement-action-test.html  # Linux
   start tests/visual/movement-action-test.html  # Windows

   # Option 2: Via development server
   npm run start
   # Then navigate to: http://localhost:8080/tests/visual/movement-action-test.html
   ```

2. Follow the on-screen instructions to verify movement actions

**When to Use**:
- After modifying movement action rendering
- Before releasing movement-related features
- When investigating visual or interaction bugs

**Note**: This is a manual test requiring human visual verification and cannot be automated.
