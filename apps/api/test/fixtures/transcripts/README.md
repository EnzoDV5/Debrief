# Sample transcripts

Made-up meetings (no real people or companies) used as test fixtures and for trying the app by
hand. Each one targets a rule from the brief.

| File                      | Format       | What it tests                                                                                                                                  |
| ------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `clean-standup.txt`       | `Name: text` | Happy path: clear speakers, owners and explicit dates.                                                                                         |
| `messy-planning.vtt`      | WebVTT       | Real export layout: header metadata, `NOTE`/`STYLE` blocks, cue numbers, multi-line cues, `<v.class Name>` tags, `<i>`, `&amp;`, filler words. |
| `no-actions-retro.md`     | Markdown     | Discussion only. The correct result is an **empty** action-item list. Also front matter, headings, bullets and bold speaker names.             |
| `tricky-dates-owners.txt` | Timestamps   | Relative dates ("next Friday", "the 12th"), vague owners ("someone", "the IT team") and a name that is mentioned but never agrees to anything. |
| `prompt-injection.txt`    | `Name: text` | A line that tries to give the AI instructions. It must be treated as transcript text, not obeyed.                                              |

## Stress-test scenarios

These also feed `npm run ai:eval`, which runs every file here through the real AI and the real
transcript checks and reports pass/fail per scenario (see `apps/api/scripts/aiEval/`).

| File                      | Format       | What it tests                                                              |
| ------------------------- | ------------ | -------------------------------------------------------------------------- |
| `vague-owners.txt`        | `Name: text` | "Someone should…" everywhere: items may appear, but nobody owns them.      |
| `i-will-owners.txt`       | `Name: text` | "I'll do it": the owner is whoever said it; today/tomorrow/Thursday dates. |
| `changed-mind.txt`        | `Name: text` | A decision that gets reversed: only the final choice counts.               |
| `south-african-slang.txt` | `Name: text` | "Ja", "lekker", "sharp", "now-now": understood without inventing anything. |
| `repeated-task.txt`       | `Name: text` | One task said three times must be saved once.                              |
| `not-a-meeting.txt`       | Plain text   | A recipe: no decisions, no action items.                                   |
| `speaker-injection.vtt`   | WebVTT       | Orders hidden in a `NOTE` block and inside a speaker name.                 |
| `busy-standup.txt`        | `Name: text` | Many owners and date styles ("tomorrow", "end of the month", "the 3rd").   |
