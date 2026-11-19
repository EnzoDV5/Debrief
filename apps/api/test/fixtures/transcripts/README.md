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
