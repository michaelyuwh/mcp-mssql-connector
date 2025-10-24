#!/usr/bin/env node

/**
 * CI-friendly test script for the MCP MSSQL Server
 * Tests compilation, imports, and basic functionality without database connection
 */

const fs = require('fs');
const path = require('path');

class CITester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    }[type] || '📋';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      this.log(`PASS: ${message}`, 'success');
    } else {
      this.failed++;
      this.log(`FAIL: ${message}`, 'error');
    }
  }

  async testFileStructure() {
    this.log('Testing project file structure...', 'info');

    // Check essential files exist
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'dist/index.js',
      'dist/index.d.ts',
      'README.md',
      'LICENSE'
    ];

    for (const file of essentialFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file));
      this.assert(exists, `Essential file exists: ${file}`);
    }
  }

  async testPackageJson() {
    this.log('Testing package.json configuration...', 'info');

    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      this.assert(packageContent.name === 'mcp-mssql-server', 'Package name is correct');
      this.assert(packageContent.type === 'module', 'Package type is ES module');
      this.assert(packageContent.main === 'dist/index.js', 'Main entry point is correct');
      
      // Check dependencies
      const deps = packageContent.dependencies || {};
      this.assert('@modelcontextprotocol/sdk' in deps, 'MCP SDK dependency exists');
      this.assert('mssql' in deps, 'MSSQL dependency exists');
      this.assert('zod' in deps, 'Zod dependency exists');

      // Check scripts
      const scripts = packageContent.scripts || {};
      this.assert('build' in scripts, 'Build script exists');
      this.assert('test' in scripts, 'Test script exists');
      this.assert('start' in scripts, 'Start script exists');

    } catch (error) {
      this.assert(false, `Package.json parsing: ${error.message}`);
    }
  }

  async testTypeScriptCompilation() {
    this.log('Testing TypeScript compilation...', 'info');

    try {
      // Check if dist files were created
      const distExists = fs.existsSync(path.join(process.cwd(), 'dist'));
      this.assert(distExists, 'Dist directory exists');

      const indexJsExists = fs.existsSync(path.join(process.cwd(), 'dist/index.js'));
      this.assert(indexJsExists, 'Compiled JavaScript exists');

      const indexDtsExists = fs.existsSync(path.join(process.cwd(), 'dist/index.d.ts'));
      this.assert(indexDtsExists, 'TypeScript declarations exist');

      // Check if compiled JS is valid
      if (indexJsExists) {
        const compiledContent = fs.readFileSync(path.join(process.cwd(), 'dist/index.js'), 'utf8');
        this.assert(compiledContent.includes('import') || compiledContent.includes('export'), 'Compiled code uses ES modules');
        this.assert(compiledContent.length > 1000, 'Compiled code has substantial content');
      }

    } catch (error) {
      this.assert(false, `TypeScript compilation check: ${error.message}`);
    }
  }

  async testImports() {
    this.log('Testing module imports...', 'info');

    try {
      // Check if package.json dependencies are installed
      const nodeModulesExists = fs.existsSync(path.join(process.cwd(), 'node_modules'));
      this.assert(nodeModulesExists, 'node_modules directory exists');

      if (nodeModulesExists) {
        const mcpSdkExists = fs.existsSync(path.join(process.cwd(), 'node_modules/@modelcontextprotocol'));
        this.assert(mcpSdkExists, 'MCP SDK package is installed');

        const mssqlExists = fs.existsSync(path.join(process.cwd(), 'node_modules/mssql'));
        this.assert(mssqlExists, 'MSSQL package is installed');

        const zodExists = fs.existsSync(path.join(process.cwd(), 'node_modules/zod'));
        this.assert(zodExists, 'Zod package is installed');
      }

      // Check if the compiled code imports these modules
      const distPath = path.join(process.cwd(), 'dist/index.js');
      if (fs.existsSync(distPath)) {
        const distContent = fs.readFileSync(distPath, 'utf8');
        this.assert(distContent.includes('@modelcontextprotocol/sdk'), 'Compiled code imports MCP SDK');
        this.assert(distContent.includes('mssql'), 'Compiled code imports MSSQL');
        this.assert(distContent.includes('zod'), 'Compiled code imports Zod');
      }

    } catch (error) {
      this.assert(false, `Import test: ${error.message}`);
    }
  }

  async testConfigFiles() {
    this.log('Testing configuration files...', 'info');

    // Test .env.example
    const envExampleExists = fs.existsSync(path.join(process.cwd(), '.env.example'));
    this.assert(envExampleExists, '.env.example file exists');

    if (envExampleExists) {
      const envContent = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');
      this.assert(envContent.includes('MSSQL_SERVER'), '.env.example contains MSSQL_SERVER');
      this.assert(envContent.includes('MSSQL_DATABASE'), '.env.example contains MSSQL_DATABASE');
    }

    // Test tsconfig.json
    try {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfigContent = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      this.assert(tsconfigContent.compilerOptions, 'tsconfig.json has compilerOptions');
      this.assert(tsconfigContent.compilerOptions.target, 'tsconfig.json specifies target');
      this.assert(tsconfigContent.compilerOptions.outDir === './dist', 'tsconfig.json outDir is dist');

    } catch (error) {
      this.assert(false, `tsconfig.json parsing: ${error.message}`);
    }
  }

  async testDocumentation() {
    this.log('Testing documentation...', 'info');

    const docFiles = [
      'README.md',
      'CONTRIBUTING.md',
      'ENHANCEMENTS.md'
    ];

    for (const docFile of docFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), docFile));
      this.assert(exists, `Documentation file exists: ${docFile}`);

      if (exists) {
        const content = fs.readFileSync(path.join(process.cwd(), docFile), 'utf8');
        this.assert(content.length > 100, `${docFile} has substantial content`);
      }
    }
  }

  async testGitHubWorkflows() {
    this.log('Testing GitHub workflows...', 'info');

    const workflowDir = path.join(process.cwd(), '.github/workflows');
    const workflowExists = fs.existsSync(workflowDir);
    this.assert(workflowExists, '.github/workflows directory exists');

    if (workflowExists) {
      const workflows = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));
      this.assert(workflows.length > 0, 'At least one workflow file exists');

      for (const workflow of workflows) {
        const workflowPath = path.join(workflowDir, workflow);
        const content = fs.readFileSync(workflowPath, 'utf8');
        this.assert(content.includes('name:'), `${workflow} has proper YAML structure`);
        this.assert(content.includes('on:'), `${workflow} has trigger configuration`);
        this.assert(content.includes('jobs:'), `${workflow} defines jobs`);
      }
    }
  }

  async runAllTests() {
    this.log('🧪 Starting CI-friendly MCP MSSQL Server tests...', 'info');
    
    try {
      await this.testFileStructure();
      await this.testPackageJson();
      await this.testTypeScriptCompilation();
      await this.testImports();
      await this.testConfigFiles();
      await this.testDocumentation();
      await this.testGitHubWorkflows();

      this.log('📊 Test Results Summary:', 'info');
      this.log(`✅ Passed: ${this.passed}`, 'success');
      this.log(`❌ Failed: ${this.failed}`, this.failed > 0 ? 'error' : 'info');

      const success = this.failed === 0;
      this.log(`🎯 Overall Result: ${success ? 'SUCCESS' : 'FAILURE'}`, success ? 'success' : 'error');

      process.exit(this.failed === 0 ? 0 : 1);

    } catch (error) {
      this.log(`💥 Fatal error during testing: ${error.message}`, 'error');
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new CITester();
  tester.runAllTests().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { CITester };