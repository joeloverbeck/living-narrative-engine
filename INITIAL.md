## FEATURE:

In the anatomy visualizer panel where the entity's description must appear, the text doesn't appear correctly: "Hair: long, blonde, wavy Eyes: green, almond Breasts: G-cup, meaty, soft Legs: long, shapely Pubic_hair: curly". There are two issues with it:

1) "Pubic_hair" should be instead "Pubic hair". Whatever definition from entity formatting, or possible the code that generates the descriptions, most be modified to change that.
2) Although the automatic description for the entity is supposed to include an "\n" after each individual body part description, it's either not doing it, or the panel in the anatomy visualizer that is supposed to render the line breaks correctly isn't processing it. This also happens in the LocationRenderer; the user has the option to show the description of any character present in the location by hovering over with the mouse, and the line breaks aren't processed there correctly either.

Note: do not modify any code during this stage. Your goal is to create a comprehensive PRP to implement these changes.

## EXAMPLES:

You have lots of integration suits for the anatomy system in tests/integration/anatomy/
The page and code for the visualizer are: anatomy-visualizer.html and src/anatomy-visualizer.js
The code for the LocationRenderer is in src/domUI/locationRenderer.js
The configuration for the anatomy formatter is in data/mods/anatomy/anatomy-formatting/default.json

## DOCUMENTATION:

None in particular.

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
