# vite-mern-template

[![Depfu](https://badges.depfu.com/badges/1b70410a7764005553d576dd171dce8d/status.svg)](https://depfu.com)
[![Depfu](https://badges.depfu.com/badges/1b70410a7764005553d576dd171dce8d/count.svg)](https://depfu.com/github/apicgg/vite-mern-template?project_id=38988)

> Simple opinionated boilerplate for MERN stack with Vite and Redux Toolkit.
> This includes React+TypeScript with familiar configuration for vite.config.ts for front-end and Express+TypeScript for back-end.

This has been created with the official [Vite](https://vitejs.dev/) template (`npm create vite@latest`) and some extended setup. There are two separate folders called `server` and `client`. The entry point for the backend is `server/src/index.js`.

Any package manager can be used with this project (e.g. npm, yarn or pnpm).

> Thanks to [awesome-vite](https://github.com/vitejs/awesome-vite) for publishing this project.

## Tools

- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [Axios](https://axios-http.com/)
- [React Router DOM](https://reactrouter.com/)
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Express](https://expressjs.com/)
- [mongoose](https://mongoosejs.com/)
- [bcrypt.js](https://www.npmjs.com/package/bcryptjs)
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken)
- [express-async-handler](https://www.npmjs.com/package/express-async-handler)

#### The dependency versions are managed by [depfu](https://depfu.com/).

## Requirements

- [Node.js](https://nodejs.org/en/) 18+

## Demo

![vite-mern-template-gh-demo](https://user-images.githubusercontent.com/78271602/234833309-fe8df564-2895-4727-be1e-c807fe142333.gif)

## Installation

```bash
npx degit apicgg/vite-mern-template my-app
```

## Install dependencies (npm or yarn or pnpm)

- Backend

```bash
npm install
```

- Frontend

```bash
cd frontend
npm install
```

## Start the development server

- Backend

```bash
npm run dev:be
```

- Frontend

```bash
npm run dev:fe
```

- Remove the .git and .github folder and initialize your own git repository.

## Lessons

Lessons can contain uploaded images, videos, and custom text slides. Page files
are stored in Firebase Storage and lesson metadata is stored in Firestore.
Videos use the browser's playback controls and do not play or loop automatically;
drawing annotations are available on image and custom text slides only. Video
format support depends on the viewer's browser.

The lesson viewer timer supports a custom background color and a short, wrapping
note. The popped-out note box expands as the timer is resized. Both settings
remain available when the timer is popped out or docked and are kept only while
the lesson viewer is open.

The Lessons Library also has Pixel Studio. Draw and add each animation frame to
the queue, then choose an FPS and download a WebM video (32 × 32 pixel art
upscaled to 512 × 512 on a white background). Export requires a browser that
supports WebM recording and works in real time; keep the tab open. Save a
project to download an editable JSON file, and use Open project to restore its
queued frames and FPS. The current unqueued canvas is not included.

## Dashboard prayers

Open the Prayers section and search by text or date to display matching prayers,
with the newest first. Clearing the search hides the results.

## Admin character editor

Admins can open Character Gallery, select a character in Animation Preview,
and edit its Firestore fields. Base character edits affect shared definitions;
custom character edits apply only to characters in the signed-in admin's
account. Existing per-character overrides can take precedence over base fields.

Transformation thresholds and animation paths use ordered entries. Empty
animation paths preserve their position; removing an entry shifts later forms.
Other JSON-compatible fields can be edited individually, while fields containing
Firestore-specific values are shown read-only. Saving updates only the selected
field. Reload the dashboard to apply all saved changes to character data.
Editing an `id` field does not rename the Firestore document.

Character animation fallback fields are merged by
`frontend/src/utils/characterAnimationFallback.ts`. User values, including
empty arrays, take precedence over shared base values. Character subcollection
and animation persistence live in separate services and remain re-exported by
`characterService.ts` for existing callers.

Base character idle animations live in `characters/<character>/idle/`, and
temporary transformation animations live in `characters/<character>/transformations/`.
The migration script `scripts/migrate_character_animation_paths.js` uses the
active gcloud credentials and defaults to a read-only dry run; `--apply` copies
matching existing legacy files, verifies their contents and download URLs, and
updates matching base and user-character Firestore fields, including paths
with leading or trailing whitespace. It retains the
originals and stops on conflicting destination content or concurrent document
updates. Rerun it after resolving an error. References to missing legacy files
are reported and left unchanged; uploading those animations requires updating
their Firestore fields and the corresponding paths in `CharacterData.tsx`.

Class Mode's individual and group XP/HP actions are managed by
`frontend/src/components/classmode/useClassModeProgress.ts`; the progress card
and still-image display are separate components in the same directory.

## TODO

- [x] Include eslint and prettier.
- [x] Add testing framework.
- [ ] Create a npm CLI library for scaffolding projects.

## License

MIT License.

Please review the [License](https://github.com/apicgg/vite-mern-template/blob/main/LICENSE).

## Contributors ✨

Contributions of any kind welcome! Kindly have a look into [Contributing Guidelines](CONTRIBUTING.md)
