## FEATURE:

We have created a body graph visualizer. The entry point is in anatomy-visualizer.html, and the main code entry point is src/anatomy-visualizer.js . The left panel of the visualizer page is a complex visualizer that should show each node of the body, with bezier curves connecting body parts to their parents and children. However, something in the code fails: currently, only the root node (a torso, in this case) appears. The code must be investigated carefully to determine why the whole graph of nodes isn't being displayed, and a proper implementation must be determined.

Your current goal is to create a PRP to implement the full visualization of nodes in the anatomy visualizer page, including all nodes of any given body graph, with bezier curves connection their body part nodes. Do not make any modification to the code at this stage, as we'll rely on the PRP later to actually implement this proper behavior.

## EXAMPLES:

You have passing test suites for the anatomy visualizer in tests/unit/visualizer/ , as well as in tests/integration/domUI/AnatomyVisualizerUI.integration.test.js

## DOCUMENTATION:

You can rely on the schemas for recipes and blueprints of the anatomy system, located in data/schemas/ . You can also analyze the code in src/anatomy/ and subdirectories, to see how the body parts graph gets created.

## OTHER CONSIDERATIONS:

You should create focused tests to ensure the proper implementation gets locked down.