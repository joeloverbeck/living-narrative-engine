# Feature requiremenst for creating a page of the Character Builder series, regarding generating clichés for a thematic direction

We currently have four pages in the Character Builder series:

- character-concepts-manager.html
- thematic-direction-generator.html
- thematic-directions-manager.html

We want to create a new page with the following features:

- the user will be able to select an existing thematic direction, and generate a list of common clichés for the chosen thematic direction.

The prompt sent to the large language model to generate the list of common clichés should be heavily inspired by the prompt used in thematic-direction-generator.html, but in general terms, the prompt should include the following:

Based on the following concept for a character:

[CHARACTER CONCEPT THAT ORIGINATED THE SELECTED THEMATIC DIRECTION]

And for a character centered around the following thematic direction:

[SELECTED THEMATIC DIRECTION]

Your task is to please list:

1. The most clichéd, common, and uninspired responses for the following categories: name, physical description, personality traits, skills/abilities, typical likes, typical dislikes, common fears, generic goals, predictable background/origin story elements, overused secrets, and common speech patterns or catchphrases associated with this type of character.
2. Common tropes and stereotypes often associated with such a character.

Goal: to create a comprehensive "what to avoid" list, not just for individual traits but also for narrative patterns.

---

In the app, the generated common clichés produced by the LLM should become associated to the selected thematic direction, in a similar way as each thematic direction is associated with a character concept. However, while a character concept can be associated with many thematic directions, a thematic direction should only have at one time a list of clichés for the stated categories. The apps shouldn't allow to generate a new list of clichés for a thematic direction that already has one generated.
