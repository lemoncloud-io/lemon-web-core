# Findings from the lemon-front-monorepo absorption audit

**Date:** 2026-08-11 · **Version audited:** `1.5.3` (`e28860f`, `main`, identical to what npm serves)

These came out of measuring what it would take to absorb this package's source into
`lemon-front-monorepo` as a workspace library. The absorption itself has not happened. One of the
findings is a live defect in the published package rather than a preparation task, which is why
this is written down here rather than only in the monorepo's migration notes.

Everything below was verified by reading this repository's source at the commit above. Two claims
carried over from an earlier survey are marked **unverified here** where they appear.

## Status as of 2026-08-12

The findings were re-checked against source and against the packed artifact. Four claims in the
original write-up were wrong and have been corrected in place, each marked **Correction**.

| Finding | State                                                                       | Released in  |
| ------- | --------------------------------------------------------------------------- | ------------ |
| 1       | **Fixed** — `aws-web.core.ts` spread reordered, regression test added       | 1.5.4        |
| 3       | **Fixed** — conditional `exports` + root `main`/`module`/`types`            | 1.5.4        |
| 4       | **Fixed** — `peerDependencies` dropped, `dependencies` kept                 | 1.5.4        |
| 5       | **Fixed** — `test:ci` script, release workflow lints and tests, `strict` on | 1.5.4 · next |
| 2       | **Fixed** — `strict: true`, all errors resolved                             | next         |
| 6       | **Fixed** — `util` and `aws-sdk` imports both gone                          | next         |
| 7       | **Fixed** — no global credential slot; token storage is the single source   | next         |
| 8       | **Withdrawn** — the claim does not hold; see that section                   | —            |

"next" is the minor release this branch produces. The `1.5.4` row content is live on npm.

---

## 1. Token refresh destroys the fallback it just computed — `src/core/aws-web.core.ts:417-421`

**This is a defect in the published package.** Three products ran it. **Fixed in 1.5.4**; `1.5.3`
and earlier still carry it.

```ts
const tokenData = response.data.Token || response.data;
const refreshToken = {
    identityToken: tokenData.identityToken || cached.identityToken,
    identityPoolId: cached.identityPoolId,
    ...tokenData, // <- last, so it overwrites both lines above
};
```

The spread comes last, so any key `tokenData` carries wins over the two lines written above it.
The fallbacks only survive when the server **omits the key entirely**; if the response carries
`identityToken` with a falsy value (`undefined`, `null`, `""`), the fallback is computed and then
immediately discarded. `identityPoolId: cached.identityPoolId` is overwritten whenever the response
has that key at all, whatever its value.

### The same file already does it the other way round

`changeUserSite()` at `src/core/aws-web.core.ts:471-475` assembles the same kind of object and puts
the spread **first**:

```ts
const refreshToken = {
    ...response.data,
    identityToken: response.data?.identityToken || originToken.identityToken,
    identityPoolId: cached.identityPoolId,
};
```

Two refresh paths in one file, opposite orders. That is the strongest argument that the first one
is a slip rather than an intentional choice, and it is also the shape the fix should take.

### Why it is worth fixing rather than noting

The bad object does not stop at the caller. `buildCredentialsByToken()` calls
`this.tokenStorage.saveOAuthToken(token)`, so the value is persisted:

| Step          | Code                                                         | Effect with a falsy `identityToken`                                                  |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| persist       | `aws-storage.service.ts:161`                                 | `setItem('identity_token', identityToken \|\| '')` stores `""`                       |
| session check | `aws-storage.service.ts:83-89`                               | `hasCachedToken()` is `… && !!identityToken` → **false**                             |
| expiry        | `aws-storage.service.ts:168` → `token-storage.service.ts:81` | falls through the JWT branch to the 15-minute `FALLBACK_DURATION`                    |
| next refresh  | `aws-web.core.ts:418`                                        | `cached.identityToken` is now `""`, so the fallback has nothing left to fall back to |

So the failure mode is a refresh that reports success and leaves the session reading as signed out,
with the cached value that would have recovered it overwritten in the same pass.

**Correction.** The session-check row originally named `isAuthenticated()` at
`aws-storage.service.ts:89`. The method there is `hasCachedToken()` (lines 83-89);
`isAuthenticated()` is on the core at `aws-web.core.ts:263` and reaches this through it. The chain
and its conclusion are unchanged.

**What is not established here:** whether the backend actually returns those keys with falsy
values. If it never does, the code is correct by accident. That is worth confirming before deciding
the priority — but the fallback lines exist precisely because someone expected the server not to
always send them, and in their current position they cannot do the job they were written for.

### The fix that shipped

The spread moved first, matching `changeUserSite()`:

```ts
const refreshToken = {
    ...tokenData,
    identityToken: tokenData.identityToken || cached.identityToken,
    identityPoolId: tokenData.identityPoolId || cached.identityPoolId,
};
```

`identityPoolId` gains a fallback it did not have. This form was chosen because it is correct
whether or not the backend rotates the pool id: a truthy server value still wins, exactly as it did
before, and only the falsy cases change. The alternative `identityPoolId: cached.identityPoolId`
(the shape `changeUserSite():474` uses) would also change the truthy cases, so it would need the
server contract confirmed first. **Still open:** the two paths therefore disagree about
`identityPoolId` — worth reconciling once that contract is known.

Two regression tests were added to `describe('refreshCachedToken')` in
`src/core/aws-web.core.spec.ts`, asserting on the object handed to `buildCredentialsByToken()`:
a response **carrying** `identityToken: ''` and `identityPoolId: ''` must fall back to the cached
values, and a response carrying real values must win. The first fails against the unfixed code with
`Received: {… "identityPoolId": "", "identityToken": ""}`.

---

## 2. `strict` would cost around a dozen errors, not a flood

**Correction.** The original figure of 15 was measured inside `lemon-front-monorepo` without
recording the command, and it does not reproduce. The count is sensitive to how `strict` is turned
on, so the command belongs with the number. Run in this repository, against product code only:

```bash
node_modules/.bin/tsc --noEmit --strict --target es2022 --module esnext \
  --moduleResolution bundler --types node --skipLibCheck \
  $(git ls-files 'src/**/*.ts' | grep -v spec)
```

**12 errors** after the finding-1 fix, 13 before it:

| Code               | Count | What                                                                                     |
| ------------------ | ----- | ---------------------------------------------------------------------------------------- |
| `TS7016`           | 5     | `crypto-js` subpath imports have no type declarations (`@types/crypto-js` not installed) |
| `TS18049`          | 3     | `AWS.config.credentials` may be `null`                                                   |
| `TS2322`           | 2     | the `WebCoreFactory` map does not satisfy `WebCoreConstructor`                           |
| `TS2345`, `TS2531` | 2     | a `string \| undefined` argument, a possibly-`null` object                               |
| `TS2783`           | 1     | finding 1 above — **no longer present**                                                  |

Two things the original table got wrong. The `TS4115` pair comes from `noImplicitOverride`, which
is not part of `strict`, so it is not part of this cost. And `tsc --noEmit -p tsconfig.json
--strict` gives a _higher_ count (18 after the fix), because the explicit
`"noImplicitAny": false` in that file survives the CLI flag — worth knowing if the tightening is
done by editing `tsconfig.json` rather than by a fresh config.

The specs were separately reported as 233 errors. Those are missing jest globals, an artefact of the
monorepo running vitest; compiled here with `"types": ["node", "jest"]` they produce none.

Tightening `strict` here is a bounded piece of work, and `TS2783` is the reason it was worth doing:
`"strict": false` is what let finding 1 through.

### Done

`tsconfig.json` now sets `"strict": true` and drops the explicit `"noImplicitAny": false` that used
to survive the flag. The count that had to be paid down was smaller than 12, because two of the
other fixes removed errors on their way past:

| Code      | Count | How it went                                                              |
| --------- | ----- | ------------------------------------------------------------------------ |
| `TS7016`  | 5     | added `@types/crypto-js` to `devDependencies`                            |
| `TS18049` | 3     | disappeared with `AWS.config.credentials` (finding 7)                    |
| `TS2322`  | 2     | `WebCoreConstructor` re-keyed to a cloud provider, so the factory map is |
|           |       | `{ [T in CloudProvider]: WebCoreConstructor<T> }` and the cast is gone   |
| `TS2345`  | 1     | `getSignedClient(endpoint?: string)` — it already guarded internally     |
| `TS2531`  | 1     | `sig-v4.service.ts` origin match is checked before `[1]` is read         |

The `TS2531` one was a latent defect rather than a type annoyance: `exec()` returns `null` for an
endpoint with no `http(s)://` origin, and reading `[1]` off it threw a `TypeError` naming the regex.
It now throws `@endpoint (string) must start with http:// or https://`, covered by
`src/vendor/sig-v4.service.spec.ts`.

---

## 3. `exports` cannot reach the CJS build — `package.json`

```json
"types": "./dist/index.d.ts",
"exports": "./dist/index.js"
```

`tsup` emits `dist/index.cjs` and `dist/index.d.cts` alongside the ESM pair, and the string form of
`exports` makes them unreachable. The consequence is worse than resolving to the wrong format:
because the package is also `"type": "module"`, a CommonJS `require()` lands on an ES module and
throws `ERR_REQUIRE_ESM` on Node versions without `require(esm)`. The CJS build ships in the tarball
and cannot be reached at all.

**Fixed in 1.5.4** with conditional exports, plus the root fields a `node10`-style resolver
still needs:

```json
"exports": {
  ".": {
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  },
  "./package.json": "./package.json"
},
"main": "./dist/index.cjs",
"module": "./dist/index.js",
"types": "./dist/index.d.ts"
```

`types` goes inside each condition branch rather than in a sibling `"types"` object; the sibling
form is not what TypeScript's `node16` resolution reads.

Verified against the packed artifact rather than the source file, which matters because `prepack`
rewrites `package.json` before publishing (see finding 5): `npm pack`, install the tarball into a
scratch project, then `require('@lemoncloud/lemon-web-core')` returns the exports, and `tsc --noEmit`
type-checks a bare-specifier import under `node10`, `node16` and `bundler`.

Consumers inside `lemon-front-monorepo` do not hit this — all twelve of their imports use the bare
specifier from ESM. The reason to fix it is the consumers outside, including a Node one.
_(The consumer list is **unverified here** — it comes from the monorepo's `docs/migration/07-lemon-web-core.md`, surveyed 2026-08-07.)_

---

## 4. `dependencies` and `peerDependencies` declare the same three packages

`aws-sdk`, `axios` and `crypto-js` appear in both; `jwt-decode` is in `dependencies` only. A
consumer therefore installs them transitively **and** is asked to provide them.

Worth knowing when picking the ranges: inside `lemon-front-monorepo`, yarn hoists a single
`axios@1.19.0` and this package has no nested copy, so `^1.7.2` is already being satisfied by a
version well above its floor in at least one real deployment.

**Fixed in 1.5.4** by dropping `peerDependencies` entirely and keeping `dependencies`. That
direction is the non-breaking one: consumers keep getting the three packages installed for them, and
nothing that resolves today stops resolving. Dropping them from `dependencies` instead would have
required every consumer to add them, which is a major-version change.

---

## 5. The release lane has no test gate, and neither test script could serve as one

`.github/workflows/release.yml` is checkout → setup-node → pnpm install → `semantic-release`.
Nothing runs the test suite or the linter before publishing. The only automated check is a local
pre-push hook, which `--no-verify` skips.

**Correction.** The original text said the build does not run either. It does: `prepack`
(`pnpm build && clean-pkg-json`) is invoked by npm during publish, so a compile break already fails
the release. The proof is in the published tarball — `npm pack @lemoncloud/lemon-web-core@1.5.3`
then reading `package/package.json` out of it shows `scripts`, `devDependencies` and the
`release` block stripped, which is `clean-pkg-json`'s doing. (`files` survives; it is absent from
`npm view` output whether or not it was published, so `npm view` cannot settle this question — the
tarball can.) What the lane is missing is tests and lint, not the build. One local consequence:
running `npm pack` by hand rewrites the working `package.json` in place. Restore it afterwards.

Note also that `tsup` generates the declarations under this repository's `strict: false`, so the
build gate is weaker than finding 2's numbers might suggest.

**Adding a step is not sufficient on its own**, because neither script is usable in CI as written:

```json
"test":          "jest --passWithNoTests --updateSnapshot --watchAll",
"test:coverage": "jest --passWithNoTests --updateSnapshot --coverage"
```

-   `test` passes `--watchAll`, so in CI it would sit waiting for file changes instead of exiting.
-   **Both pass `--updateSnapshot`**, which rewrites a mismatched snapshot rather than failing on it.

The second point needs narrowing: the repository has no snapshots at all, so "a snapshot assertion
cannot fail here" is true only vacuously. The live exposure is the other half of the flag — the
first snapshot anyone writes gets created silently and passes on the run that introduced it.

**Fixed.** `test:ci` (`jest --ci --passWithNoTests`) was added alongside the existing scripts, and
`release.yml` now runs `pnpm lint` and `pnpm test:ci` before `semantic-release`. `--ci` additionally
makes jest refuse to write _new_ snapshots rather than creating them silently. `--updateSnapshot`
stays on the local `test` script, so the convenience survives without the gate losing its teeth.
The declarations are no longer generated under `strict: false` either — see finding 2.

The gate lives in `release.yml`, which triggers on push to `main`. So a red suite stops the
**publish**, not the merge. A PR-triggered workflow would be needed for pre-merge enforcement; that
is a separate decision and is not part of this work.

---

## 6. Two browser-hostile imports

Both matter because this is a browser library.

-   `src/utils/logger-helper.service.ts:1` — `import { format } from 'util'`, a Node builtin at the
    top level.
-   `src/core/aws-web.core.ts:19` and `src/http/aws-http-request.builder.ts:4` — `import AWS from
'aws-sdk/global.js'`. aws-sdk v2's Node `util` shim reads `process.env.NODE_DEBUG` and reaches for
    `global` at module scope with no guard, so a bundler that does not substitute both names produces
    a `ReferenceError` before any application code runs.

Both survive into the shipped bundle as externals, not just as source: line 1 of `dist/index.js`
carries `import { format } from 'util'` and `import b from 'aws-sdk/global.js'`, and `dist/index.cjs`
the matching `require()` calls.

Consumers currently paper over the second one themselves — apps in `lemon-front-monorepo` carry
`'process.env': {}` and `global: 'globalThis'` in their vite config specifically for this. **Neither
a production build nor this repository's test suite detects the absence**; only loading the page in
a real browser does. _(Correction: the original text said "a jsdom test suite". `jest.config.json`
sets `"testEnvironment": "node"`, so no jsdom environment runs here — `jest-environment-jsdom` is
installed but unused. The conclusion is unchanged, and node is if anything the more forgiving of the
two.)_

### The aws-sdk dependency is nearly all shim

Counted the actual surface used across the source:

| Symbol                   | Occurrences            |
| ------------------------ | ---------------------- |
| `AWS.Credentials`        | 20                     |
| `AWS.config.credentials` | 11 (+3 property reads) |
| `AWS.config`             | 8                      |

That is a credentials constructor and a global slot to write it into. Request signing is
implemented in this repository (`src/vendor/sig-v4.service.ts`), not delegated to the SDK. aws-sdk
v2 reached end of support in September 2025 and installs on the order of 100 MB.

### Done

Both imports are gone; `dependencies` is now `axios`, `crypto-js`, `jwt-decode`.

-   `util` — replaced by a local printf formatter in `logger-helper.service.ts` covering
    `%s %d %i %f %j %o %O %%`. `src/utils/logger-helper.service.spec.ts` checks it against Node's
    `util.format` for fourteen cases, since jest runs under node and can still reach the oracle the
    library no longer imports. One deviation is deliberate and asserted: objects render as JSON rather
    than through `util.inspect`.
-   `aws-sdk` — `AWS.Credentials` was only ever a carrier for three strings, and the code already had
    its own `LemonCredentials` type for exactly those. The public methods now return that type
    (finding 7 covers where the values live). `AWS.Credentials.get(cb)` was doing nothing for
    statically-constructed credentials, so its replacement is a presence check on the two required
    keys.

No shim is required now: line 1 of `dist/index.js` is `crypto-js`, `jwt-decode` and `axios` only.

---

## 7. Credentials live in global mutable state

`AWS.config.credentials` is written directly, so two `WebCore` instances on one page overwrite each
other. Worth keeping in mind if any consumer ever constructs more than one, and relevant to any
consumer running under Node rather than a browser.

### Done

The global is gone, and it was **not** replaced with an instance field. Token storage is now the one
place credentials live, which it already effectively was: every path that wrote the global wrote
storage first, through `saveOAuthToken()`. `AWSHttpRequestBuilder` reads credentials from the
`tokenStorage` it is already given — the same object it already reads the region and the identity
token from — so nothing had to be threaded through and its constructor is unchanged. Storage keys
are namespaced per `project`, so two cores no longer collide unless they are configured to share.

One behaviour changed for the better as a result. The global was populated by `init()`, so a page
that had credentials in storage but had not called `init()` sent **unsigned** requests;
`refreshCachedToken()` carried a `// NOTE: Set up AWS credentials first to enable signed requests`
line that existed only to paper over that gap. Reading storage directly closes it, and the NOTE
line is deleted. `logout()` still stops signing, because it clears the storage the signer reads.
Both directions are covered in `src/http/aws-http-request.builder.spec.ts`.

---

## 8. `docs/` is typedoc's output directory — **withdrawn as written**

**Correction.** The claim that "the generated tree is committed" is false. `git ls-files docs`
returns nothing and `docs/` does not exist in a clean checkout. `.github/workflows/typedoc.yml`
generates into `docs/` inside the CI workspace and hands that directory to
`peaceiris/actions-gh-pages`, which publishes it to the `gh-pages` branch; nothing is committed back
to `main`. The `.gitignore` observation was correct and the inference drawn from it was not.

What survives is narrower and does not need a decision: `typedoc.json` sets `"out": "./docs"`, so
anyone who runs `pnpm typedoc` locally gets an untracked `docs/` tree in their working copy, and
hand-written files placed there would be overwritten by that local run. Moving `out` to `docs/api/`
would remove even that, but with no hand-written `docs/` in the repository there is nothing at risk
today. This file lives in `notes/` and can stay there.

---

## Priority as this audit sees it

Every finding has now been acted on, in two releases.

1. **Finding 1** — a live defect on the auth path, cheap to fix, and the file already contained the
   correct pattern. **Done, 1.5.4.**
2. **Findings 3, 4, 5** — bounded cleanups and the missing gate, bundled into that same release.
   **Done, 1.5.4.**
3. **Findings 2, 6, 7** — `strict`, the browser-hostile imports and the global credential slot.
   These landed together because they are the same knot: removing aws-sdk deleted three of the
   `strict` errors outright, and `strict` is what would have caught finding 1 at compile time.
   **Done, next release.**

Finding 8 is withdrawn and needs nothing.

### How the version actually gets picked

Relevant to any plan that names a version, because this repository overrides the preset. The
`releaseRules` in `package.json` map `feat`, `fix`, `refactor` and `chore` all to **patch**; a minor
bump requires the commit **scope** `minor` (`feat(minor): …`) and a major requires scope `major`.
So a minor release is not something `feat:` produces here — the aws-sdk removal needed
`feat(minor):` to land as one. Two further consequences:

-   `docs:` has no rule and no release under the conventionalcommits preset. A branch that lands on
    `main` with only `docs:` commits publishes nothing — worth checking when a release seems to have
    silently not happened. If the merge is squashed, the squash title is the commit that counts.
-   `my-release` (`pnpm build && npm publish`) bypasses semantic-release, so it neither bumps the
    version nor writes the changelog, and it collides with whatever is already on npm. The lane is
    the push to `main`.

Nothing here blocks absorbing the source into the monorepo, which is tracked separately as D9 in
`lemon-front-monorepo/docs/migration/06-PLAN.md`.
