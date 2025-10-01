#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Read all TypeScript files
const sourceFiles = [
  'src/config.ts',
  'src/services/bigquery.ts',
  'src/services/dataService.ts',
  'src/services/loggingService.ts',
  'src/services/overrideService.ts',
  'src/services/preflightService.ts',
  'src/sheets/base.ts',
  'src/sheets/controlHub.ts',
  'src/sheets/todayPlanner.ts',
  'src/sheets/weekPlanner.ts',
  'src/sheets/riskConsole.ts',
  'src/sheets/captionStudio.ts',
  'src/sheets/performancePulse.ts',
  'src/sheets/actionLog.ts',
  'src/main.ts'
];

// Compile TypeScript to JavaScript
const compilerOptions = {
  target: ts.ScriptTarget.ES2019,
  module: ts.ModuleKind.None,
  removeComments: false,
  lib: ['ES2019']
};

let output = `// EROS Scheduler Hub v2 - Google Apps Script
// Generated: ${new Date().toISOString()}

`;

sourceFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping ${file} - not found`);
    return;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions });

  let js = result.outputText;

  // Remove imports/exports
  js = js.replace(/^import .*/gm, '');
  js = js.replace(/^export /gm, '');
  js = js.replace(/export \{[^}]*\};?/g, '');

  // Remove type imports
  js = js.replace(/^\/\/\/ <reference .*/gm, '');

  output += `// From ${file}\n`;
  output += js + '\n';
});

// Write output
fs.writeFileSync('dist/Code.js', output);
console.log('Generated dist/Code.js');