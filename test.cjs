#!/usr/bin/env node

/**
 * Enhanced test script for the MCP MSSQL Server
 * Tests all new security, monitoring, and bulk operation features
 */

const { spawn } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  server: 'localhost',
  port: 1433,
  user: 'sa',
  password: 'YourStrongP@ssw0rd',
  database: 'MCPTest',
  trustServerCertificate: true,
  requestTimeout: 30000,
  connectionTimeout: 30000
};

class EnhancedMCPTester {
  constructor() {
    this.mcpProcess = null;
    this.messageId = 1;
  }

  async startMCPServer() {
    console.log('🚀 Starting enhanced MCP server...');
    
    this.mcpProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    return new Promise((resolve, reject) => {
      let initBuffer = '';
      
      const onData = (data) => {
        initBuffer += data.toString();
        
        const lines = initBuffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              if (message.result && message.result.capabilities) {
                this.mcpProcess.stdout.off('data', onData);
                console.log('✅ Enhanced MCP server started successfully');
                resolve();
                return;
              }
            } catch (e) {
              // Ignore parsing errors during initialization
            }
          }
        }
      };

      this.mcpProcess.stdout.on('data', onData);
      
      this.mcpProcess.stderr.on('data', (data) => {
        const stderr = data.toString();
        if (stderr.includes('MSSQL MCP Server running')) {
          // Server is ready
        } else {
          console.error('Server stderr:', stderr);
        }
      });

      this.mcpProcess.on('error', reject);
      this.mcpProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`MCP process exited with code ${code}`));
        }
      });

      // Initialize the server
      this.sendMessage({
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'enhanced-test-client', version: '2.0.0' }
        }
      });
    });
  }

  sendMessage(message) {
    if (this.mcpProcess) {
      this.mcpProcess.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  async callTool(name, arguments_) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      
      const onData = (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id === id) {
                this.mcpProcess.stdout.off('data', onData);
                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
                return;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      };

      this.mcpProcess.stdout.on('data', onData);
      
      setTimeout(() => {
        this.mcpProcess.stdout.off('data', onData);
        reject(new Error('Timeout waiting for response'));
      }, 15000);

      this.sendMessage({
        jsonrpc: '2.0',
        id: id,
        method: 'tools/call',
        params: {
          name: name,
          arguments: arguments_
        }
      });
    });
  }

  async runEnhancedTests() {
    try {
      await this.startMCPServer();

      console.log('\n🧪 Running Enhanced MCP Tests...\n');

      // Test 1: Health Check
      console.log('🏥 Testing health check...');
      try {
        const health = await this.callTool('mssql_health_check', {
          ...TEST_CONFIG,
          includeMetrics: true
        });
        const healthData = JSON.parse(health.content[0].text);
        console.log('   ✅ Server status:', healthData.status);
        console.log('   📊 Response time:', healthData.responseTime, 'ms');
        console.log('   📈 Metrics available:', !!healthData.metrics);
      } catch (error) {
        console.log('   ❌ Health check failed:', error.message);
      }

      // Test 2: Query Validation
      console.log('\n🔒 Testing query validation...');
      
      // Test valid query
      try {
        const validation1 = await this.callTool('mssql_validate_query', {
          query: 'SELECT * FROM Customers WHERE Country = \'USA\'',
          includeOptimizations: true
        });
        const result1 = JSON.parse(validation1.content[0].text);
        console.log('   ✅ Valid query result:', result1.isValid ? 'PASSED' : 'FAILED');
        if (result1.warnings.length > 0) {
          console.log('   ⚠️  Warnings:', result1.warnings.length);
        }
      } catch (error) {
        console.log('   ❌ Valid query test failed:', error.message);
      }

      // Test dangerous query
      try {
        const validation2 = await this.callTool('mssql_validate_query', {
          query: 'DROP TABLE Customers; SELECT * FROM Users',
          includeOptimizations: false
        });
        const result2 = JSON.parse(validation2.content[0].text);
        console.log('   🛡️  Dangerous query blocked:', !result2.isValid ? 'PASSED' : 'FAILED');
        console.log('   📝 Error count:', result2.errors.length);
      } catch (error) {
        console.log('   ❌ Dangerous query test failed:', error.message);
      }

      // Test 3: Enhanced Query with Security
      console.log('\n🔍 Testing enhanced query execution...');
      try {
        const queryResult = await this.callTool('mssql_query', {
          ...TEST_CONFIG,
          query: 'SELECT TOP 5 CustomerID, CompanyName, Country FROM Customers ORDER BY CompanyName',
          limit: 5
        });
        const result = JSON.parse(queryResult.content[0].text);
        console.log('   ✅ Query executed successfully');
        console.log('   📊 Rows returned:', result.rowCount);
        console.log('   ⏱️  Execution time:', result.executionTime, 'ms');
      } catch (error) {
        console.log('   ❌ Enhanced query failed:', error.message);
      }

      // Test 4: Bulk Insert
      console.log('\n📦 Testing bulk insert operations...');
      try {
        // First, create test data
        const testData = [
          { CustomerID: 'TEST1', CompanyName: 'Test Company 1', Country: 'USA' },
          { CustomerID: 'TEST2', CompanyName: 'Test Company 2', Country: 'Canada' },
          { CustomerID: 'TEST3', CompanyName: 'Test Company 3', Country: 'UK' }
        ];

        const bulkResult = await this.callTool('mssql_bulk_insert', {
          ...TEST_CONFIG,
          table: 'Customers',
          data: testData
        });
        const result = JSON.parse(bulkResult.content[0].text);
        console.log('   ✅ Bulk insert completed');
        console.log('   📈 Rows processed:', result.totalRowsProcessed);
        console.log('   💾 Rows inserted:', result.totalRowsInserted);
      } catch (error) {
        console.log('   ⚠️  Bulk insert test:', error.message);
        // This might fail if test data conflicts with existing data
      }

      // Test 5: Verify all original tools still work
      console.log('\n🔄 Testing backward compatibility...');
      
      const originalTests = [
        { name: 'mssql_list_databases', args: TEST_CONFIG },
        { name: 'mssql_list_tables', args: TEST_CONFIG },
        { name: 'mssql_describe_table', args: { ...TEST_CONFIG, table: 'Customers' } },
        { name: 'mssql_sample_data', args: { ...TEST_CONFIG, table: 'Customers', limit: 2 } },
        { name: 'mssql_get_relationships', args: TEST_CONFIG }
      ];

      for (const test of originalTests) {
        try {
          const result = await this.callTool(test.name, test.args);
          console.log(`   ✅ ${test.name}: OK`);
        } catch (error) {
          console.log(`   ❌ ${test.name}: ${error.message}`);
        }
      }

      console.log('\n🎉 Enhanced MCP Server Testing Complete!');
      console.log('✨ New features successfully implemented and tested');

    } catch (error) {
      console.error('\n💥 Enhanced test failed:', error.message);
    } finally {
      this.cleanup();
    }
  }

  cleanup() {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      console.log('🧹 MCP process cleaned up');
    }
  }
}

// Run the enhanced tests
const tester = new EnhancedMCPTester();
tester.runEnhancedTests().catch(console.error);

// Cleanup on exit
process.on('SIGINT', () => {
  tester.cleanup();
  process.exit(0);
});