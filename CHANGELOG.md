## [2.1.2](https://github.com/rungalileo/galileo-js/compare/v2.1.1...v2.1.2) (2026-05-14)

### Bug Fixes

- **logStreamName:** Updated fields using previous format to logStreamName. ([#600](https://github.com/rungalileo/galileo-js/issues/600)) ([0bc6147](https://github.com/rungalileo/galileo-js/commit/0bc6147987f77be1d1b401f6a556b974568acde1))
- **utils:** Small refactoring to remove functions not exposed in equivalent Python SDK implementation. ([#590](https://github.com/rungalileo/galileo-js/issues/590)) ([9d7212a](https://github.com/rungalileo/galileo-js/commit/9d7212adb99f5993aa8c4cd61c8a281a4b67e492))

## Unreleased

### BREAKING CHANGES

- **singleton:** `init()`, `getLogger()`, `reset()`, `flush()` now accept `logStreamName` instead of `logstream`. This reverts the parameter renames introduced in PR #373 and restores consistency with `GalileoLoggerConfig.logStreamName`, `enableMetrics({ logStreamName })`, and the env var `GALILEO_LOG_STREAM_NAME`. The new name disambiguates the _name string_ from the `LogStream` entity. Callers must rename the property at call sites — no runtime fallback. OTel handler config (`GalileoOTLPExporterConfig.logstream`) and `GalileoSpanProcessor` are not affected by this change and remain on `logstream` until a separate follow-up.

### Bug Fixes

- **singleton:** `init()` now forwards `projectId` to `getLogger()` (previously dropped — latent bug).

## [2.1.1](https://github.com/rungalileo/galileo-js/compare/v2.1.0...v2.1.1) (2026-05-08)

### Bug Fixes

- **conclude:** Updated conclude contract to run without parameters. ([#592](https://github.com/rungalileo/galileo-js/issues/592)) ([4455100](https://github.com/rungalileo/galileo-js/commit/4455100963604eabb23c2e240be972535ce87417))
- dynamic header hook for OTEL SDK 0.200+ compatibility ([#598](https://github.com/rungalileo/galileo-js/issues/598)) ([2a17688](https://github.com/rungalileo/galileo-js/commit/2a17688046fee5eb7cb3780beb07f4ba5b0415f5))
- **node:** Updating logging for missing root node (langchain). ([#586](https://github.com/rungalileo/galileo-js/issues/586)) ([2a2242f](https://github.com/rungalileo/galileo-js/commit/2a2242f935458a409e628eb619827a6662e9c24e))
- **workflow:** Removed conflicting assets field on semantic release. ([#595](https://github.com/rungalileo/galileo-js/issues/595)) ([fc09ed6](https://github.com/rungalileo/galileo-js/commit/fc09ed6d5dc80f9b64a4364fe49cfd8a1e9ebf48))

# [2.1.0](https://github.com/rungalileo/galileo-js/compare/v2.0.0...v2.1.0) (2026-05-06)

### Bug Fixes

- **auth:** Removed dependencies that forced use of npm token, reorganized new release workflow to use trusted publishing. ([#555](https://github.com/rungalileo/galileo-js/issues/555)) ([ab5e2b7](https://github.com/rungalileo/galileo-js/commit/ab5e2b7d42ee0b2172c6206c2517a54fe80b2aa4))
- **dependencies:** Removed unecessary dependencies from workflow, and need for npm secret. ([#553](https://github.com/rungalileo/galileo-js/issues/553)) ([0443c6c](https://github.com/rungalileo/galileo-js/commit/0443c6c8cadc6e1fde73379781878e19c1473b03))
- **metadata:** Created type to unify parameters for startSession functions, including metadata in missing case. ([#560](https://github.com/rungalileo/galileo-js/issues/560)) ([38b43b6](https://github.com/rungalileo/galileo-js/commit/38b43b6b1334780a8eb44450495f00c6483d6b0b))
- **name:** Default node name setup removed, falling to node type as new default. ([#584](https://github.com/rungalileo/galileo-js/issues/584)) ([bd3278d](https://github.com/rungalileo/galileo-js/commit/bd3278da3b86c9f81f8de24460d8235555470a74))
- **security:** Removed typosquat 'typecript' and added 'typescript' package instead, updated override on dependency to resolve conflict in nested peer dependency (openai). ([#568](https://github.com/rungalileo/galileo-js/issues/568)) ([8f2183c](https://github.com/rungalileo/galileo-js/commit/8f2183ca4a39ebf3bed71360c079cf93ab891124))
- **security:** Updated axios to latest (1.15.1), along with a couple of related dependencies. ([#569](https://github.com/rungalileo/galileo-js/issues/569)) ([f663020](https://github.com/rungalileo/galileo-js/commit/f66302037436268191e00f841fbaec7a1d1717e2))
- **token:** Updated token name. ([#572](https://github.com/rungalileo/galileo-js/issues/572)) ([beb5384](https://github.com/rungalileo/galileo-js/commit/beb53843f92f72b6e8f5fb743c55ac82da41afc8))
- **workflow:** Refactored release workflow to run under the repo's rules. ([#594](https://github.com/rungalileo/galileo-js/issues/594)) ([ade7d6e](https://github.com/rungalileo/galileo-js/commit/ade7d6e28463a0e1c3435f59d52d5eecaf9b08c1))
- **workflow:** release workflow OIDC ([#579](https://github.com/rungalileo/galileo-js/issues/579)) ([e96ce9c](https://github.com/rungalileo/galileo-js/commit/e96ce9c6c23c216f9a14d7131b0f391b81219fa2))

### Features

- add metricAggregates + getExperimentColumns, deprecate aggregateMetrics ([#591](https://github.com/rungalileo/galileo-js/issues/591)) ([a1bb690](https://github.com/rungalileo/galileo-js/commit/a1bb690c3f37c97a3aeacf74e727c96a3424c477))
- add OpenTelemetry tracing support ([#551](https://github.com/rungalileo/galileo-js/issues/551)) ([a22a1d9](https://github.com/rungalileo/galileo-js/commit/a22a1d940d0aa448573feafc254f892f276f92ff))
- **handlers:** Improved use of ingestionHook in handlers, fixed rootNode concurrency issue, updated docs. ([#564](https://github.com/rungalileo/galileo-js/issues/564)) ([29750d0](https://github.com/rungalileo/galileo-js/commit/29750d084f03ff2506e1f6a36fd0d9e3ba361813))
- **langchain:** Initial push of new features. ([#544](https://github.com/rungalileo/galileo-js/issues/544)) ([6da59b7](https://github.com/rungalileo/galileo-js/commit/6da59b7beac85cac7744ca7def5c184a8357ed48))
- **slack:** Added logging for Slack notification error. ([#558](https://github.com/rungalileo/galileo-js/issues/558)) ([6f900ee](https://github.com/rungalileo/galileo-js/commit/6f900eee7ce98ba3844b02ea200a62a4c4c7f7f9))
- **terminate:** Implemented logger termination. ([#573](https://github.com/rungalileo/galileo-js/issues/573)) ([da808f2](https://github.com/rungalileo/galileo-js/commit/da808f2a896dacd315f28dee5308d13a1452027b))
- **workflow:** Implementing testing workflow to run e2e-testing suite for release ([#550](https://github.com/rungalileo/galileo-js/issues/550)) ([ada1db8](https://github.com/rungalileo/galileo-js/commit/ada1db8a9143376a371d0c3fc6d9031017007243))
- **workflow:** Update to better support tracking triggered workflow. ([#556](https://github.com/rungalileo/galileo-js/issues/556)) ([2c6d815](https://github.com/rungalileo/galileo-js/commit/2c6d815f98fc82deca76b7bbc037be0b50c51883))
