#!/usr/bin/env node
// EROS Pipeline Validation Script
// Run from anywhere; the script normalizes to the dataform project directory

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname);

console.log('🚀 EROS Dataform Pipeline Validation\n');

if (!fs.existsSync(path.join(projectDir, 'dataform.json'))) {
  console.error('❌ dataform.json not found inside the dataform project directory.');
  process.exit(1);
}

if (process.cwd() !== projectDir) {
  console.log(`ℹ️  Switching working directory to ${projectDir}`);
  process.chdir(projectDir);
}

const run = (command, options = {}) => {
  const execOptions = {
    cwd: projectDir,
    stdio: 'inherit',
    ...options
  };
  return execSync(command, execOptions);
};

try {
  // Test 1: Compile the project to ensure SQL is valid
  console.log('📋 Test 1: Compiling project...');
  run('npx @dataform/cli compile');
  console.log('✅ Compilation successful!\n');

  // Test 2: Re-run compilation in JSON mode for deeper inspection
  console.log('📋 Test 2: Checking for compilation errors...');
  const compileOutput = execSync('npx @dataform/cli compile --json', {
    cwd: projectDir,
    stdio: 'pipe',
    encoding: 'utf-8'
  });
  const result = JSON.parse(compileOutput);

  if (result.graphErrors?.compilationErrors?.length) {
    console.error('❌ Compilation errors found:');
    for (const error of result.graphErrors.compilationErrors) {
      console.error(`  - ${error.fileName}: ${error.message}`);
    }
    process.exit(1);
  }

  console.log('✅ No compilation errors found!\n');

  // Test 3: Summarize compiled actions
  console.log('📋 Test 3: Listing compiled actions...');
  const tables = result.tables ?? [];
  const assertions = result.assertions ?? [];
  const operations = result.operations ?? [];

  console.log(`\n📊 Tables (${tables.length}):`);
  tables.forEach(table => {
    console.log(`  - ${table.target.schema}.${table.target.name} [${table.type}]`);
  });

  console.log(`\n🔍 Assertions (${assertions.length}):`);
  assertions.forEach(assertion => {
    console.log(`  - ${assertion.target.name}`);
  });

  console.log(`\n⚙️  Operations (${operations.length}):`);
  operations.forEach(op => {
    console.log(`  - ${op.target.name}`);
  });

  // Test 4: Validate dependencies resolve to compiled actions
  console.log('\n📋 Test 4: Validating dependencies...');
  const allTargets = new Set([
    ...tables.map(table => `${table.target.schema}.${table.target.name}`),
    ...assertions.map(assertion => `${assertion.target.schema}.${assertion.target.name}`)
  ]);

  let hasDependencyIssues = false;
  for (const table of tables) {
    for (const dep of table.dependencyTargets || []) {
      const depKey = `${dep.schema}.${dep.name}`;
      const depIsSource = dep.schema?.startsWith('source');
      if (!allTargets.has(depKey) && !depIsSource) {
        console.warn(`⚠️  Missing dependency: ${dep.schema}.${dep.name} referenced by ${table.target.name}`);
        hasDependencyIssues = true;
      }
    }
  }

  if (!hasDependencyIssues) {
    console.log('✅ All dependencies validated!\n');
  }

  // Summary
  console.log('\n📈 Validation Summary:');
  console.log('====================');
  console.log(`✅ Total Tables: ${tables.length}`);
  console.log(`✅ Total Assertions: ${assertions.length}`);
  console.log(`✅ Total Operations: ${operations.length}`);
  console.log(`✅ Pipeline Status: READY`);
  console.log('\n🎉 Your EROS Dataform pipeline is ready to run!');
  console.log('\nNext steps:');
  console.log('1. Run full pipeline: npx @dataform/cli run');
  console.log('2. Run specific tags: npx @dataform/cli run --tags messaging_mart');
  console.log('3. Deploy to Dataform web UI for scheduling');

} catch (error) {
  if (error.stdout) {
    console.error(error.stdout.toString());
  }
  if (error.stderr) {
    console.error(error.stderr.toString());
  }
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
