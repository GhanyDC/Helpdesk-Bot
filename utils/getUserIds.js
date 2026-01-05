/**
 * User ID Logger Utility
 * 
 * This utility helps you discover Viber user IDs for configuring
 * support staff and employee permissions.
 * 
 * Usage:
 * 1. Temporarily add this code to server.js
 * 2. Ask users to message the bot
 * 3. Copy their IDs from the console
 * 4. Add to .env configuration
 */

/**
 * Add this code to server.js after line 70 (inside MESSAGE_RECEIVED event):
 * 
 * ───────────────────────────────────────────────────────────────
 * // Log user information for configuration
 * console.log('┌─────────────────────────────────────────────┐');
 * console.log('│ USER INFORMATION                            │');
 * console.log('├─────────────────────────────────────────────┤');
 * console.log(`│ Name: ${response.userProfile.name.padEnd(38)}│`);
 * console.log(`│ ID: ${response.userProfile.id.padEnd(40)}│`);
 * if (response.chatId) {
 *   console.log(`│ Chat ID: ${response.chatId.padEnd(35)}│`);
 * }
 * console.log('└─────────────────────────────────────────────┘');
 * ───────────────────────────────────────────────────────────────
 * 
 * When users message the bot, you'll see output like:
 * 
 * ┌─────────────────────────────────────────────┐
 * │ USER INFORMATION                            │
 * ├─────────────────────────────────────────────┤
 * │ Name: John Doe                              │
 * │ ID: ABC123xyz456==                          │
 * └─────────────────────────────────────────────┘
 * 
 * Copy the ID and add to .env:
 * SUPPORT_STAFF_IDS=ABC123xyz456==,DEF789abc012==
 */

// This file is for documentation purposes only
module.exports = {};
