# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Fixed
- Removed duplicate Android activity name attribute that made the manifest invalid.
- Disabled Android app backup until secrets and local project data have an explicit backup policy.
- Removed broad legacy/shared-storage and foreground-service permissions that were not justified by implemented features.

### Changed
- README now distinguishes the product vision from implemented and verified functionality.
- Added an implementation-status audit with concrete blockers and acceptance gates.

### Known limitations
- Core routes and modules referenced by the app are absent from the current repository tree.
- The app store persists provider and GitHub credentials through localStorage JSON persistence; this is not encrypted secure storage.
- The current APK workflow expects pnpm and a lockfile that are not present in the repository.
- Android resources and Gradle wrapper files are missing; a reproducible APK build is not yet established.
- No evidence currently confirms a successful production web build, end-to-end tests, or installable APK.
