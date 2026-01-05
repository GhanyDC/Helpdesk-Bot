/**
 * Configuration Test
 * 
 * Run this to verify your .env configuration is correct
 * Usage: node test/testConfig.js
 */

console.log('\n🔍 Testing Helpdesk Bot Configuration...\n');

// Test 1: Check if .env file exists
console.log('1️⃣ Checking .env file...');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('   ❌ .env file not found!');
  console.log('   ℹ️  Copy .env.example to .env and configure it');
  process.exit(1);
} else {
  console.log('   ✅ .env file exists\n');
}

// Test 2: Load configuration
console.log('2️⃣ Loading configuration...');
require('dotenv').config();

const config = require('../config');

// Test 3: Check Viber token
console.log('\n3️⃣ Checking Viber configuration...');
if (!config.viber.authToken || config.viber.authToken === 'your-viber-bot-auth-token-here') {
  console.log('   ❌ VIBER_AUTH_TOKEN not configured');
  console.log('   ℹ️  Get your token from https://partners.viber.com');
} else {
  console.log('   ✅ VIBER_AUTH_TOKEN is set');
}

console.log(`   Bot Name: ${config.viber.botName}`);

// Test 4: Check webhook URL
console.log('\n4️⃣ Checking webhook configuration...');
if (!config.server.webhookUrl || config.server.webhookUrl.includes('your-ngrok-url')) {
  console.log('   ❌ WEBHOOK_URL not configured');
  console.log('   ℹ️  Start ngrok and set WEBHOOK_URL in .env');
} else {
  console.log(`   ✅ Webhook URL: ${config.server.webhookUrl}`);
}

console.log(`   Server Port: ${config.server.port}`);

// Test 5: Check support group
console.log('\n5️⃣ Checking support group configuration...');
if (!config.support.groupId || config.support.groupId.includes('your-central-viber-group-id')) {
  console.log('   ⚠️  SUPPORT_GROUP_ID not configured');
  console.log('   ℹ️  This is optional for testing, but required for production');
} else {
  console.log('   ✅ Support Group ID is set');
}

// Test 6: Check permissions
console.log('\n6️⃣ Checking permissions configuration...');
if (config.auth.supportStaffIds.length === 0) {
  console.log('   ⚠️  No support staff configured');
  console.log('   ℹ️  Add SUPPORT_STAFF_IDS in .env to enable status updates');
} else {
  console.log(`   ✅ ${config.auth.supportStaffIds.length} support staff member(s) configured`);
}

if (config.auth.employeeIds.length === 0) {
  console.log('   ℹ️  Employee whitelist empty - all users can create issues');
} else {
  console.log(`   ℹ️  ${config.auth.employeeIds.length} employee(s) in whitelist`);
}

// Test 7: Check database path
console.log('\n7️⃣ Checking database configuration...');
console.log(`   Database Path: ${config.database.path}`);

const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  console.log('   ℹ️  Database directory will be created on first run');
} else {
  console.log('   ✅ Database directory exists');
}

// Test 8: Test database initialization
console.log('\n8️⃣ Testing database initialization...');
try {
  const issueManager = require('../issueManager');
  console.log('   ✅ Database initialized successfully');
  
  // Check tables
  const tables = issueManager.db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table'
  `).all();
  
  console.log(`   ℹ️  Tables found: ${tables.map(t => t.name).join(', ')}`);
  
  issueManager.close();
} catch (error) {
  console.log('   ❌ Database initialization failed:', error.message);
}

// Summary
console.log('\n═══════════════════════════════════════════════════════════');
console.log('SUMMARY');
console.log('═══════════════════════════════════════════════════════════');

const criticalIssues = [];
const warnings = [];

if (!config.viber.authToken || config.viber.authToken === 'your-viber-bot-auth-token-here') {
  criticalIssues.push('Viber Auth Token not set');
}

if (!config.server.webhookUrl || config.server.webhookUrl.includes('your-ngrok-url')) {
  criticalIssues.push('Webhook URL not set');
}

if (!config.support.groupId || config.support.groupId.includes('your-central-viber-group-id')) {
  warnings.push('Support Group ID not set (optional for testing)');
}

if (config.auth.supportStaffIds.length === 0) {
  warnings.push('No support staff configured (status updates disabled)');
}

if (criticalIssues.length > 0) {
  console.log('\n❌ CRITICAL ISSUES:');
  criticalIssues.forEach(issue => console.log(`   - ${issue}`));
  console.log('\n⚠️  Bot will NOT work until these are fixed!');
} else {
  console.log('\n✅ All critical configuration is set!');
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:');
  warnings.forEach(warning => console.log(`   - ${warning}`));
}

if (criticalIssues.length === 0 && warnings.length === 0) {
  console.log('\n🎉 Configuration is perfect! You\'re ready to start the bot!');
  console.log('\nRun: npm start');
}

console.log('\n═══════════════════════════════════════════════════════════\n');

process.exit(criticalIssues.length > 0 ? 1 : 0);
