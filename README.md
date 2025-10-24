# 🚀 Enhanced MCP MSSQL Server

A production-ready Model Context Protocol (MCP) server for Microsoft SQL Server that provides AI agents with secure, stateless database access capabilities.

## ✨ **New Features & Enhancements**

- **🔒 Advanced Security**: SQL injection protection, query validation, and configurable security policies
- **📊 Health Monitoring**: Real-time performance metrics and connection health checks  
- **⚙️ Configuration Management**: Environment-specific settings for development and production
- **📦 Bulk Operations**: Efficient batch processing for large-scale data operations
- **🛡️ Enhanced Error Handling**: Structured errors with actionable information for AI agents
- **🎯 Production Ready**: Enterprise-grade monitoring and security capabilities

## 🛠️ **Available Tools (9 Total)**

### **Core Database Tools** (Enhanced)
1. **mssql_list_databases** - List all accessible databases
2. **mssql_list_tables** - List tables in a specific database  
3. **mssql_describe_table** - Get detailed table schema information
4. **mssql_query** - Execute queries with security validation and metrics
5. **mssql_sample_data** - Retrieve sample rows from tables
6. **mssql_get_relationships** - Discover foreign key relationships

### **New Advanced Tools**
7. **mssql_health_check** - Server health monitoring with performance metrics
8. **mssql_validate_query** - Security validation without query execution
9. **mssql_bulk_insert** - Efficient bulk data insertion operations

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build the project  
npm run build

# Configure your database (copy .env.example to .env)
cp .env.example .env

# Start the server
npm start

# Run tests (requires running MSSQL server)
npm test
```

## 🎯 What This Does

This MCP server allows AI agents to:
- **Connect** to MSSQL databases securely
- **Discover** database schemas (databases, tables, columns)
- **Query** data safely with read-only access
- **Explore** relationships and metadata
- **Sample** data for analysis without full table scans

## ✨ Key Features

- ✅ **Read-Only Safety**: Only SELECT queries allowed
- 🔒 **Secure Authentication**: Encrypted connections by default  
- 🔍 **Schema Discovery**: Automatic database structure exploration
- 📊 **Smart Sampling**: Get representative data without overload
- 🔗 **Relationship Mapping**: Understand foreign key connections
- 🛡️ **SQL Injection Protection**: Parameterized queries and validation

## 🛠️ Installation

**Prerequisites:**
- Node.js 18+
- Access to MSSQL Server (2008 R2+)
- Database user with read permissions

**Setup:**
1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to compile TypeScript
4. Configure your database connection (see Configuration section)

## 📝 Configuration

**No Configuration Required!** 

This MCP server is now **stateless** - you provide connection details when calling each tool. The AI agent will ask for your database credentials when needed.

For Claude Desktop, add to your configuration:

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["path/to/mcp-mssql-connector/dist/index.js"]
    }
  }
}
```

## 🔧 Available Tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `mssql_connect` | Connect to MSSQL server | server, user, password |
| `mssql_list_databases` | List available databases | - |
| `mssql_list_tables` | List tables in database | database |
| `mssql_describe_table` | Get table structure | database, table |
| `mssql_query` | Execute SELECT query | database, query, limit |
| `mssql_sample_data` | Get sample rows | database, table, limit |
| `mssql_get_relationships` | Get foreign keys | database, table |

## 💡 Usage Examples

**List databases:**
```
List all databases on server 'myserver.com' using username 'myuser' and password 'mypass'
```

**Explore structure:**
```
List all tables in the 'Northwind' database on myserver.com with my credentials
```

**Query data:**
```
Query "SELECT TOP 10 * FROM Customers WHERE Country = 'USA'" on Northwind database at myserver.com
```

**Understand relationships:**
```
Show foreign key relationships for the Orders table in Northwind database on myserver.com
```

## 🔒 Security

- **Read-Only**: Only SELECT statements allowed
- **Input Validation**: All parameters validated with Zod schemas
- **Connection Security**: TLS encryption enabled by default
- **Query Limits**: Automatic row limits prevent data dumps
- **Error Handling**: Safe error messages without exposing internals

## 📚 Documentation

- [📖 Detailed Usage Guide](./USAGE.md)
- [⚙️ Configuration Options](./CONFIG.md)  
- [📋 Requirements](./REQUIREMENTS.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

If you encounter issues:
1. Check the [Usage Guide](./USAGE.md) for common solutions
2. Verify your MSSQL server configuration  
3. Ensure proper database permissions
4. Open an issue with error details