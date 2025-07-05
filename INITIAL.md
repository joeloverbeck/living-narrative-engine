## FEATURE:

Important: you shouldn't modify any code at this stage. The goal is to create a comprehensive PRP.

I'm analyzing body graphs in the anatomy visualizer. The page is anatomy-visualizer.html , and the main code is at src/anatomy-visualizer.js . I've noticed that when I load the body graph of a character whose recipe uses the data/mods/anatomy/blueprints/human_male.blueprints.json , that defines body parts for the "left_testicle" and "right_testicle" sockets, they appear as the plural "Testicle" instead of "Testicles" in the automatic description: "Testicle: small, oval". That likely means something is wrong with the anatomy formatting config at data/mods/anatomy/anatomy-formatting/

In addition, when I switch in the visualizer to see the body graphs of other entities, I'm getting a slew of validation errors for the 'core:entity_removed' event, which likely also appears as ENTITY_REMOVED_ID . See the logs at error_logs.txt . This is likely happening in plenty of places of the repository, so please search all the instances where 'core:entity_removed' or ENTITY_REMOVED_ID are being dispatched, and ensure the payload aligns with the event definition: data/mods/core/events/entity_removed.event.json

## EXAMPLES:

You have an integration suite for the anatomy visualizer at tests/integration/domUI/AnatomyVisualizerUI.integration.test.js

## DOCUMENTATION:

The schema for the anatomy-formatting config file is in data/schemas/anatomy-formatting.schema.json

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
