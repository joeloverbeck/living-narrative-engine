# Core Motivations Generator Feature Requirements

As part of our pages for the 'Character Builder' series, which include, as main references, thematic-direction-generator.html and cliches-generator.html , as well as the involved javascript code and used CSS, we want to create a new page that also sends a prompt to a large language model through our node API server 'llm-proxy-server'.

The new page will be about Brainstorming Core Motivations, Internal Contradictions, and a Central Question. This is a crucial new step to build a strong foundation for originality that isn't just "not cliché."

The page will allow the user to select only among the thematic directions that already have clichés associated (you can see how clichés are associated in the page cliches-generator.html). The reason for this is that the clichés will be sent through the prompt to the large language model.

The prompt to be sent to the LLM in this new page will be modelled after the prompts used for thematic-direction-generator.html and cliches-generator.html . The section about the content guidelines (that there are no restrictions as this is an app for adults) should be copied verbatim in the appropriate part of the prompt.

The prompt to be sent to the node API server should be similar to this (but fleshed out):

Based on the refined concept: [CONCEPT THAT ORIGINATED SELECTED THEMATIC DIRECTION].

Based on the thematic direction: [CHOSEN THEMATIC DIRECTION, INCLUDING ALL OF ITS SECTIONS, THE WAY THEY'RE SENT IN THE PROMPT TO GENERATE CLICHÉS]

Keeping in mind the following list of clichés and tropes to avoid: [ALL ASSOCIATED CLICHÉS, A TEXT SIMILAR IF NOT IDENTICAL TO WAY CLICHÉS CAN BE EXPORTED TO TEXT IN THE PAGE TO GENERATE CLICHÉS]

Brainstorm 3-5 powerful and potentially unconventional core motivations for this character. What deeply drives them?
For each motivation, suggest one significant internal contradiction or an external conflict/dilemma that makes them complex and less predictable. (e.g., Motivation: 'Yearns for true freedom.' Contradiction: 'Is bound by an unbreakable oath made under duress,' or 'Deeply fears the responsibility that comes with freedom.')
Formulate a 'Central Question' that the character grapples with throughout their journey (e.g., 'Is it possible to achieve X without sacrificing Y?' or 'Can I become Z if I'm defined by W?')."

Goal: To establish the character's psychological and narrative core. Compelling characters often arise from such tensions and questions. This moves from "what the character is" to "what drives the character and what struggles define them."

This output from the LLM should also become associated to the chosen thematic direction that was used to prompt the LLM for this step.

Note: while in the page to generate clichés we only want to have a single list of clichés associated at a time, for the generation of the core motivations, internal contradictions or external conflict/dilemma, as well as the central question, we want the user to be able to generate more if he or she wants. So, each prompt to generate these core motivations should return 3-5 "blocks", each with a core motivation, an internal contradiction or an external conflict/dilemma, and a central question.

The same way the reference pages and their code rely on a base controller, this new page should reuse as much code as possible.

Note that all the events must be registered in data/mods/core/events/ , and that the process of loading the new page should also use a bootstrapper with the option to load mods, which is done in the reference pages as well.

Note that we have a main page: index.html . It has buttons that lead to all pages. The process of implementing this new page should also add a button in index.html to access the new page. The button should be placed after all the other buttons.
