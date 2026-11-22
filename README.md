# Monic Decks

Open community flashcard and mnemonic deck catalog for **Monic**.

Monic apps fetch deck manifests (`index.json`), spreadsheets (`cards.csv`), and lightweight media (`media/`) directly from this repository—or from **any fork (`owner/repo`)** you add inside the app. No account or API key required.

## Repository Structure

```text
monic-decks/
├── index.json                  # Auto-generated catalog index (via scripts/build-index.mjs)
├── scripts/
│   └── build-index.mjs         # Validates deck.json + cards.csv + media sizes and rebuilds index.json
└── decks/
    └── <deck-slug>/
        ├── deck.json           # Metadata, category, field labels, and TTS language codes
        ├── cards.csv           # RFC-4180 CSV spreadsheet matching fields in deck.json
        └── media/              # Optional images/audio referenced as "media/<filename>"
```

## Contributing a Deck (Fork & Pull Request)

1. **Fork this repository** on GitHub.
2. **Create a folder** under `decks/<your-deck-slug>/` (lowercase letters, digits, hyphens).
3. **Add `deck.json`** describing the deck and its columns:

```json
{
  "id": "japanese-travel",
  "title": "Japanese Travel & Signs",
  "description": "Essential transit vocabulary and signage with visual hooks.",
  "icon": "⛩️",
  "color": "#3B82F6",
  "category": "languages",
  "subject": "japanese",
  "tags": ["japanese", "kanji", "travel"],
  "fields": [
    { "column": "term", "label": "Kanji", "type": "text", "lang": "ja-JP", "role": "subject" },
    { "column": "definition", "label": "Definition", "type": "text", "lang": "en-US", "role": "target" },
    { "column": "story", "label": "Story", "type": "text", "lang": "en-US", "role": "none" },
    { "column": "visual", "label": "Visual", "type": "image", "lang": "en-US", "role": "none" }
  ]
}
```

### Supported `category` Values
`languages` · `science` · `exams` · `math` · `humanities` · `other`

### Supported `fields[].type` Values
`text` · `image` · `audio`

### Supported `fields[].role` Values
`subject` · `target` · `none`

4. **Add `cards.csv`** using UTF-8 encoding with a header row matching the `column` names from `deck.json`:

```csv
term,definition,story,visual
改札 (かいさつ),Ticket gate,"Imagine a kaiju getting blocked by a subway turnstile unless it taps an IC card.",media/ticket-gate.png
```

- Optional `id` column: include an `id` column to stabilize FSRS progress tracking if you edit or reorder cards later.
- Relative media paths: prefix files inside your deck's `media/` folder as `media/<filename>`. Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp3`, `.m4a`. Keep images under **500 KB** and audio under **1 MB**.

5. **Validate and update `index.json`**:

```sh
node scripts/build-index.mjs
```

6. **Load your fork directly in Monic** (no PR wait required): open **Explore → Sources → Add GitHub Repo** and enter `<your-username>/monic-decks` (or `<username>/<repo>@<branch>`), or open a PR to include your deck in the official catalog.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
