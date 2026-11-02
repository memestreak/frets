# GLOSSARY.md format

```md
# {Project name}

{One or two sentences: what this project is.}

## {Group, when natural clusters emerge}

**Shape**:
{One or two sentences: what it is, not what it does.}
_Avoid_: Fingering, pattern

**Position**:
{...}
_Avoid_: Box
```

## Rules

- **Be opinionated.** When several words name one concept, pick one and
  list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences. Say what it is.
- **Only this project's words.** Leave out general programming terms
  (timeouts, error types, hooks) however often the code uses them. A
  general domain term (a triad, an interval) belongs only when the
  project uses it in a narrower or particular sense; define that sense.
- **Group terms** under subheadings when clusters emerge; a flat list is
  fine until then.
- **Alphabetical within each group.** New terms then land in different
  places, so parallel branches rarely conflict.
- **Link related terms** by name in the definition when the relationship
  is part of the meaning ("A Work is saved per page; see Preference").

## One glossary or several

Most repos have one `GLOSSARY.md` at the root. A repo with genuinely
separate contexts has a `GLOSSARY-MAP.md` at the root instead:

```md
# Glossary map

- [Practice](src/features/practice/GLOSSARY.md): the trainers
- [Tab](src/features/tab/GLOSSARY.md): the Tab editor

## Relationships

- **Tab → Practice**: ...
```

- `GLOSSARY-MAP.md` exists: read it, and work in the glossary of the
  context the topic belongs to. Ask if that's unclear.
- Only a root `GLOSSARY.md`: one context.
- Neither: create a root `GLOSSARY.md` when the first term settles.
  Don't split into contexts unless the user asks.
