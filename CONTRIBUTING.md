# Contributing to Joplin Portal

Thank you for your interest in contributing to Joplin Portal! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm
- Git
- Obsidian (for testing)
- Joplin desktop app or server (for testing)

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/eristoddle/joplin-portal.git
   cd joplin-portal
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development mode:
   ```bash
   npm run dev
   ```
5. Create a symbolic link to your Obsidian plugins folder for testing

### Project Structure

```
├── src/                    # Source code
│   ├── joplin-api-service.ts
│   ├── joplin-portal-view.ts
│   ├── settings.ts
│   └── types.ts
├── tests/                  # Test files
│   ├── unit/
│   └── integration/
├── scripts/                # Build and release scripts
├── main.ts                 # Plugin entry point
├── manifest.json           # Plugin manifest
└── styles.css             # Plugin styles
```

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/eristoddle/joplin-portal/issues)
2. If not, create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Obsidian version, Joplin version)
   - Screenshots if applicable

### Suggesting Features

1. Check [GitHub Discussions](https://github.com/eristoddle/joplin-portal/discussions) for existing suggestions
2. Create a new discussion with:
   - Clear description of the feature
   - Use case and benefits
   - Possible implementation approach

### Code Contributions

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes following our coding standards
3. Add or update tests as needed
4. Run the test suite:
   ```bash
   npm test
   ```
5. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: add search result caching"
   ```
6. Push to your fork and create a pull request

### Coding Standards

- Use TypeScript for all new code
- Follow existing code style and formatting
- Add JSDoc comments for public methods
- Write unit tests for new functionality
- Update integration tests when needed
- Ensure all tests pass before submitting

### Commit Message Format

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Test Categories

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test complete workflows
- **Manual Testing**: Test with real Joplin server

### Testing Guidelines

- Write tests for new features
- Update tests when modifying existing code
- Test both success and error scenarios
- Mock external dependencies (Joplin API)

## Release Process

Releases are handled by maintainers:

1. Version bump using semantic versioning
2. Update changelog
3. Create GitHub release
4. Submit to Obsidian community plugins (if applicable)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow GitHub's community guidelines

## Questions?

- Open a [Discussion](https://github.com/eristoddle/joplin-portal/discussions) for general questions
- Create an [Issue](https://github.com/eristoddle/joplin-portal/issues) for bugs
- Check the [Wiki](https://github.com/eristoddle/joplin-portal/wiki) for documentation

Thank you for contributing to Joplin Portal! 🎉