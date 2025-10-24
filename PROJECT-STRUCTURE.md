# 📁 Project Structure

## **Clean, Production-Ready MCP MSSQL Server**

```
mcp-mssql-connector/
│
├── 📄 Core Files
│   ├── package.json              # Node.js project configuration
│   ├── tsconfig.json             # TypeScript configuration
│   ├── README.md                 # Main documentation
│   ├── LICENSE                   # MIT License
│   └── .gitignore               # Git ignore rules
│
├── 📂 Source Code
│   └── src/
│       └── index.ts             # Main MCP server implementation
│
├── 📂 Compiled Output
│   └── dist/
│       ├── index.js             # Compiled JavaScript (ES modules)
│       ├── index.d.ts           # TypeScript declarations
│       └── *.map                # Source maps
│
├── 📂 Configuration
│   ├── config/
│   │   └── mcp-config.json      # Server configuration (dev/prod)
│   └── .env.example             # Environment template
│
├── 🐳 Docker Support
│   ├── Dockerfile               # Container build instructions
│   ├── docker-compose.yml       # Complete test environment
│   ├── .dockerignore            # Docker ignore rules
│   └── init-scripts/
│       └── 01-init.sql          # Test database setup
│
├── 📖 Documentation
│   ├── ENHANCEMENTS.md          # Feature enhancement summary
│   ├── docs/
│   │   └── production-guide.md  # Production deployment guide
│   └── Requirement Document for MCP Tool – MSSQ.yml  # Original requirements
│
└── 🧪 Testing
    └── test.cjs                 # Comprehensive test suite
```

## **File Purpose & Usage**

### **Essential Production Files**
- `src/index.ts` - Main server with 9 MCP tools
- `config/mcp-config.json` - Environment-based configuration  
- `Dockerfile` + `docker-compose.yml` - Container deployment
- `package.json` - Dependencies and scripts

### **Development & Testing** 
- `test.cjs` - Complete test suite for all features
- `init-scripts/01-init.sql` - Test database with sample data
- `.env.example` - Configuration template

### **Documentation**
- `README.md` - Quick start and usage guide
- `ENHANCEMENTS.md` - Complete feature summary
- `docs/production-guide.md` - Enterprise deployment guide

## **Available NPM Scripts**

```bash
npm run build           # Compile TypeScript to JavaScript
npm start              # Run the MCP server
npm test               # Run comprehensive test suite
npm run dev            # Development mode with auto-restart
npm run docker:build   # Build Docker image
npm run docker:compose # Start complete test environment
```

## **Key Features Implemented**

✅ **9 MCP Tools** (6 core + 3 advanced)
✅ **Advanced Security** (SQL injection protection, query validation)
✅ **Health Monitoring** (performance metrics, connection health)
✅ **Configuration Management** (environment-specific settings)
✅ **Bulk Operations** (efficient data processing)
✅ **Docker Support** (containerized deployment)
✅ **Production Ready** (error handling, logging, monitoring)

## **Clean Architecture**

- **Single Source File**: All functionality in `src/index.ts`
- **Minimal Dependencies**: Only essential packages (MCP SDK, mssql, zod)
- **Environment Agnostic**: Works in Node.js, Docker, or cloud platforms
- **Stateless Design**: No persistent state, connection info provided per call
- **Comprehensive Testing**: Single test file covers all functionality

This structure follows best practices for production MCP servers with clean separation of concerns, comprehensive testing, and enterprise deployment support.