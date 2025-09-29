// Simple test to validate Apps Script configuration and SQL structure
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing EROS Dashboard Setup...\n');

// Test 1: Check Apps Script files exist
const appsScriptPath = path.join(__dirname, 'app');
const requiredFiles = ['Code.gs', 'AskSidebar.html', 'appsscript.json', '.clasp.json'];

console.log('✅ Apps Script Files:');
requiredFiles.forEach(file => {
  const filePath = path.join(appsScriptPath, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Test 2: Check BigQuery view files exist
const viewFiles = [
  'definitions/messaging/mart/daily_recommendations.sqlx',
  'definitions/core/vw_week_slots_7d_rbac.sqlx',
  'definitions/messaging/mart/caption_rank_next24_v3_tbl.sqlx',
  'definitions/ops/send_log.sqlx'
];

console.log('\n✅ BigQuery Views:');
viewFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file.split('/').pop()}`);
});

// Test 3: Check Apps Script configuration
try {
  const claspConfig = JSON.parse(fs.readFileSync(path.join(appsScriptPath, '.clasp.json'), 'utf8'));
  console.log('\n✅ Apps Script Configuration:');
  console.log(`  Script ID: ${claspConfig.scriptId}`);
  console.log(`  Parent ID: ${claspConfig.parentId}`);
} catch (e) {
  console.log('\n❌ Apps Script Configuration: Invalid .clasp.json');
}

// Test 4: Validate Apps Script menu structure
try {
  const codeGs = fs.readFileSync(path.join(appsScriptPath, 'Code.gs'), 'utf8');
  const menuItems = [
    'Load My Week',
    'Load Day Board',
    'Pick Caption (Top-N)',
    'Submit Ready/Sent',
    'Ask EROS (sidebar)'
  ];

  console.log('\n✅ Menu Functions:');
  menuItems.forEach(item => {
    const found = codeGs.includes(item);
    console.log(`  ${found ? '✅' : '❌'} ${item}`);
  });
} catch (e) {
  console.log('\n❌ Menu Functions: Could not read Code.gs');
}

// Test 5: BigQuery view references
const requiredViews = [
  'daily_recommendations',
  'vw_week_slots_7d_rbac',
  'caption_rank_next24_v3_tbl',
  'scheduler_assignments_final'
];

console.log('\n✅ BigQuery View References in Apps Script:');
try {
  const codeGs = fs.readFileSync(path.join(appsScriptPath, 'Code.gs'), 'utf8');
  requiredViews.forEach(view => {
    const found = codeGs.includes(view);
    console.log(`  ${found ? '✅' : '❌'} ${view}`);
  });
} catch (e) {
  console.log('  ❌ Could not validate view references');
}

console.log('\n🎉 Dashboard Setup Test Complete!');
console.log('\n📋 Next Steps:');
console.log('  1. Run: npx @dataform/cli run');
console.log('  2. Deploy Apps Script: clasp push');
console.log('  3. Create Google Sheet and attach script');
console.log('  4. Configure scheduler assignments');
console.log('  5. Train team on workflows');

console.log('\n📖 Full deployment guide: DASHBOARD_DEPLOYMENT_GUIDE.md');