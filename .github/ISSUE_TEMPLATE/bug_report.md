---
name: Bug Report
about: Create a report to help us improve the MCP MSSQL Connector
title: '[BUG] '
labels: 'bug'
assignees: ''
---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 🔧 MCP Tool Affected
Which MCP tool is experiencing issues?
- [ ] mssql_list_databases
- [ ] mssql_list_tables
- [ ] mssql_describe_table
- [ ] mssql_query
- [ ] mssql_sample_data
- [ ] mssql_get_relationships
- [ ] mssql_health_check
- [ ] mssql_validate_query
- [ ] mssql_bulk_insert
- [ ] Other (specify): _______________

## 🎯 Expected Behavior
A clear and concise description of what you expected to happen.

## 🚫 Actual Behavior
A clear and concise description of what actually happened.

## 📝 Steps to Reproduce
Steps to reproduce the behavior:
1. Configure MCP connection with '...'
2. Call tool '...' with parameters '...'
3. Observe error '...'

## 🖥️ Environment
- **OS**: [e.g. Windows 11, macOS Sonoma, Ubuntu 22.04]
- **Node.js version**: [e.g. 20.10.0]
- **MCP Connector version**: [e.g. 1.0.0]
- **Database**: [e.g. SQL Server 2019, Azure SQL Database]
- **MCP Client**: [e.g. Claude Desktop, Custom implementation]

## 📊 Database Configuration
```json
{
  "server": "your-server",
  "database": "your-database",
  "authentication": "sql-server / windows / azure-active-directory"
}
```

## 🔍 Error Output
If applicable, add the complete error message and stack trace:
```
Paste error output here
```

## 📸 Screenshots
If applicable, add screenshots to help explain your problem.

## 🔗 Additional Context
Add any other context about the problem here:
- Recent changes to database schema
- Network configuration issues  
- Performance concerns
- Security policy restrictions

## ✅ Checklist
- [ ] I have searched existing issues for similar problems
- [ ] I have included all relevant environment information
- [ ] I have provided steps to reproduce the issue
- [ ] I have included error messages and logs