# Contributing to MCP MSSQL Connector

Thank you for your interest in contributing to the MCP MSSQL Connector! This document provides guidelines and information for contributors.

## 🚀 Quick Start

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/mcp-mssql-connector.git
   cd mcp-mssql-connector
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Test Database**
   ```bash
   # Using Docker (recommended)
   docker-compose up -d mssql
   
   # Or set up your own SQL Server instance
   # Update .env with your connection details
   cp .env.example .env
   ```

4. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

## 🛠️ Development Guidelines

### MCP Tool Development

When developing new MCP tools, follow these standards:

#### Tool Structure
```typescript
export const toolName: Tool = {
  name: 'mssql_tool_name',
  description: 'Clear description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      // Zod validation schema
    },
    required: ['server', 'database'] // Always include connection params
  }
};
```

#### Implementation Requirements
- ✅ **Error Handling**: Comprehensive try-catch with MCPError
- ✅ **Input Validation**: Zod schema validation for all parameters  
- ✅ **Security**: SQL injection protection via SecurityValidator
- ✅ **Performance**: Efficient database operations with proper cleanup
- ✅ **Documentation**: Clear JSDoc comments and examples

#### Security Standards
```typescript
// Always validate queries before execution
const validation = SecurityValidator.validateQuery(query);
if (!validation.isValid) {
  throw new MCPError(
    ErrorCode.InvalidRequest,
    `Security validation failed: ${validation.errors.join(', ')}`
  );
}
```

### Code Style

#### TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use async/await over Promises
- Implement proper error boundaries

#### Naming Conventions
- **Files**: kebab-case (`mcp-server.ts`)
- **Functions**: camelCase (`executeQuery`)
- **Classes**: PascalCase (`SecurityValidator`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **MCP Tools**: snake_case with prefix (`mssql_list_tables`)

#### Example Implementation
```typescript
/**
 * Lists all tables in a specified database
 * @implements {Tool}
 */
export const listTables: Tool = {
  name: 'mssql_list_tables',
  description: 'List all tables in a specified database with metadata',
  inputSchema: {
    type: 'object',
    properties: {
      server: { type: 'string', description: 'SQL Server hostname or IP' },
      database: { type: 'string', description: 'Database name' },
      includeViews: { type: 'boolean', default: false, description: 'Include views in results' }
    },
    required: ['server', 'database']
  }
};

async function handleListTables(args: any): Promise<ToolResult> {
  try {
    // 1. Validate inputs
    const config = ConnectionConfigSchema.parse(args);
    
    // 2. Security validation
    SecurityValidator.validateConnection(config);
    
    // 3. Execute operation
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA as schema_name,
        TABLE_NAME as table_name,
        TABLE_TYPE as table_type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ${args.includeViews ? "OR TABLE_TYPE = 'VIEW'" : ''}
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    // 4. Cleanup
    await pool.close();
    
    // 5. Return structured result
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result.recordset, null, 2)
      }]
    };
    
  } catch (error) {
    throw new MCPError(
      ErrorCode.InternalError,
      `Failed to list tables: ${error.message}`
    );
  }
}
```

## 🧪 Testing Standards

### Test Coverage Requirements
- ✅ **Unit Tests**: All new functions and classes
- ✅ **Integration Tests**: MCP tool end-to-end functionality
- ✅ **Security Tests**: Input validation and SQL injection protection
- ✅ **Performance Tests**: Query optimization and connection handling

### Test Structure
```javascript
// test.cjs example
describe('MCP Tool: mssql_list_tables', () => {
  beforeEach(() => {
    // Setup test database state
  });

  it('should list all tables with valid connection', async () => {
    const result = await testTool('mssql_list_tables', validConfig);
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
  });

  it('should handle invalid database gracefully', async () => {
    const invalidConfig = { ...validConfig, database: 'nonexistent' };
    await expect(testTool('mssql_list_tables', invalidConfig))
      .rejects.toThrow('Database does not exist');
  });

  it('should prevent SQL injection attempts', async () => {
    const maliciousConfig = { 
      ...validConfig, 
      database: "test'; DROP TABLE users; --" 
    };
    await expect(testTool('mssql_list_tables', maliciousConfig))
      .rejects.toThrow('Security validation failed');
  });
});
```

## 📚 Documentation Standards

### Code Documentation
- All public functions must have JSDoc comments
- Include @param, @returns, @throws annotations
- Provide usage examples in comments

### README Updates
When adding new features:
1. Update tool list in README.md
2. Add usage examples
3. Update configuration options
4. Include security considerations

## 🔄 Pull Request Process

### Before Submitting
1. ✅ **Tests Pass**: `npm test` succeeds
2. ✅ **Build Succeeds**: `npm run build` completes
3. ✅ **Security Audit**: `npm audit` shows no high-severity issues
4. ✅ **Code Style**: Follow established patterns
5. ✅ **Documentation**: Update relevant docs

### PR Description Template
```markdown
## 🎯 Summary
Brief description of changes

## 🔧 Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## 🧪 Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## 📋 Checklist
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Security implications considered
- [ ] Performance impact assessed
```

## 🛡️ Security Guidelines

### Input Validation
```typescript
// Always validate inputs with Zod schemas
const ConnectionConfigSchema = z.object({
  server: z.string().min(1),
  database: z.string().regex(/^[a-zA-Z0-9_-]+$/), // Prevent injection
  user: z.string().optional(),
  password: z.string().optional()
});
```

### Query Safety
```typescript
// Use parameterized queries
const request = pool.request();
request.input('userId', sql.Int, userId);
request.input('status', sql.NVarChar, status);
const result = await request.query(`
  SELECT * FROM Users 
  WHERE Id = @userId AND Status = @status
`);
```

### Error Handling
```typescript
// Don't expose sensitive information
catch (error) {
  console.error('Database error:', error); // Log full error
  throw new MCPError(
    ErrorCode.InternalError,
    'Database operation failed' // Generic message to client
  );
}
```

## 🎯 Issue Guidelines

### Bug Reports
- Use the bug report template
- Include minimal reproduction steps
- Specify environment details
- Attach relevant error logs

### Feature Requests
- Use the feature request template
- Explain the use case and business value
- Consider MCP protocol implications
- Provide implementation suggestions

## 📈 Performance Considerations

### Database Operations
- Use connection pooling efficiently
- Implement proper timeout handling
- Consider query optimization for large datasets
- Clean up resources properly

### Memory Management
```typescript
// Always close connections
try {
  const pool = await sql.connect(config);
  // ... database operations
} finally {
  if (pool) await pool.close();
}
```

## 🤝 Community

### Getting Help
- 📖 **Documentation**: Check README and docs/ directory
- 🐛 **Issues**: Search existing issues before creating new ones
- 💬 **Discussions**: Use GitHub Discussions for questions
- 📧 **Security**: Report security issues privately

### Contributing Workflow
1. 🍴 Fork the repository
2. 🌿 Create feature branch (`git checkout -b feature/amazing-feature`)
3. ✏️ Make your changes
4. 🧪 Add tests and documentation
5. ✅ Ensure all tests pass
6. 📝 Commit changes (`git commit -m 'Add amazing feature'`)
7. 📤 Push to branch (`git push origin feature/amazing-feature`)
8. 🔄 Open Pull Request

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the MCP MSSQL Connector! 🎉