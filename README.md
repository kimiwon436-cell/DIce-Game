# Random Dice 2 Render Server v74

Fixes:
- Restored the missing `drawQuests()` function so the Quest page no longer throws `drawQuests is not defined`.
- Added saved quest progress and claim state.
- Quest completion awards Dice Pass XP when the user manually claims the completed quest.
- Quest progress increases from battle summoning, merging, and cooperative kills.
- Dice Pass level/progress now advances from earned quest XP and remains server-saved.
- Added questClaimed to the persistent state on both client and server.
- Existing PostgreSQL data is preserved; deploy the code without recreating the database.
