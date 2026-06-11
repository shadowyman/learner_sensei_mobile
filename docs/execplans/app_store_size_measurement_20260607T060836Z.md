# Measure Current iOS App Store Size

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `docs/protocols/PLAN.md`, which requires a self-contained live execution record before and during multi-step work.

## Purpose / Big Picture

The user wants the current Recursive Sensei iOS app size as it would stand when published to the App Store. The useful result is not the repository size; it is the size of a Release iOS archive and, if signing/export allows, the exported `.ipa` that approximates the App Store download artifact. This plan attempts to create a Release archive from the existing React Native iOS project under `SenseiMobile/ios`, export it into `/private/tmp`, and report measured sizes with enough evidence that another agent can reproduce or continue the task.

## Progress

- [x] (2026-06-07 06:08Z) Read `docs/protocols/PLAN.md` completely before creating this ExecPlan.
- [x] (2026-06-07 06:08Z) Created this ExecPlan under `docs/execplans/` and chose `/private/tmp` for generated archive/export artifacts.
- [ ] Discover the iOS workspace or project, available schemes, configuration names, and whether CocoaPods state is present.
- [ ] Run a Release archive command with output capped in the chat log but full build logs available through Xcode's derived data if needed.
- [ ] If archive succeeds, attempt an `.ipa` export with an export options file in `/private/tmp`; if export is blocked by signing credentials, record the exact blocking condition.
- [ ] Measure and report archive size, exported IPA size when available, and the practical App Store size interpretation.

## Surprises & Discoveries

No surprises have been discovered yet.

## Decision Log

- Decision: Use `/private/tmp/recursive-sensei-appstore-size-20260607T060836Z` for archive and export outputs.
  Rationale: The repository instructions keep generated documents in `docs` and miscellaneous files in `tmp`, but a Release archive is large generated state rather than source. `/private/tmp` is writable, avoids dirtying the repo with build artifacts, and is safe to delete after measurement.
  Date/Author: 2026-06-07 06:08Z / Codex.

- Decision: Treat the target as the React Native iOS app with embedded `WKWebView`, not a SwiftUI app.
  Rationale: Repository guidance identifies Phase 1 as a React Native iOS shell using WebView assets under `SenseiMobile/app_web/webview_dist`, and previous user preference requires avoiding SwiftUI wording for this app.
  Date/Author: 2026-06-07 06:08Z / Codex.

## Outcomes & Retrospective

No outcome yet. The task is complete only when a measured archive or IPA size is reported, or when a specific external blocking condition such as missing signing credentials is documented.

## Context and Orientation

The current repository root is `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`. The iOS app lives under `SenseiMobile`. The React Native source files live under `SenseiMobile/src`, and the embedded WebView build lives under `SenseiMobile/app_web/webview_dist`. The iOS native project is expected under `SenseiMobile/ios`. An Xcode archive is a Release build bundle ending in `.xcarchive`; it contains the built app and debug symbol files. An `.ipa` is a zipped iOS app package produced by exporting an archive. Apple's App Store reports device-thinned compressed download sizes after App Store processing, so a locally exported `.ipa` is a close practical proxy, not a perfect final App Store Connect number.

## Plan of Work

First, inspect `SenseiMobile/ios` to determine whether the app uses an `.xcworkspace` from CocoaPods or a raw `.xcodeproj`, and list schemes with `xcodebuild -list`. Second, run an archive command for a generic iOS device destination and Release configuration, writing the archive to `/private/tmp/recursive-sensei-appstore-size-20260607T060836Z/RecursiveSensei.xcarchive`. Third, if the archive succeeds, create an export options property list in `/private/tmp` and run `xcodebuild -exportArchive` to produce an `.ipa`. Fourth, measure the `.xcarchive`, `.app`, dSYM, and `.ipa` sizes with `du` and `ls`, and interpret the result for App Store size.

No repository source files should be modified. If generated files are needed, they should be written under `/private/tmp`. If signing or account credentials block the export, stop after documenting the exact error and report the archive size plus why IPA size cannot be produced in this environment.

## Concrete Steps

Run commands from `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh` unless a command explicitly changes to `SenseiMobile/ios`. Build, validation, and archive command output must be capped in chat logs to protect context. For example, use `2>&1 | tail -c 20000` for large dynamic output while preserving the command's exit status through shell `pipefail`.

The initial discovery commands are:

    find SenseiMobile/ios -maxdepth 2 -name '*.xcworkspace' -o -name '*.xcodeproj' -o -name 'Podfile' -o -name 'ExportOptions.plist'
    xcodebuild -list -workspace SenseiMobile/ios/<workspace>.xcworkspace

The archive command will be shaped after discovery, likely:

    xcodebuild archive -workspace SenseiMobile/ios/<workspace>.xcworkspace -scheme <scheme> -configuration Release -destination generic/platform=iOS -archivePath /private/tmp/recursive-sensei-appstore-size-20260607T060836Z/RecursiveSensei.xcarchive -derivedDataPath /private/tmp/recursive-sensei-appstore-size-20260607T060836Z/DerivedData

The export command, if signing allows, will use `xcodebuild -exportArchive` and an export options file under `/private/tmp/recursive-sensei-appstore-size-20260607T060836Z`.

## Validation and Acceptance

Acceptance is a measured result. The strongest acceptance is an exported `.ipa` file with a byte size and human-readable size. If export is blocked, acceptable partial evidence is a successful `.xcarchive` with measured `.app` and archive sizes plus the exact export blocker. If even archive is blocked, the final answer must include the specific command, the failure class, and a practical next step such as opening Xcode signing settings or providing a development team.

## Idempotence and Recovery

The archive/export directory is timestamped under `/private/tmp`, so rerunning this plan should not overwrite prior user files. If a command partially creates an archive, rerun with the same path only after confirming the previous output is incomplete or use a new timestamped directory. No destructive repository commands are needed. No git commands are needed.

## Artifacts and Notes

Artifacts will be placed under:

    /private/tmp/recursive-sensei-appstore-size-20260607T060836Z

Important command summaries and measurements should be added here as they are produced.

## Interfaces and Dependencies

This task depends on the local Xcode command line tools, the existing iOS project files under `SenseiMobile/ios`, CocoaPods outputs if the app uses pods, and local signing configuration if exporting an `.ipa` requires a certificate, provisioning profile, or development team. No new application interfaces or source modules are introduced.

Revision note, 2026-06-07 06:08Z: Initial plan created to measure current iOS App Store size without modifying source files.
