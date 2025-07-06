## FEATURE:

Important: your current goal is to create a PRP document. No code modifications should be made at this stage.

Corrently, the goals.component.json and notes.component.json forces setting the timestamp when these components are declared in entity definitions, such as in the definitions in data/mods/isekai/entities/definitions/ and .private/data/mods/p_erotica/entities/definitions/ . Forcing the modder/designer to include the timestamp in the definitions of goals and notes in the entity definitions is awkward, and forces the modder to fake a timestamp just to include the notes or goals component. I want you to remove the requirement of "timestamp", remove the timestamps declared in the existing entity definitions, and modify the code that handles goals and notes components so that they still work if a timestamp is not set.

Your task is to create a comprehensive PRP document to implement these changes.

## EXAMPLES:

Some entities in data/mods/isekai/entities/definitions/ have the goals and the notes components defined.

## DOCUMENTATION:

You could check the schemas for components and entity definitions. They're in data/schemas/

## OTHER CONSIDERATIONS:

None in particular.