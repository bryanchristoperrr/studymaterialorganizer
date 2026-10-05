# Constraints

## Hard Rules

### Technology Stack
- Do not change the technology stack (React/Node.js/TypeScript/SQLite) unless explicitly approved
- Do not add new dependencies without clear justification and approval
- Do not upgrade major versions of existing dependencies without testing

### Architecture Boundaries
- Do not bypass the existing API/service layer (no direct DB calls from UI)
- Do not put database logic directly in UI components
- Do not put business logic in controllers or repositories
- Do not mix frontend and backend code in the same files
- Maintain strict separation: UI → Service → Controller → Service → Repository → Database

### Code Reuse
- Do not duplicate existing components (check `components/common/` and `components/employee/` first)
- Do not create new utility functions if existing ones suffice
- Reuse validation schemas between frontend and backend where possible

### Security
- Do not expose secrets, API keys, or database credentials in code
- Do not log sensitive data (passwords, tokens, PII)
- Validate and sanitize all inputs on both client and server
- Use parameterized queries (no string interpolation in SQL)

### API Contracts
- Do not change public API endpoints without explicit approval
- Do not modify response formats without versioning
- Maintain backward compatibility for existing consumers

### Refactoring
- Do not make unrelated refactors during feature work
- Do not rename files, variables, or functions unless necessary for the current task
- Do not reorganize folder structure without approval

### Testing
- Do not disable or skip tests to make them pass
- Do not mock the database in integration tests (use real SQLite)
- Test files must be colocated with source files or in `__tests__` folders

### State Management
- Do not use global state (Context/Redux) for server data (use React Query or service layer)
- Do not store derived state (compute during render)
- Keep component state minimal and local

### Error Handling
- Do not swallow errors silently
- Do not expose stack traces or internal errors to users
- Always provide user-friendly error messages
- Log errors with context for debugging

### Performance
- Do not fetch unnecessary data (use pagination, select fields)
- Do not cause waterfall requests (parallelize independent calls)
- Do not re-render unnecessarily (memoize callbacks, use React.memo)

### Git & Commits
- Do not commit directly to main branch
- Do not commit `node_modules`, `dist`, `.env`, or build artifacts
- Do not commit large binary files
- Keep commits atomic and focused