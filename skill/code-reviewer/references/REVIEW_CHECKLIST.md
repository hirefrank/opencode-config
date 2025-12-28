# Code Review Checklist

## Security Review

### Authentication & Authorization

- [ ] Session handling secure
- [ ] Token validation present
- [ ] Role checks on protected routes
- [ ] No hardcoded credentials
- [ ] OAuth state parameter validated

### Input Validation

- [ ] User input sanitized
- [ ] Query parameters validated
- [ ] File uploads restricted
- [ ] API input schemas defined
- [ ] Rate limiting implemented

### Secret Management

- [ ] No secrets in code
- [ ] Environment variables used
- [ ] .env not committed
- [ ] Secrets rotatable
- [ ] Minimal privilege access

### Common Vulnerabilities

- [ ] No SQL injection (parameterized queries)
- [ ] No XSS (output encoding)
- [ ] No command injection
- [ ] CORS properly configured
- [ ] CSP headers set

## Performance Review

### Bundle Size

- [ ] No large dependencies
- [ ] Tree-shaking enabled
- [ ] Dynamic imports for heavy components
- [ ] Images optimized
- [ ] < 1MB for Workers

### Data Loading

- [ ] Parallel data fetching
- [ ] Caching strategy defined
- [ ] No N+1 queries
- [ ] Pagination implemented
- [ ] Streaming for large responses

### Edge Optimization

- [ ] KV for read-heavy data
- [ ] Cache-Control headers set
- [ ] Geographic routing considered
- [ ] Async patterns used
- [ ] Non-blocking operations

### Resource Efficiency

- [ ] Connection pooling
- [ ] Memory limits respected
- [ ] CPU time budgeted
- [ ] Timeout handling
- [ ] Graceful degradation

## Cloudflare Review

### Workers Runtime

- [ ] No Node.js APIs (fs, path, process)
- [ ] Compatible npm packages
- [ ] Execution time < 30s
- [ ] Memory < 128MB
- [ ] No global state mutation

### Bindings

- [ ] KV bindings configured
- [ ] D1 queries optimized
- [ ] R2 uploads streamed
- [ ] DO accessed correctly
- [ ] Queues properly consumed

### Durable Objects

- [ ] State persisted to storage
- [ ] No async in constructor
- [ ] Alarms for scheduled work
- [ ] Hibernation handled
- [ ] ID strategy appropriate

### Error Handling

- [ ] Try/catch around bindings
- [ ] Meaningful error messages
- [ ] Proper status codes
- [ ] Logging for debugging
- [ ] Retry logic for transient failures

## Design Review

### Component Usage

- [ ] shadcn/ui components used correctly
- [ ] Props validated per docs
- [ ] Composition patterns followed
- [ ] No component prop hallucination
- [ ] Consistent styling approach

### Tailwind CSS

- [ ] Utility classes used
- [ ] No custom CSS unless necessary
- [ ] Responsive design implemented
- [ ] Dark mode supported (if applicable)
- [ ] Animation classes appropriate

### Accessibility (WCAG)

- [ ] Semantic HTML elements
- [ ] Alt text on images
- [ ] Form labels present
- [ ] Keyboard navigation works
- [ ] Color contrast sufficient
- [ ] Focus states visible
- [ ] Screen reader friendly

### User Experience

- [ ] Loading states shown
- [ ] Error states handled
- [ ] Empty states designed
- [ ] Success feedback provided
- [ ] Form validation inline

### Animation & Interaction

- [ ] Animations respect reduced motion
- [ ] Transitions smooth (< 300ms)
- [ ] No layout shift
- [ ] Touch targets adequate (44x44px)
- [ ] Hover states on interactive elements

## Code Quality

### TypeScript

- [ ] No `any` types
- [ ] Interfaces defined
- [ ] Strict mode enabled
- [ ] Error types explicit
- [ ] Generics used appropriately

### Testing

- [ ] Unit tests for logic
- [ ] Integration tests for APIs
- [ ] Edge cases covered
- [ ] Mocks appropriate
- [ ] Tests maintainable

### Documentation

- [ ] Complex logic commented
- [ ] Public APIs documented
- [ ] README updated
- [ ] CHANGELOG entry (if applicable)
- [ ] Breaking changes noted

### Maintainability

- [ ] Functions focused (single responsibility)
- [ ] DRY principles followed
- [ ] Naming descriptive
- [ ] Magic numbers avoided
- [ ] Dependencies updated

## PR-Specific Checks

### Changes Review

- [ ] All files in diff reviewed
- [ ] No unrelated changes included
- [ ] Commit messages clear
- [ ] Branch up to date with main
- [ ] Conflicts resolved properly

### Breaking Changes

- [ ] API compatibility maintained
- [ ] Migration path provided
- [ ] Deprecation warnings added
- [ ] Version bump appropriate
- [ ] Release notes prepared

### Configuration

- [ ] wrangler.toml correct
- [ ] Environment variables documented
- [ ] Feature flags properly used
- [ ] Build configuration valid
- [ ] Deployment settings verified

## Quick Reference

### High Priority Issues

🔴 **Security**: Credentials, injection, auth bypass
🔴 **Data Loss**: Missing persistence, race conditions
🔴 **Production**: Build failures, runtime errors

### Medium Priority Issues

🟡 **Performance**: Bundle size, N+1, caching
🟡 **Reliability**: Error handling, timeouts
🟡 **UX**: Loading states, error messages

### Low Priority Issues

🔵 **Style**: Formatting, naming conventions
🔵 **Docs**: Comments, README updates
🔵 **Tech Debt**: Refactoring opportunities
