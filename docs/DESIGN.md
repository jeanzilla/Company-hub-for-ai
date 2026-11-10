# Design

Light, restrained and with a single accent color. It looks like business management software: an almost white background, a menu on the left, 1 px lines and almost no shadows.

## Rules

1. No literal color in a screen. All colors come from the variables in `app/globals.css`. The accent is set in `hub.config.ts`.
2. Each piece is written once, in `components/ui.tsx` or as a class in `globals.css`. If a screen needs a new piece, add it there.
3. One screen, one column, top to bottom in the order of the work. No tabs. Things that are rarely used go in a collapsible section (`details.collapsible`) or behind a link.
4. A card never goes inside another card.
5. States use color with meaning: green for what is correct, amber for what needs attention, red for what fails. The accent does not mean a state.
6. Numbers use `num` (digits of equal width). Technical identifiers use `mono`.
7. Every screen starts with `PageHeader`: a title and one sentence that says what the screen is for, in the company's own words.
8. An empty state says what is missing and what the first step is.
9. It works in light and dark (the viewer's system decides) and at 390 px wide with no horizontal scrolling of the page. Tables scroll inside their wrapper.
10. Forms work without JavaScript, with server actions. Only `SecretForm` is a client component, because it shows a secret once.

## Variables

Background `--bg`, cards `--surface`, subtle areas `--surface-2`, lines `--line` and `--line-strong`. Text: `--ink` for titles, `--body` for body text, `--muted` for secondary text and `--faint` for labels. States: `--ok`, `--warn` and `--bad`, each with its own background. Accent: `--accent`, `--accent-strong` and `--accent-soft`.

In Tailwind they are available as colors: `text-ink`, `text-muted`, `bg-surface`, `border-line`, `text-accent`.

## Pieces

| Piece | Class or component |
|---|---|
| Card | `card`, with `card-pad` for the padding |
| Screen title | `<PageHeader title text>` |
| Section title | `section-title` |
| Small uppercase label | `micro` |
| Button | `btn`, `btn btn-primary`, `btn btn-danger`, `btn btn-ghost` |
| Field with a label | `<Field label hint>` with an `input`, `select` or `textarea` of class `field` |
| State | `chip`, `chip chip-ok`, `chip chip-warn`, `chip chip-bad`, `chip chip-accent` |
| Table | `data-table` inside `table-wrap` |
| Message after an action | `<Notice ok error>` |
| Empty state | `empty-state` |
| Secret shown once | `<SecretForm>` |
| Icon | `<Icon name>`, strokes in `components/icon.tsx` |

## Sizes

14 px text in the body, 13 px in tables, 20 px in the screen title and 15 px in the section title. Controls 34 px high with a radius of 7. Cards with a radius of 10. Side menu 240 px wide. Content at most 1,100 px wide. On mobile, fields switch to 16 px so that iOS does not zoom the screen.

## Check

Before approving a screen: light and dark, 390 and 1,280 px, with data and empty, with the role that will use it.
