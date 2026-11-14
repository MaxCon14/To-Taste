# To Taste

To Taste is an emoji-first recipe book for iPhone. Type `2 Onions` and the ingredient preview shows 🧅 with `2 ×`. Measured ingredients keep their units, and every ingredient keeps its name and preparation notes.

## Visual design

The current interface uses DM Sans throughout, a white / graphite / cool-gray palette, and consistent monochrome headings. Recipe photography supplies the natural color. The original serif, italic, and champagne UI treatments have been removed.

Explore has a photographic spotlight and a responsive recipe grid. The floating navigation uses real backdrop blur, translucent layers, an inset highlight, and a spring-driven selected tab. This is a web / Expo glass treatment inspired by Liquid Glass, not Apple's native Liquid Glass API. Native iOS retains SF Symbols and haptic feedback.

Motion uses restrained 320 ms entrances, 160 ms dismissals, spring press feedback and tab selection, and slower image hover transitions. System Reduce Motion disables movement. The browser also provides keyboard focus rings and a reduced-transparency fallback. Recipe detail manages focus on entry and return; inactive screens stay mounted to retain their filters and scroll positions while being hidden from keyboard navigation.

Design references: [Apple Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass), [Flighty](https://developer.apple.com/news/?id=970ncww4), and [Crouton](https://developer.apple.com/news/?id=9x75y43e). See `design-qa.md` for checks and limitations.

## Try it on iPhone

Install the App Store version of Expo Go, which supports this project's Expo SDK 54. Sign into the same Expo account on your computer and in Expo Go. Run these commands in the project folder, then scan the QR code with the iPhone camera while both devices are on the same Wi-Fi network.

```sh
npm install
npx expo login
npm start -- --go
```

[Expo Go version compatibility](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) · [Running on a physical device](https://docs.expo.dev/get-started/start-developing/)

For accounts and community sharing on iPhone, set `EXPO_PUBLIC_PINCH_API_URL` to the HTTPS origin of your To Taste server before starting Expo. Local recipes, dietary preferences, and the starter Explore collection work without a connection to that server. The browser preview uses the same origin automatically.

## Preview in a browser

```sh
npm install
npm run build:web
npm run preview
```

Open [To Taste at localhost:4173](http://localhost:4173). Use Node.js 24. The preview server handles browser link imports and stores accounts, synced recipes, and community posts in a local SQLite database under `.pinch/`. The iPhone app fetches source recipe pages directly. The server defaults to loopback, and a hosted instance should use HTTPS with `PINCH_SECURE_COOKIES=1`.

## Using the MVP

- **Welcome** opens with a short animated recipe-card introduction and an ingredient-to-emoji demonstration. Skip the intro anytime, create an account, sign in, or continue as a guest. Choose or skip a dietary preference, then enter Explore through a personal welcome. New registrations resume at preferences after a refresh if setup was unfinished. Profile → Replay welcome lets you revisit the flow without deleting recipes or signing out. Animations settle after their entrance and respect Reduce Motion; layouts adapt to compact phones and desktop screens.
- **Explore** is available to guests. Pick an optional dietary preference to order recipes or apply a diet filter to limit results.
- **Add** offers link import, manual entry, and draft recovery. Enter one ingredient and one direction per line. If a supported public link cannot be read, you can write the recipe and keep its source attached.
- **Saved** contains your private recipe book and Favorites. Creating an account or signing in brings your guest recipe book into the account. Drafts are stored locally for each account or guest.
- **Start cooking** opens the directions one step at a time with ingredient lookup and suggested timers. Timer state is scoped to the open recipe. The app keeps the screen awake in cooking mode where supported.
- **Share with the community** opens a public preview from a recipe you created. Publishing makes a snapshot available in Explore on the same server. Deleting the original from your recipe book also removes its community post.

Run `npm test` for ingredient parsing and import checks, and `npm run typecheck` for TypeScript.

## Account setup

The browser preview includes a local Node and SQLite account backend. Open the preview in a private browser window to see the first-run flow. You can register a test account, sign out, and sign in again without creating a cloud project. This local backend supports password sign-in and account sessions. Email verification and password reset are future integrations.

For account testing on iPhone, deploy the To Taste backend to a reachable HTTPS address and set `EXPO_PUBLIC_PINCH_API_URL` to that origin in the Expo build or development environment. If using the SQLite backend, use persistent storage for the database and enable secure cookies in the hosted web deployment.

For a Supabase rollout, create separate test and production projects as needed. Share the test project URL and publishable key, and grant project access if configuration or migrations should be performed on your behalf. Keep privileged keys in the backend environment. The existing To Taste API will need to be connected to Supabase Auth and data storage, with email confirmation and reset links tested on web and iPhone. If local test accounts or recipes must carry over, decide that before switching backends.

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
