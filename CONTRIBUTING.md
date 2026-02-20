# Contributing to Chopsticks

Thank you for your interest in contributing! Please read this guide before opening a pull request.

## Code of Conduct

Be respectful and constructive. We aim to keep this a welcoming project. Harassment or hostile behavior will not be tolerated.

## Getting Started

1. **Fork** the repository and clone your fork
2. **Install dependencies:** `npm install`
3. **Set up your environment:** `cp .env.example .env` and fill in your values
4. **Run tests:** `npm test` (all 90 tests should pass)

## Workflow

- Branch from `main` using `feat/<name>` or `fix/<name>`
- Open a Pull Request — even for solo work, it creates a clean review trail
- Keep PRs small and focused on a single concern
- Link to a related issue when applicable

## Local Development

```bash
npm install
npm run deploy:guild     # Deploy slash commands to your test guild
npm run start:all        # Start bot + agent runner together
```

## Code Standards

- Prefer explicit, defensive error handling — assume things can fail
- Avoid breaking existing behavior unless documented in the changelog
- Keep slash commands backwards compatible where possible
- No secrets in code — use `.env` variables for all credentials
- Run `npm test` before submitting a PR

## Submitting a Pull Request

1. Ensure tests pass: `npm test`
2. Describe *what* changed and *why* in the PR description
3. Reference any related issues
4. Keep the diff minimal — avoid reformatting unrelated code

## Reporting Issues

Use [GitHub Issues](../../issues) to report bugs or request features. Please include:
- Steps to reproduce
- Expected vs. actual behavior
- Node.js version and platform

## Release Process

- Maintainers update `CHANGELOG.md` and tag releases as `vX.Y.Z`
- Contributors don't need to manage releases

---

By contributing, you agree that your contributions are licensed under the project's [LICENSE](LICENSE).
