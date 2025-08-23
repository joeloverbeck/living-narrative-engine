# Feature Requirements - Traits Generator

We want to create a new page for the 'Character Builder' series, that in the index.html, will have a button right after the one for core-motivations-generator.html .

This new page will focus on generating traits for a character. The page will feature a selector that will filter thematic directions based on those that not only have clichés associated, but also core motivations generated. The filtering to be used can reference the one done in the page core-motivations-generator.html , with the added filter of those thematic directions that have core motivations generated (the structure for how those core motivations are associated are in the code of core-motivations-generator.html).

This new page for generating traits should have a selector of a theme with clichés and core motivations generated. In the right side of the page, in a panel, once the thematic direction is selected, a scrollable list of the associated core motivations should be shown. There will be no option to generate new ones (the page core-motivations-generator.html is the one responsible for that.)

In another panel under the one for displaying core motivations, there should be fields for the user to write in a 'Core Motivation', an 'Internal Contradiction', and a 'Central Question'. All these texts need to be introduced in order to allow the user to generate traits.

The goal is to generate traits like name, description, likes, dislikes, etc. that instead of just "rejecting" clichés in isolation, the LLM will be guided to create traaits that embody the chosen core motivations and contractions, along with the thematic direction details, while simultaneously and consiously subverting the clichés.

The prompt to generate these traits should include elements like:

-Based on this core concept: [CONCEPT THAT ORIGINATED THE CHOSEN THEMATIC DIRECTION]

-Based on this thematic direction: [CHOSEN THEMATIC DIRECTION, INCLUDING ALL OF ITS ELEMENTS]

-Based on this Core Motivation: [USER WRITTEN-IN CORE MOTIVATION]

-Based on this Internal Contradiction: [USER WRITTEN-IN INTERNAL CONTRADICTION]

-Based on this Central Question: [USER WRITTEN-IN CENTRAL QUESTION]

-Having in mind the following list of clichés associated with such a thematic direction: [LIST OF CLICHÉS SIMILAR TO HOW THEY ARE SHOWN WHEN EXPORTED IN cliches-generator.html]

Now, generate compelling, original, and unique traits for this character in the following categories. Each detail should: a) Actively subvert or offer a fresh alternative to the identified clichés for that category. b) Be thematically consistent with the character's core motivation, contradiction, and central question, as well as the thematic direction and concept for the character. c) Contribute to a cohesive and intriguing whole.

- **Name**: Suggest 3-5 unique names. For each, provide a brief (1-sentence) justification for how it might reflect their personality, background, or the subversion of clichés. (Avoid names that are overly common for the cliché or overtly "fantasy generic" unless there's a specific ironic twist).
- **Physical Description**: Describe their appearance focusing on 2-3 distinctive features that subvert typical appearances for this archetype AND hint at their persona. (e.g., Instead of 'graceful and elf-like archer,' perhaps 'surprisingly sturdy build with calloused hands from obsessive, non-elegant practice, and eyes that often look distant, contemplating their fate').
- **Personality**: Detail 3-5 key personality traits. Ensure these are not just anti-clichés but form a coherent, nuanced personality. Explain how each trait stems from or is influenced by their core persona (concept, thematic direction, core motivation, internal contradiction, and/or central question). (e.g., If 'ditzy' was a cliché, the subversion isn't just 'super serious,' but perhaps 'selectively observant, appearing ditzy to disarm others or hide their internal scrutiny').
- **Strengths**: What are this character's strengths? Are any of them unexpected or uniquely applied? How do these strengths subvert clichés and relate to their core? (e.g., The archer is also a surprisingly good cook of foraged food, a skill learned not from a 'wise mentor' cliché but from periods of rebellious self-isolation).
- **Weaknesses**: What are this character's weaknesses? Are any of them unexpected or uniquely applied? How do these weaknesses subvert clichés and relate to their core?
- **Likes**: List 3-5 likes that are specific and telling. How do these likes connect to their deeper motivations, offer them escape, or ironically contrast with their situation? Avoid generic likes.
- **Dislikes**: List 3-5 dislikes that are specific and reveal their sensitivities or principles. How do these relate to their core conflict or past experiences, and how do they avoid clichéd dislikes for the archetype?
- **Fears**: Identify 1-2 profound, specific fears (beyond generic 'fear of death/failure'). These should be deeply rooted in their character cores, and be more nuanced than typical archetype fears.
- **Goals**: (Short-term & Long-term): What are 1-2 short-term goals and one major long-term goal? Ensure these are driven by their core motivations and complicated by their contradictions, and are not the standard goals for this character type.
- **Notes**: (Important Knowledge): What are 2-3 pieces of unique or unexpected knowledge, lore, or practical information this character possesses? How did they acquire it in a way that defies cliché and reveals character? (e.g., 'Knows the migratory patterns of a rare bird that surprisingly holds the key to a hidden path,' learned not from a scroll, but patient, lonely observation).
- **Profile** (Background Summary): Write a concise (3-5 sentence) background summary that explains their current situation, how they handled their strengths and weaknesses, and the origin of their core motivation/contradiction. Focus on originality and avoid clichéd origin stories (e.g., 'chosen one from a destroyed village,' 'mysterious orphan with amnesia'). Note: the core concept provided for this character should be reflected in the profile.
- **Secrets**: Describe 1-2 significant secrets the character harbors. These secrets should be potent, directly tied to their core motivations/contradictions or fears, and have the potential to significantly impact their relationships or choices. Make them more inventive than common "dark secrets."

Goal: To have a rich, detailed, and interconnected set of traits that are original not just by avoiding clichés, but by being thoughtfully constructed around a compelling core.

Note: these generated traits shouldn't be stored, nor associated with the chosen concept/thematic direction. However, the user should have the option to export them into a text file. The user, on his own, should decide on what to keep, and create the JSON file for a specific character, that will be used in the game and in future pages of the character builder series.
