# Onboarding verification

Verified locally on 2026-11-13 against the exported web app. Account checks used a separate in-memory SQLite instance on port 4177, stopped after testing. The main preview remains on port 4173.

- Animated welcome and ingredient demonstration render with bundled assets. Entrances finish without continuous movement or blocking navigation.
- Screens inspected at 320 × 740, 390 × 844, 880 × 900, and 1280 × 900. The narrow screen and tablet checks report document width equal to viewport width.
- Registration validation reports missing display name. Password visibility switches between Show and Hide.
- Disposable registration reaches diet selection. Refresh at this point resumes diet selection with the signed-in account.
- Selecting Vegan and finishing opens Explore with vegan inspiration first. Reload and Profile confirm the account preference persists.
- Guest entry and Skip for now reach Explore. Reload does not restart onboarding.
- Profile → Replay welcome opens the intro. Signed-in replay retains the current diet and skips account creation.
- Returning-account sign-in from replay opens Explore. A discovered Profile destination bug was fixed and retested.
- No browser error/warning logs were observed during the tested flow. Server stderr contains only Node's existing experimental SQLite warning.
- TypeScript check and production web export pass. All five existing parsing/import tests pass.

Reduced-motion behavior was checked in source: both artwork and scene transitions read the shared accessibility preference, and artwork animations stop on cleanup. Physical iPhone keyboard, VoiceOver, haptics, and device performance remain to be verified on hardware. Authentication continues to use the existing Pinch backend; no Supabase integration was added.

Preview capture: `.pinch/onboarding-preview.jpg`.
