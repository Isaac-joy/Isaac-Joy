# Publishing Guide — Solo Leveling Council (EAS)

The app builds with **EAS Build** (Expo's cloud builder — no Mac needed, even for iOS).
Run everything from the `frontend/` folder.

## 0. One-time setup
1. Make a free **Expo account** at https://expo.dev.
2. Install the CLI / log in:
   ```
   cd C:\Users\ravil\solo-leveling-council\frontend
   npm install -g eas-cli
   eas login
   ```
3. Link the project (creates the project on expo.dev, writes the `extra.eas.projectId`):
   ```
   eas init
   ```
4. **Point the app at the live backend before building** — in [`config.js`](frontend/config.js)
   `BACKEND_URL` must be your Render URL (already set). Standalone builds can't reach
   `localhost`.

## 1. Test build (installable APK, no stores)
Best first step — get the real app onto your Android phone:
```
eas build -p android --profile preview
```
EAS returns a link to download an **.apk**. Install it directly on your phone (enable
"install from unknown sources"). This is the true app, not Expo Go.

## 2. Production builds (for the stores)
```
eas build -p android --profile production   # -> .aab for Google Play
eas build -p ios     --profile production   # -> .ipa for the App Store
```
iOS will prompt to log in with your Apple ID and create credentials (needs the **$99/yr
Apple Developer** account). Android signing keys are generated and stored by EAS.

## 3. Submit to the stores
```
eas submit -p android --latest   # needs a Google Play dev account ($25 once)
eas submit -p ios --latest       # needs App Store Connect set up
```
Or upload the `.aab` / `.ipa` manually in Play Console / App Store Connect.

## 4. Before "Submit for Review" — the non-code checklist
- [ ] **Privacy policy is publicly reachable** — host [`PRIVACY.md`](PRIVACY.md) (make the
      repo public, or GitHub Pages / Notion) and set `PRIVACY_URL` in `config.js` to it.
- [ ] **Google Play Data Safety** form: declare email + personal logs collected, and that
      content is shared with third-party AI (Google / OpenRouter) for processing.
- [ ] **Apple App Privacy** labels: same disclosures.
- [ ] **Age rating** questionnaire: declare AI-generated content.
- [ ] Screenshots (use a few from the running app), short + full description, app category.
- [ ] Confirm in-app **Account deletion** (Settings) and **Report** flag work on the build.

## Bumping versions later
- Update `version` in `app.json` (e.g. `1.0.1`).
- `production` profile auto-increments the native build number; just rebuild + resubmit.
