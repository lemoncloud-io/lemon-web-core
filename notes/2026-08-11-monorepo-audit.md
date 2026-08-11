# Findings from the lemon-front-monorepo absorption audit

**Date:** 2026-08-11 · **Version audited:** `1.5.3` (`e28860f`, `main`, identical to what npm serves)

These came out of measuring what it would take to absorb this package's source into
`lemon-front-monorepo` as a workspace library. The absorption itself has not happened. One of the
findings is a live defect in the published package rather than a preparation task, which is why
this is written down here rather than only in the monorepo's migration notes.

Everything below was verified by reading this repository's source at the commit above. Two claims
carried over from an earlier survey are marked **unverified here** where they appear.

---

## 1. Token refresh destroys the fallback it just computed — `src/core/aws-web.core.ts:417-421`

**This is a defect in the published package.** Three products currently run it.

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

`changeSite()` at `src/core/aws-web.core.ts:471-475` assembles the same kind of object and puts the
spread **first**:

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

The bad object does not stop at the caller. `buildCredentialsByToken()` → `buildAWSCredentialsByToken()`
calls `this.tokenStorage.saveOAuthToken(token)`, so the value is persisted:

| Step          | Code                                                         | Effect with a falsy `identityToken`                                                  |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| persist       | `aws-storage.service.ts:161`                                 | `setItem('identity_token', identityToken \|\| '')` stores `""`                       |
| session check | `aws-storage.service.ts:89`                                  | `isAuthenticated()` is `… && !!identityToken` → **false**                            |
| expiry        | `aws-storage.service.ts:168` → `token-storage.service.ts:81` | falls through the JWT branch to the 15-minute `FALLBACK_DURATION`                    |
| next refresh  | `aws-web.core.ts:418`                                        | `cached.identityToken` is now `""`, so the fallback has nothing left to fall back to |

So the failure mode is a refresh that reports success and leaves the session reading as signed out,
with the cached value that would have recovered it overwritten in the same pass.

**What is not established here:** whether the backend actually returns those keys with falsy
values. If it never does, the code is correct by accident. That is worth confirming before deciding
the priority — but the fallback lines exist precisely because someone expected the server not to
always send them, and in their current position they cannot do the job they were written for.

### Suggested fix

Move the spread first, matching `changeSite()`:

```ts
const refreshToken = {
    ...tokenData,
    identityToken: tokenData.identityToken || cached.identityToken,
    identityPoolId: tokenData.identityPoolId || cached.identityPoolId,
};
```

`identityPoolId` gains a fallback it did not have; if the intent was for the cached value to always
win there, write `identityPoolId: cached.identityPoolId` instead and the ordering still fixes it.

A regression test would want the case this misses: a refresh response that **carries** the key with
an empty value, not one that omits it. `src/core/aws-web.core.spec.ts` is the place.

---

## 2. `strict` would cost 15 errors, not a flood

The monorepo compiles with `strict: true`, `target: es2022`, `moduleResolution: bundler`. Compiled
this package's source under exactly that, inside that repository so `types: ["node"]` resolves:

| Scope                  | Errors |
| ---------------------- | ------ |
| product code, 24 files | **15** |
| jest specs, 5 files    | 233    |

The 233 are missing jest globals and are an artefact of the monorepo running vitest — they are not
a problem in this repository. The 15 break down as:

| Code               | Count | What                                                                                     |
| ------------------ | ----- | ---------------------------------------------------------------------------------------- |
| `TS7016`           | 4     | `crypto-js` subpath imports have no type declarations (`@types/crypto-js` not installed) |
| `TS18049`          | 3     | `AWS.config.credentials` may be `null`                                                   |
| `TS2322`           | 2     | the `WebCoreFactory` map does not satisfy `WebCoreConstructor`                           |
| `TS4115`           | 2     | parameter properties overriding a base member need `override`                            |
| `TS2345`, `TS2531` | 2     | a `string \| undefined` argument, a possibly-`null` object                               |
| `TS2783`           | 1     | finding 1 above                                                                          |

Tightening `strict` here is a bounded piece of work, and `TS2783` is the reason it is worth
considering: the current `strict: false` is what let finding 1 through.

---

## 3. `exports` cannot reach the CJS build — `package.json`

```json
"types": "./dist/index.d.ts",
"exports": "./dist/index.js"
```

`tsup` emits `dist/index.cjs` and `dist/index.d.cts` alongside the ESM pair, and the string form of
`exports` makes them unreachable: a CommonJS `require()` resolves to the ESM file. Conditional
exports would fix it:

```json
"exports": {
  ".": {
    "types": { "import": "./dist/index.d.ts", "require": "./dist/index.d.cts" },
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```

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

---

## 5. The release lane has no test gate, and neither test script could serve as one

`.github/workflows/release.yml` is checkout → setup-node → pnpm install → `semantic-release`.
Nothing runs the test suite, the linter or the build before publishing. The only automated check is
a local pre-push hook, which `--no-verify` skips.

**Adding a step is not sufficient on its own**, because neither script is usable in CI as written:

```json
"test":          "jest --passWithNoTests --updateSnapshot --watchAll",
"test:coverage": "jest --passWithNoTests --updateSnapshot --coverage"
```

-   `test` passes `--watchAll`, so in CI it would sit waiting for file changes instead of exiting.
-   **Both pass `--updateSnapshot`**, which rewrites a mismatched snapshot rather than failing on it.
    A snapshot assertion therefore cannot fail in this repository today, in CI or locally.

A CI-usable script is closer to `jest --ci --passWithNoTests`; `--ci` additionally makes jest refuse
to write _new_ snapshots rather than creating them silently on first run. Keeping `--updateSnapshot`
on a separate script preserves the local convenience without the gate losing its teeth.

---

## 6. Two browser-hostile imports

Both matter because this is a browser library.

-   `src/utils/logger-helper.service.ts:1` — `import { format } from 'util'`, a Node builtin at the
    top level.
-   `src/core/aws-web.core.ts:19` and `src/http/aws-http-request.builder.ts:4` — `import AWS from
'aws-sdk/global.js'`. aws-sdk v2's Node `util` shim reads `process.env.NODE_DEBUG` and reaches for
    `global` at module scope with no guard, so a bundler that does not substitute both names produces
    a `ReferenceError` before any application code runs.

Consumers currently paper over the second one themselves — apps in `lemon-front-monorepo` carry
`'process.env': {}` and `global: 'globalThis'` in their vite config specifically for this. **Neither
a production build nor a jsdom test suite detects the absence**; only loading the page in a real
browser does.

### The aws-sdk dependency is nearly all shim

Counted the actual surface used across the source:

| Symbol                   | Occurrences            |
| ------------------------ | ---------------------- |
| `AWS.Credentials`        | 20                     |
| `AWS.config.credentials` | 11 (+3 property reads) |
| `AWS.config`             | 8                      |

That is a credentials constructor and a global slot to write it into. Request signing is
implemented in this repository (`src/vendor/sig-v4.service.ts`), not delegated to the SDK. aws-sdk
v2 reached end of support in September 2025 and installs on the order of 100 MB, so replacing this
with a small local credentials type is a plausible 1.6.0 item — and it would remove the browser shim
requirement in finding 6 at the same time.

---

## 7. Credentials live in global mutable state

`AWS.config.credentials` is written directly, so two `WebCore` instances on one page overwrite each
other. Worth keeping in mind if any consumer ever constructs more than one, and relevant to any
consumer running under Node rather than a browser.

---

## 8. `docs/` is typedoc's output directory

`typedoc.json` sets `"out": "./docs"` and `.github/workflows/typedoc.yml` runs
`npx typedoc --out docs`, so anything hand-written under `docs/` is generated over. `docs/` is not
in `.gitignore` either, so the generated tree is committed. That is why this file lives in `notes/`.

Worth deciding one way or the other: either gitignore `docs/` and treat it as build output, or move
typedoc's `out` somewhere like `docs/api/` so hand-written documentation has a home.

---

## Priority as this audit sees it

1. **Finding 1** — a live defect on the auth path, cheap to fix, and the file already contains the
   correct pattern.
2. **Finding 5** — no test gate, and no test script that could be one. That combination is what
   lets a fix like finding 1 regress without anyone noticing.
3. **Findings 2, 3, 4** — bounded cleanups, natural to bundle into one release.
4. **Findings 6, 7** — a 1.6.0 conversation, not a patch.
5. **Finding 8** — housekeeping, but it decides where documentation can live.

Nothing here blocks absorbing the source into the monorepo, which is tracked separately as D9 in
`lemon-front-monorepo/docs/migration/06-PLAN.md`.
