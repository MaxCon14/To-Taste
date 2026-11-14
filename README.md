# To Taste

To Taste is an emoji-first recipe book for iPhone. Type `2 Onions` and the ingredient preview shows 🧅 with `2 ×`. Measured ingredients keep their units, and every ingredient keeps its name and preparation notes.

## Visual design

The current interface uses DM Sans throughout, a white / graphite / cool-gray palette, and consistent monochrome headings. Recipe photography supplies the natural color. The original serif, italic, and champagne UI treatments have been removed.

Explore has a photographic spotlight and a responsive recipe grid. The floating navigation uses real backdrop blur, translucent layers, an inset highlight, and a spring-driven selected tab. This is a web / Expo glass treatment inspired by Liquid Glass, not Apple's native Liquid Glass API. Native iOS retains SF Symbols and haptic feedback.

Motion uses restrained 320 ms entrances, 160 ms dismissals, spring press feedback and tab selection, and slower image hover transitions. System Reduce Motion disables movement. The browser also provides keyboard focus rings and a reduced-transparency fallback. Recipe detail manages focus on entry and return; inactive screens stay mounted to retain their filters and scroll positions while being hidden from keyboard navigation.

Design references: [Apple Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass), [Flighty](https://developer.apple.com/news/?id=970ncww4), and [Crouton](https://developer.apple.com/news/?id=9x75y43e). See `design-qa.md` for checks and limitations.

## Try it on iPhone

For a guest preview, use Expo Go compatible with SDK 54. Use a development build to test native Apple and Google sign-in and the To Taste callback scheme. Sign into the same Expo account on your computer and in Expo Go. Run these commands in the project folder, then scan the QR code with the iPhone camera while both devices are on the same Wi-Fi network.

```sh
npm install
npx expo login
npm start -- --go
```

[Expo Go version compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) · [Running on a physical device](https://docs.expo.dev/get-started/start-developing/)

Set the Expo public values from `.env.example` in your development build environment to enable Supabase. Guest mode, local drafts, and the shopping list work without these values.

## Preview in a browser

```sh
npm install
npm run build:web
npm run preview
```

Open [To Taste at localhost:4173](http://localhost:4173) using Node.js 24. The preview server handles web recipe link imports. The app connects to Supabase directly for authentication and cloud data when configured.

## Using the MVP

- **Welcome** opens Explore in guest mode or offers a single screen to sign in or create an account. Explore includes an optional dietary preference card.
- **Explore** is available to guests. Pick an optional dietary preference to order recipes or apply a diet filter to limit results.
- **Add** offers link import, manual entry, and draft recovery. Enter one ingredient and one direction per line. If a supported public link cannot be read, you can write the recipe and keep its source attached.
- **Saved** contains your private recipe book and Favorites. After signing in, you can choose to copy guest recipes to your account or keep them on this device. Drafts are stored locally for each account or guest.
- **Start cooking** opens the directions one step at a time with ingredient lookup and suggested timers. Timer state is scoped to the open recipe. The app keeps the screen awake in cooking mode where supported.
- **Share with the community** opens a public preview from a recipe you created. Publishing makes a snapshot available in Explore for other users. Deleting the original from your recipe book also removes its community post.

Run `npm test` for ingredient parsing and import checks, and `npm run typecheck` for TypeScript.

## Supabase account setup

Copy `.env.example` to `.env.local` and rebuild. The example targets the To Taste project using its publishable key. Keep server credentials in Supabase or your build provider, outside frontend variables and Git.

The migration in `supabase/migrations` creates private profiles and cookbooks and a publicly readable collection of explicitly published recipes. Apply it once per project. The `delete-account` Edge Function validates the signed-in user and deletes only that user. Database foreign keys remove their cloud cookbook, profile, and publications. Existing guest data uses the original device storage keys. Legacy SQLite accounts and their cloud recipes require a separate migration.

Configure the following in the [To Taste Supabase dashboard](https://supabase.com/dashboard/project/ccbzwxgwefpmcfjoytmv):

1. Under Authentication → URL Configuration, set the Site URL to your deployed web origin. Allow `https://pinch-recipe-preview.max-constantinou.chatgpt.site/` for the private preview, `http://localhost:4173/` for local testing, and `totaste://auth/callback` for the development build. Add any production URL explicitly when it is available.
2. Under Authentication → Email Templates, set the **Magic Link** template to include the six-digit code using `{{ .Token }}`. Use the same code in **Confirm signup**. Example body: `<h1>Sign in to To Taste</h1><p>Your sign-in code is <strong>{{ .Token }}</strong>.</p><p>If you didn’t request a code, ignore this email.</p>`. Configure custom SMTP for users outside the Supabase team.
3. Enable **Google** and enter the Google web OAuth client ID and secret in Supabase. Add the Supabase callback `https://ccbzwxgwefpmcfjoytmv.supabase.co/auth/v1/callback` in Google Cloud. For native iPhone sign-in, also create an iOS OAuth client for the bundle ID in `app.json`, fill both public Google IDs in the app environment, and rebuild. Without the iOS client configuration, the app uses the system browser session.
4. Enable **Apple** and add the iOS bundle ID from `app.json`. To enable Apple sign-in on the web, configure an Apple Services ID, return URL, and client secret, then put the Services ID first in Supabase’s Apple Client IDs list. The published backend also supports native Apple token revocation on deletion when `APPLE_NATIVE_CLIENT_ID` and `APPLE_NATIVE_CLIENT_SECRET` are set in the Edge Function secrets. Users can revoke access in their Apple Account settings if a revocable credential is unavailable.
5. Enable **manual identity linking** to allow signed-in users to add Apple or Google from Profile → Account settings.

Open a private browser window to verify guest onboarding. With provider configuration in place, test first-time and returning sign-in, provider cancellation, email resend, cookbook transfer, sharing, and deletion with disposable accounts. Test Apple and Google on a physical iPhone development build before release.


<details>
<summary>Starter photo assets and prompts</summary>

The bundled photos were made with the built-in image generator.

- `assets/lemon-chickpeas.jpg` — One photorealistic food editorial portrait for To Taste, a luxury cookbook. A rustic cream stoneware bowl of warm lemon chickpeas, blistered cherry tomatoes, chopped parsley and olive oil with a grilled lemon wedge, on honed champagne limestone. Refined warm afternoon side light and soft diagonal window shadows. Plate centered in upper middle with quiet warm foreground suitable for title overlay, no text, people, utensils or graphics. Tall portrait, magazine photography with natural textures.
- `assets/lemon-salmon.jpg` — Single portrait photorealistic food editorial cover for an understated luxury recipe app. One pan-roasted salmon fillet with a crisp bronzed surface, blistered green beans, dill and lemon on a wide ivory stoneware plate. Warm honed limestone table, soft diagonal afternoon window shadows. Dish centered in upper middle, lower area open for an app title. Natural color, refined magazine photography, no text, graphics, hands, people or utensils.

- `assets/tomato-pasta-editorial.jpg` — Generate a single photographic food cover for a luxury iOS recipe journal. Tall portrait composition, aspect ratio 2:3. Upscale Italian food editorial photographed at a 40 degree downward angle: beautifully plated rigatoni with blistered cherry tomatoes, a few fresh basil leaves, and a delicate dusting of Parmesan, in a wide, shallow, handmade warm-white stoneware plate. Honed champagne-taupe limestone tabletop. Center the plate and its vivid food within the middle 55% of the frame with its focal point 44% down from the top. The plate should have room to breathe on the left and right, with a generous and visually quiet tabletop foreground below it for a separately added recipe title. Compose to work as a centered landscape crop as well. Strong but refined warm afternoon side light, with broad, soft diagonal window shadows over the limestone and off-white bowl rim. Restrained champagne and terracotta palette with the fresh natural color of the tomatoes and basil. Tactile, realistic print-magazine food photography, no over-styling. No cutlery, linen, flowers, hands, people, text, logo, graphics, UI, status bars, or border.

- `assets/tomato-pasta.jpg` — Generate a single polished photorealistic food editorial photograph as a wide horizontal feature cover for a modern recipe notebook app. Overhead slightly angled close up of creamy roasted cherry tomato pasta, short rigatoni with glossy orange tomato sauce, blistered cherry tomatoes, bright basil leaves, light dusting of parmesan, dark green ceramic plate on warm terracotta tabletop, deep olive cloth at edge, directional afternoon sunlight and soft shadows, appetizing real natural texture. Plate centered, shot cropped close with food filling frame, richly colored natural editorial food styling. No text, no graphics, no logo, no people. Wide landscape aspect ratio.
- `assets/lemon-chicken.jpg` — Single photorealistic editorial food photograph, wide horizontal. A small cream ceramic plate of folded juicy lemon herb chicken pieces, golden pan-seared with browned edges, a bright grilled lemon half and scattered fresh herbs, a soft beige linen on pale cool sage countertop. Overhead close crop so the food is instantly legible even in a small mobile recipe card. Soft natural window light, warm magazine food styling, appetizing natural texture. No text, no graphics, no people.
- `assets/blueberry-pancakes.jpg` — Single photorealistic editorial breakfast food photo, wide horizontal crop, small stack of fluffy golden pancakes with fresh blueberries and maple syrup on an ivory ceramic plate, a muted lavender linen napkin on a light butter-colored kitchen table. Close three-quarter angle for an instantly legible mobile recipe thumbnail, natural window light, realistic food textures, sophisticated warm magazine styling. No text, no logos, no people.

</details>
