# Random Dice 2 Render Server v66

Fixes:
- Restored the `drawDeck()` function used by the deck menu and slot replacement flow.
- Centered lobby deck emoji rendering with explicit full-face centering rules.
- Made battle-result persistence idempotent and always persist the latest `bountyClaimed` progress when a battle is finished/left.
- Existing PostgreSQL data is preserved; deploy code without recreating the database.
