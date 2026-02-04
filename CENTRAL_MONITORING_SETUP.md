# Central Monitoring Group Setup Guide

## Purpose
The Central Monitoring Group provides **read-only visibility** for management/executives to track helpdesk operations across all branches without interfering with support staff workflows.

---

## ✅ Features

### What Central Monitoring Receives:

1. **New Issue Notifications** (from all branches)
   - Issue summary with branch and department context
   - Today's branch statistics included

2. **Status Update Notifications**
   - pending, in-progress status changes (simple notification)
   - **resolved/closed** status (detailed metrics report):
     ```
     📊 JHQ BRANCH METRICS TODAY:
     ├─ Total Issues: 23 (↑ from yesterday: 18)
     ├─ Open Issues: 8
     ├─ Resolved Today: 15
     └─ Avg Response Time: 12 mins
     ```

3. **Daily Summary Reports** (automatic at 18:00)
   - Overall performance across all branches
   - Branch breakdown
   - Critical alerts

### What Central Monitoring CANNOT Do:
- ❌ Update issue status (/status commands won't work)
- ❌ Send messages (if configured as read-only in Telegram)
- ❌ Interfere with support staff workflows

---

## 🔧 Setup Instructions

### Step 1: Create Telegram Group

1. Create a new Telegram group called **"Helpdesk Central Monitoring"**
2. Add your bot (`@Initial_HelpdeskBot`) to the group
3. Add management/executive members who need visibility

### Step 2: Make Group Read-Only

**Option A: Using Telegram Desktop/Mobile**
1. Open the group
2. Click group name → **Edit**
3. Go to **Permissions**
4. Under **"What can members do?"**:
   - ❌ Disable **"Send Messages"**
   - ❌ Disable **"Send Media"**
   - ❌ Disable **"Add Users"**
   - ✅ Keep **"Read Messages"** enabled
5. Under **Administrators**:
   - Make the bot an **admin** (so it can post)
   - Give it **"Post Messages"** permission only
6. Save changes

**Option B: Using Bot Commands (Advanced)**
```bash
# Make the bot an admin first manually, then restrict permissions:
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setChatPermissions" \
  -d "chat_id=<MONITORING_GROUP_ID>" \
  -d "permissions={\"can_send_messages\":false,\"can_send_media_messages\":false}"
```

### Step 3: Get Group ID

1. Send a test message to the group
2. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
3. Find the group chat (look for `"type":"supergroup"`)
4. Copy the `chat_id` (negative number like `-1001234567890`)

### Step 4: Configure Environment

Edit [.env](.env):

```env
# Central Monitoring Group
CENTRAL_MONITORING_GROUP=-1001234567890  # Replace with your group ID
ENABLE_CENTRAL_MONITORING=true
```

### Step 5: Restart Server

```bash
node server.js
```

---

## 🧪 Testing

### Test 1: New Issue Routing
1. Create a test issue from JHQ branch
2. Verify message appears in:
   - ✅ JHQ Support Group (with action buttons)
   - ✅ Central Monitoring Group (read-only notification)

### Test 2: Status Update
1. Support staff marks issue as in-progress in JHQ Support Group
2. Verify update appears in Central Monitoring Group

### Test 3: Resolution Metrics
1. Support staff marks issue as resolved
2. Verify Central Monitoring Group receives detailed report:
   ```
   ✅ ISSUE RESOLVED
   📊 JHQ BRANCH METRICS TODAY:
   ├─ Total Issues: X
   ├─ Open Issues: Y
   ├─ Resolved Today: Z
   └─ Avg Response Time: XX mins
   ```

### Test 4: Read-Only Enforcement
1. Try sending a message as a regular member
2. Should be blocked by Telegram (if permissions configured correctly)
3. Only bot and admins can post

---

## 📊 What Management Sees

### Daily Activity Stream:
```
[09:15] 🆕 NEW ISSUE - JHQ Branch
        Issue #42, IT Department, High urgency

[09:23] 📊 STATUS UPDATE
        Issue #42: pending → in-progress
        Branch: JHQ | Updated by: John Doe

[09:45] ✅ ISSUE RESOLVED
        Issue #42
        📊 JHQ BRANCH METRICS TODAY:
        ├─ Total Issues: 5
        ├─ Resolved Today: 3
        └─ Avg Response Time: 18 mins

[18:00] 📊 DAILY HELPDESK REPORT
        (Full summary of all branches)
```

---

## ⚠️ Important Notes

1. **Bot Must Be Admin**: The bot needs admin privileges to post in a restricted group
2. **Members Are Read-Only**: Regular members can read but not post (configured via group permissions)
3. **No Status Updates**: Central monitoring group CANNOT update issue status - only branch support groups can
4. **Privacy**: All issue details are visible to management - ensure this aligns with company policy
5. **Performance**: Minimal impact - only sends messages on status changes and daily summary

---

## 🔍 Troubleshooting

**Bot not posting to central monitoring?**
- Verify `ENABLE_CENTRAL_MONITORING=true`
- Check `CENTRAL_MONITORING_GROUP` ID is correct
- Ensure bot is admin in the group
- Check server logs for errors

**Members can still send messages?**
- Go to group Permissions and disable "Send Messages"
- Verify permissions are applied to all members (not just new ones)

**Too many notifications?**
- This is working as designed - every issue and resolution sends a notification
- Consider disabling for pending/in-progress updates if too noisy
- Keep resolved/closed notifications for metrics visibility

---

## ✅ You're Set!

Central monitoring is now configured to provide executive visibility across all branches without interfering with support operations.
