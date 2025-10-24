#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import sql from 'mssql';

// Security and configuration interfaces
interface SecurityConfig {
  enableQueryValidation: boolean;
  maxQueryLength: number;
  allowedOperations: string[];
  blockedKeywords: string[];
  maxRowsPerQuery: number;
}

interface MCPConfig {
  security: SecurityConfig;
  connectionDefaults: {
    requestTimeout: number;
    connectionTimeout: number;
    pool: {
      max: number;
      min: number;
      idleTimeoutMillis: number;
    };
  };
  features: {
    enableCaching: boolean;
    cacheTimeout: number;
    enableMetrics: boolean;
    maxConcurrentQueries: number;
  };
}

// Default configuration - simplified for better ES module compatibility
const DEFAULT_CONFIG: MCPConfig = {
  security: {
    enableQueryValidation: true,
    maxQueryLength: 10000,
    allowedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'],
    blockedKeywords: ['xp_cmdshell', 'sp_execute', 'openrowset', 'opendatasource', 'bulk', 'exec(', 'execute('],
    maxRowsPerQuery: 10000
  },
  connectionDefaults: {
    requestTimeout: 30000,
    connectionTimeout: 15000,
    pool: {
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000
    }
  },
  features: {
    enableCaching: true,
    cacheTimeout: 300,
    enableMetrics: true,
    maxConcurrentQueries: 5
  }
};

// Environment-specific configuration override
if (process.env.NODE_ENV === 'production') {
  DEFAULT_CONFIG.security.allowedOperations = ['SELECT'];
  DEFAULT_CONFIG.security.maxQueryLength = 5000;
  DEFAULT_CONFIG.security.maxRowsPerQuery = 1000;
  DEFAULT_CONFIG.features.maxConcurrentQueries = 3;
}

// Connection configuration schema that will be included in each tool call
const ConnectionSchema = z.object({
  server: z.string().describe('MSSQL Server hostname or IP address'),
  port: z.number().default(1433).describe('Port number (default: 1433)'),
  user: z.string().describe('Username for authentication'),
  password: z.string().describe('Password for authentication'),
  database: z.string().optional().describe('Database name (optional)'),
  encrypt: z.boolean().default(true).describe('Use encrypted connection'),
  trustServerCertificate: z.boolean().default(true).describe('Trust server certificate'),
});

type ConnectionConfig = z.infer<typeof ConnectionSchema>;

// Security validation functions
class SecurityValidator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  validateQuery(query: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.enableQueryValidation) {
      return { isValid: true, errors: [] };
    }

    // Check query length
    if (query.length > this.config.maxQueryLength) {
      errors.push(`Query exceeds maximum length of ${this.config.maxQueryLength} characters`);
    }

    // Check for blocked keywords
    const lowercaseQuery = query.toLowerCase();
    for (const keyword of this.config.blockedKeywords) {
      if (lowercaseQuery.includes(keyword.toLowerCase())) {
        errors.push(`Query contains blocked keyword: ${keyword}`);
      }
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /;\s*(drop|truncate|alter)\s+/i,
      /union\s+.*select/i,
      /\/\*.*\*\//g, // Block comments (potential SQL injection)
      /--.*$/gm,     // Line comments in suspicious contexts
      /xp_[\w]+/i,
      /sp_[\w]+/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        errors.push(`Query contains potentially dangerous pattern: ${pattern.source}`);
      }
    }

    // Validate allowed operations
    if (this.config.allowedOperations.length > 0) {
      const firstWord = query.trim().split(/\s+/)[0]?.toUpperCase();
      if (firstWord && !this.config.allowedOperations.includes(firstWord)) {
        errors.push(`Operation '${firstWord}' is not allowed. Allowed operations: ${this.config.allowedOperations.join(', ')}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  sanitizeQuery(query: string): string {
    // Basic sanitization
    return query
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*.*?\*\//g, '') // Remove block comments
      .trim();
  }
}

// Enhanced error handling
class MCPError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string = 'GENERAL_ERROR', details?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

class MSSQLMCPServer {
  private server: Server;
  private config: MCPConfig;
  private securityValidator: SecurityValidator;
  // Cache connections by connection string to reuse them
  private connectionPools: Map<string, sql.ConnectionPool> = new Map();
  // Performance metrics
  private metrics = {
    totalQueries: 0,
    failedQueries: 0,
    avgExecutionTime: 0,
    connectionCount: 0,
    cacheHits: 0
  };

  constructor(config: MCPConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.securityValidator = new SecurityValidator(config.security);
    
    this.server = new Server(
      {
        name: 'mcp-mssql-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private createConnectionKey(config: ConnectionConfig): string {
    return `${config.server}:${config.port}:${config.user}:${config.database || 'default'}`;
  }

  private async getConnection(config: ConnectionConfig): Promise<sql.ConnectionPool> {
    const connectionKey = this.createConnectionKey(config);
    
    if (this.connectionPools.has(connectionKey)) {
      const pool = this.connectionPools.get(connectionKey)!;
      if (pool.connected) {
        this.metrics.cacheHits++;
        return pool;
      } else {
        // Remove disconnected pool
        this.connectionPools.delete(connectionKey);
      }
    }

    try {
      // Create new connection with enhanced configuration
      const poolConfig = {
        server: config.server,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        options: {
          encrypt: config.encrypt,
          trustServerCertificate: config.trustServerCertificate,
        },
        pool: {
          max: this.config.connectionDefaults.pool.max,
          min: this.config.connectionDefaults.pool.min,
          idleTimeoutMillis: this.config.connectionDefaults.pool.idleTimeoutMillis,
        },
        requestTimeout: this.config.connectionDefaults.requestTimeout,
        connectionTimeout: this.config.connectionDefaults.connectionTimeout,
      };

      const pool = new sql.ConnectionPool(poolConfig);
      await pool.connect();
      this.connectionPools.set(connectionKey, pool);
      this.metrics.connectionCount++;
      return pool;
    } catch (error) {
      this.metrics.failedQueries++;
      throw new MCPError(
        `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`,
        'CONNECTION_ERROR',
        {
          server: config.server,
          port: config.port,
          database: config.database,
          originalError: error instanceof Error ? error.name : 'Unknown'
        }
      );
    }
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'mssql_list_databases',
            description: 'List all databases the user has access to',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password'],
            },
          },
          {
            name: 'mssql_list_tables',
            description: 'List all tables in a database',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                database: { type: 'string', description: 'Database name' },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password', 'database'],
            },
          },
          {
            name: 'mssql_describe_table',
            description: 'Get detailed information about a table structure',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                database: { type: 'string', description: 'Database name' },
                table: { type: 'string', description: 'Table name' },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password', 'database', 'table'],
            },
          },
          {
            name: 'mssql_query',
            description: 'Execute a read-only SELECT query',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                database: { type: 'string', description: 'Database name' },
                query: { type: 'string', description: 'SQL SELECT query to execute' },
                limit: { type: 'number', description: 'Maximum number of rows to return (default: 100)', default: 100 },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password', 'database', 'query'],
            },
          },
          {
            name: 'mssql_sample_data',
            description: 'Get sample data from a table',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                database: { type: 'string', description: 'Database name' },
                table: { type: 'string', description: 'Table name' },
                limit: { type: 'number', description: 'Number of sample rows (default: 10)', default: 10 },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password', 'database', 'table'],
            },
          },
          {
            name: 'mssql_get_relationships',
            description: 'Get foreign key relationships for tables',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                database: { type: 'string', description: 'Database name' },
                table: { type: 'string', description: 'Table name (optional - if not provided, gets all relationships)' },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password', 'database'],
            },
          },
          {
            name: 'mssql_health_check',
            description: 'Check database server health and connectivity with performance metrics',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
                includeMetrics: { type: 'boolean', description: 'Include performance metrics (default: true)', default: true },
              },
              required: ['server', 'user', 'password'],
            },
          },
          {
            name: 'mssql_validate_query',
            description: 'Validate a SQL query for security and syntax without executing it',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'SQL query to validate' },
                includeOptimizations: { type: 'boolean', description: 'Include optimization suggestions (default: false)', default: false },
              },
              required: ['query'],
            },
          },
          {
            name: 'mssql_bulk_insert',
            description: 'Insert multiple rows efficiently using bulk operations',
            inputSchema: {
              type: 'object',
              properties: {
                server: { type: 'string', description: 'MSSQL Server hostname or IP address' },
                port: { type: 'number', description: 'Port number (default: 1433)', default: 1433 },
                user: { type: 'string', description: 'Username for authentication' },
                password: { type: 'string', description: 'Password for authentication' },
                database: { type: 'string', description: 'Database name' },
                table: { type: 'string', description: 'Target table name' },
                data: { type: 'array', description: 'Array of objects representing rows to insert' },
                encrypt: { type: 'boolean', description: 'Use encrypted connection (default: true)', default: true },
                trustServerCertificate: { type: 'boolean', description: 'Trust server certificate (default: true)', default: true },
              },
              required: ['server', 'user', 'password', 'database', 'table', 'data'],
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'mssql_list_databases':
            return await this.handleListDatabases(args);
          case 'mssql_list_tables':
            return await this.handleListTables(args);
          case 'mssql_describe_table':
            return await this.handleDescribeTable(args);
          case 'mssql_query':
            return await this.handleQuery(args);
          case 'mssql_sample_data':
            return await this.handleSampleData(args);
          case 'mssql_get_relationships':
            return await this.handleGetRelationships(args);
          case 'mssql_health_check':
            return await this.handleHealthCheck(args);
          case 'mssql_validate_query':
            return await this.handleValidateQuery(args);
          case 'mssql_bulk_insert':
            return await this.handleBulkInsert(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleListDatabases(args: any) {
    const config = ConnectionSchema.parse(args);
    const pool = await this.getConnection(config);
    
    const request = pool.request();
    const result = await request.query(`
      SELECT name as database_name
      FROM sys.databases
      WHERE state = 0  -- Only online databases
      ORDER BY name
    `);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            server: config.server,
            databases: result.recordset,
          }, null, 2),
        },
      ],
    };
  }

  private async handleListTables(args: any) {
    const config = ConnectionSchema.parse(args);
    const pool = await this.getConnection(config);
    
    const request = pool.request();
    const result = await request.query(`
      USE [${config.database}];
      SELECT 
        TABLE_SCHEMA as schema_name,
        TABLE_NAME as table_name,
        TABLE_TYPE as table_type
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            server: config.server,
            database: config.database,
            tables: result.recordset,
          }, null, 2),
        },
      ],
    };
  }

  private async handleDescribeTable(args: any) {
    const config = ConnectionSchema.parse(args);
    const { table } = args;
    const pool = await this.getConnection(config);
    
    const request = pool.request();
    const result = await request.query(`
      USE [${config.database}];
      SELECT 
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        c.IS_NULLABLE as is_nullable,
        c.COLUMN_DEFAULT as default_value,
        c.CHARACTER_MAXIMUM_LENGTH as max_length,
        c.NUMERIC_PRECISION as precision,
        c.NUMERIC_SCALE as scale,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END as is_primary_key
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_CATALOG, ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS ku
          ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
      ) pk ON c.TABLE_CATALOG = pk.TABLE_CATALOG
        AND c.TABLE_SCHEMA = pk.TABLE_SCHEMA
        AND c.TABLE_NAME = pk.TABLE_NAME
        AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_NAME = '${table}'
      ORDER BY c.ORDINAL_POSITION
    `);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            server: config.server,
            database: config.database,
            table: table,
            columns: result.recordset,
          }, null, 2),
        },
      ],
    };
  }

  private async handleQuery(args: any) {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      const config = ConnectionSchema.parse(args);
      const { query, limit = 1000 } = args;
      
      // Enhanced security validation
      const validation = this.securityValidator.validateQuery(query);
      if (!validation.isValid) {
        throw new MCPError(
          `Query validation failed: ${validation.errors.join(', ')}`,
          'QUERY_VALIDATION_ERROR',
          { errors: validation.errors }
        );
      }

      const sanitizedQuery = this.securityValidator.sanitizeQuery(query);

      const pool = await this.getConnection(config);
      const request = pool.request();
      
      // Add TOP clause if not already present and limit is specified
      let finalQuery = sanitizedQuery;
      const trimmedQuery = sanitizedQuery.trim().toLowerCase();
      
      if (limit && !trimmedQuery.includes(' top ') && trimmedQuery.startsWith('select')) {
        finalQuery = sanitizedQuery.replace(/^select\s+/i, `SELECT TOP ${Math.min(limit, this.config.security.maxRowsPerQuery)} `);
      }

      const result = await request.query(`USE [${config.database}]; ${finalQuery}`);

      // Update metrics
      this.metrics.avgExecutionTime = (this.metrics.avgExecutionTime + (Date.now() - startTime)) / this.metrics.totalQueries;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              server: config.server,
              database: config.database,
              query: finalQuery,
              rowCount: result.recordset.length,
              executionTime: Date.now() - startTime,
              data: result.recordset,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      this.metrics.failedQueries++;
      throw error;
    }
  }

  private async handleSampleData(args: any) {
    const config = ConnectionSchema.parse(args);
    const { table, limit = 10 } = args;
    const pool = await this.getConnection(config);
    
    const request = pool.request();
    const result = await request.query(`
      USE [${config.database}];
      SELECT TOP ${limit} * FROM [${table}]
    `);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            server: config.server,
            database: config.database,
            table: table,
            sampleSize: result.recordset.length,
            data: result.recordset,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetRelationships(args: any) {
    const config = ConnectionSchema.parse(args);
    const { table } = args;
    const pool = await this.getConnection(config);
    
    const request = pool.request();
    let whereClause = '';
    if (table) {
      whereClause = `AND fk.TABLE_NAME = '${table}'`;
    }

    const result = await request.query(`
      USE [${config.database}];
      SELECT 
        fk.TABLE_NAME as table_name,
        fk.COLUMN_NAME as column_name,
        pk.TABLE_NAME as referenced_table,
        pk.COLUMN_NAME as referenced_column,
        fk.CONSTRAINT_NAME as constraint_name
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk
        ON rc.CONSTRAINT_NAME = fk.CONSTRAINT_NAME
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk
        ON rc.UNIQUE_CONSTRAINT_NAME = pk.CONSTRAINT_NAME
      WHERE 1=1 ${whereClause}
      ORDER BY fk.TABLE_NAME, fk.COLUMN_NAME
    `);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            server: config.server,
            database: config.database,
            table: table || 'all',
            relationships: result.recordset,
          }, null, 2),
        },
      ],
    };
  }

  private async handleHealthCheck(args: any) {
    const config = ConnectionSchema.parse(args);
    const { includeMetrics = true } = args;
    const startTime = Date.now();

    try {
      const pool = await this.getConnection(config);
      
      // Test basic connectivity
      const request = pool.request();
      const versionResult = await request.query('SELECT @@VERSION as version');
      const connectionTimeResult = await request.query('SELECT GETDATE() as server_time');
      
      // Get database status if database is specified
      let databaseInfo = null;
      if (config.database) {
        const dbRequest = pool.request();
        const dbResult = await dbRequest.query(`
          SELECT 
            DB_NAME() as database_name,
            DATABASEPROPERTYEX(DB_NAME(), 'Status') as status,
            DATABASEPROPERTYEX(DB_NAME(), 'Collation') as collation,
            DATABASEPROPERTYEX(DB_NAME(), 'Version') as version
        `);
        databaseInfo = dbResult.recordset[0];
      }

      const responseTime = Date.now() - startTime;

      const healthInfo: any = {
        status: 'healthy',
        server: config.server,
        database: config.database || 'master',
        serverVersion: versionResult.recordset[0]?.version,
        serverTime: connectionTimeResult.recordset[0]?.server_time,
        responseTime: responseTime,
        connectionPoolInfo: {
          connected: pool.connected,
          connecting: pool.connecting,
          healthy: pool.healthy
        }
      };

      if (databaseInfo) {
        healthInfo.databaseInfo = databaseInfo;
      }

      if (includeMetrics) {
        healthInfo.metrics = {
          ...this.metrics,
          activeConnections: this.connectionPools.size
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(healthInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'unhealthy',
              server: config.server,
              database: config.database || 'master',
              error: error instanceof Error ? error.message : String(error),
              responseTime: Date.now() - startTime
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleValidateQuery(args: any) {
    const { query, includeOptimizations = false } = args;

    try {
      const validation = this.securityValidator.validateQuery(query);
      const sanitizedQuery = this.securityValidator.sanitizeQuery(query);
      
      const result: any = {
        isValid: validation.isValid,
        originalQuery: query,
        sanitizedQuery: sanitizedQuery,
        errors: validation.errors,
        warnings: [],
        suggestions: []
      };

      // Basic query analysis
      const trimmedQuery = query.trim().toLowerCase();
      
      // Check for potential performance issues
      if (trimmedQuery.includes('select *')) {
        result.warnings.push('Using SELECT * may impact performance - consider specifying specific columns');
      }
      
      if (trimmedQuery.includes('like \'%') || trimmedQuery.includes('like "%')) {
        result.warnings.push('Leading wildcard in LIKE clause may cause full table scan');
      }

      if (!trimmedQuery.includes('where') && (trimmedQuery.includes('update') || trimmedQuery.includes('delete'))) {
        result.errors.push('UPDATE/DELETE statements without WHERE clause are dangerous');
        result.isValid = false;
      }

      if (includeOptimizations) {
        // Basic optimization suggestions
        if (trimmedQuery.includes('order by') && !trimmedQuery.includes('top')) {
          result.suggestions.push('Consider adding TOP clause when using ORDER BY for better performance');
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isValid: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private async handleBulkInsert(args: any) {
    const config = ConnectionSchema.parse(args);
    const { table, data } = args;

    if (!Array.isArray(data) || data.length === 0) {
      throw new MCPError('Data must be a non-empty array', 'INVALID_DATA');
    }

    try {
      const pool = await this.getConnection(config);
      
      // Get table structure to validate data
      const structureRequest = pool.request();
      const structureResult = await structureRequest.query(`
        USE [${config.database}];
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${table}'
        ORDER BY ORDINAL_POSITION
      `);

      if (structureResult.recordset.length === 0) {
        throw new MCPError(`Table '${table}' not found`, 'TABLE_NOT_FOUND');
      }

      const columns = structureResult.recordset;
      const columnNames = columns.map(col => col.COLUMN_NAME);

      // Validate data structure
      const firstRow = data[0];
      const dataColumns = Object.keys(firstRow);
      const invalidColumns = dataColumns.filter(col => !columnNames.includes(col));
      
      if (invalidColumns.length > 0) {
        throw new MCPError(
          `Invalid columns: ${invalidColumns.join(', ')}. Valid columns: ${columnNames.join(', ')}`,
          'INVALID_COLUMNS'
        );
      }

      // Build bulk insert query
      const insertColumns = dataColumns.join(', ');
      const valuesPlaceholder = `(${dataColumns.map(() => '?').join(', ')})`;
      const allValues = data.map(row => dataColumns.map(col => row[col])).flat();

      // For large datasets, use batching
      const batchSize = 100;
      let totalInserted = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchValues = batch.map(row => dataColumns.map(col => row[col])).flat();
        const batchPlaceholders = batch.map(() => valuesPlaceholder).join(', ');
        
        const insertQuery = `
          USE [${config.database}];
          INSERT INTO [${table}] (${insertColumns})
          VALUES ${batchPlaceholders}
        `;

        const request = pool.request();
        // Add parameters
        batchValues.forEach((value, index) => {
          request.input(`param${index}`, value);
        });

        const finalQuery = insertQuery.replace(/\?/g, (match, offset) => {
          const paramIndex = insertQuery.substring(0, offset).split('?').length - 1;
          return `@param${paramIndex}`;
        });

        const result = await request.query(finalQuery);
        totalInserted += result.rowsAffected[0] || 0;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              server: config.server,
              database: config.database,
              table: table,
              totalRowsProcessed: data.length,
              totalRowsInserted: totalInserted,
              status: 'success'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new MCPError(
        `Bulk insert failed: ${error instanceof Error ? error.message : String(error)}`,
        'BULK_INSERT_ERROR',
        { table, rowCount: data.length }
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MSSQL MCP Server running on stdio');
  }
}

// Start the server
const server = new MSSQLMCPServer();
server.run().catch(console.error);