## FEATURE:

Important: your current goal is to create a PRP document. No code modifications should be made at this stage.

Recently we created the page anatomy-visualizer.html, whose entry is the code src/anatomy-visualizer.js . To set up that page, code duplication was created, as the initialization process for the page where the game runs ( game.html ), that is launched through src/main.js , is geared solely towards starting the game.

We created a report for the refactoring opportunities to reduce the code duplication between both initialization routes. It's in reports/anatomy-visualizer-refactoring-analysis.md

Your task is to create a comprehensive PRP document to implement the refactorings specified in that document.

## EXAMPLES:

You have an integration test suite for the anatomy visualizer in tests/integration/domUI/AnatomyVisualizerUI.integration.test.js

## DOCUMENTATION:

None in particular.

## OTHER CONSIDERATIONS:

Given that these refactorings will affect the initialization of both the regular game as well as the anatomy visualization page, it will be necessary to run 'npm run test' and carefully fix any issues.
