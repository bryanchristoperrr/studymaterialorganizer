# Project Implementation Rules

## Employee Management CRUD Application

### Core Principles

- **Inspect before changing**: Always examine existing code, patterns, and conventions before making modifications
- **Reuse over recreate**: Leverage existing components, utilities, and patterns rather than building new ones
- **Focused changes**: Make minimal, targeted changes that address the specific requirement
- **Avoid unnecessary dependencies**: Don't add libraries or packages without clear justification
- **Consistent naming and structure**: Follow established folder structure, file naming, and code style conventions
- **Validate inputs**: Validate all user inputs on both client and server side
- **Handle errors properly**: Implement consistent error handling with user-friendly messages
- **No unrelated changes**: Don't refactor, rename, or modify code unrelated to the current task

### Code Quality Standards

- Write self-documenting code with clear variable and function names
- Add comments for complex logic, API interactions, and state management
- Keep functions small and single-purpose
- Use TypeScript for type safety (if using TypeScript stack)
- Follow RESTful API conventions for backend endpoints

### Git Practices

- Make atomic commits with clear messages
- Don't commit secrets, API keys, or sensitive configuration
- Keep changes scoped to the current feature/fix

### Architecture Adherence

- Follow the layered architecture defined in ARCHITECTURE.md
- UI components should not contain business logic or database calls
- Services handle API communication
- Business logic resides in service/repository layers
- Validation occurs at both UI and API layers