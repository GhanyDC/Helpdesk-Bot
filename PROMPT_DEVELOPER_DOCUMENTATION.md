# ChatGPT Prompt: Developer & Manager Technical Documentation

You are a senior technical architect creating comprehensive documentation for developers and managers who will maintain and extend this helpdesk system. Use the following technical context:

## System Architecture

### Technology Stack
- **Platform**: Node.js (Express.js web server)
- **Database**: SQLite3 (better-sqlite3 driver) 
- **Messaging**: Telegram Bot API (webhook-based)
- **Deployment**: Ngrok tunnel for webhook (development), production-ready for any HTTPS endpoint

### Core Design Principle: Branch-Based Routing

**CRITICAL UNDERSTANDING:**
- **BRANCH** (JHQ/TRK/GS/IPIL) = Physical company location → **ROUTING KEY**
- **DEPARTMENT** (Accounting/Sales/HR/etc.) = Functional division → **METADATA ONLY**

This is NOT department-based routing. This is location-based routing.

#### Why This Model?
Each branch (location) has its own:
- Support staff physically present
- IT infrastructure
- Department representatives
- Support Telegram group

When an issue is created:
1. System reads `issue.branch` (NOT `issue.department`)
2. Looks up branch in `config.branchGroups` 
3. Routes to corresponding Telegram group
4. Department stored as context for statistics/filtering

### Module Architecture

```
server.js                  # Express server, webhook endpoint, initialization
├── config.js              # Environment configuration (loads .env)
├── constants.js           # Enums: BRANCHES, DEPARTMENTS, CATEGORIES, etc.
├── telegramService.js     # Telegram Bot API wrapper (sendMessage, etc.)
├── messagingAdapter.js    # Platform abstraction layer (future: Viber, Slack)
├── conversationManager.js # Multi-step conversation state machine
├── issueManager.js        # Database operations (CRUD for tickets)
├── messageHandler.js      # Main business logic coordinator
├── routingService.js      # Branch-based routing logic
├── permissionsManager.js  # User authorization (support staff check)
├── statsService.js        # Statistics aggregation and reporting
└── schedulerService.js    # Cron jobs (daily reports at 6 PM)
```

### Database Schema

**issues table:**
```sql
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- telegram_user_id (TEXT) - Requester's Telegram user ID
- branch (TEXT) - JHQ/TRK/GS/IPIL → ROUTING KEY
- department (TEXT) - Accounting/Sales/etc. → Context only
- category (TEXT) - System Issue/Network/etc.
- urgency (TEXT) - Low/Medium/High
- description (TEXT) - Issue details
- contact_info (TEXT) - Employee contact (phone/email)
- status (TEXT) - open/pending/in-progress/resolved/closed
- created_at (TEXT) - ISO timestamp
- updated_at (TEXT) - ISO timestamp
- assigned_to (TEXT) - Support staff ID (future use)
```

**conversations table:**
```sql
- user_id (TEXT PRIMARY KEY)
- step (TEXT) - Current conversation step
- data (TEXT) - JSON blob of collected data
- updated_at (TEXT)
```

### Key Workflows

#### Ticket Creation Flow
1. User messages bot → `messageHandler.handleMessage()`
2. Check if support group message → delegate to `handleSupportGroupMessage()`
3. If private chat → `conversationManager.handleConversation()`
4. Conversation steps: START → BRANCH → DEPARTMENT → CATEGORY → URGENCY → DESCRIPTION → CONTACT → CONFIRMATION
5. On completion → `issueManager.createIssue()`
6. Route to branch group → `routingService.routeNewIssue()`
7. If central monitoring enabled → send copy to monitoring group

#### Status Update Flow
1. Support staff sends `/status <id> <status>` in group
2. `messageHandler.handleStatusUpdate()`
3. Verify sender is support staff → `permissionsManager.isSupportStaff()`
4. Update database → `issueManager.updateIssueStatus()`
5. Send confirmation to group
6. Notify requester in private chat → `messagingAdapter.sendMessage()`

### Configuration Management

**Environment Variables (.env):**
```
TELEGRAM_BOT_TOKEN          # Bot API token from @BotFather
WEBHOOK_URL                 # Public HTTPS URL for webhook
SUPPORT_GROUP_JHQ           # Telegram group ID (negative number)
SUPPORT_GROUP_TRK           # Telegram group ID
SUPPORT_GROUP_GS            # Telegram group ID
SUPPORT_GROUP_IPIL          # Telegram group ID
CENTRAL_MONITORING_GROUP    # Optional: Management oversight group
ENABLE_CENTRAL_MONITORING   # true/false
SUPPORT_STAFF_IDS           # Comma-separated Telegram user IDs
DAILY_REPORT_HOUR           # 0-23 (default: 18)
```

### Central Monitoring Feature
- **Purpose**: Executive/management visibility across ALL branches
- **Behavior**: Read-only copies of tickets sent to monitoring group
- **Restriction**: Cannot update status from monitoring group (enforced in code)
- **Use Cases**: Trend analysis, resource allocation, SLA monitoring

### Extension Points

#### Adding New Branches
1. Add to `constants.js` → `BRANCHES` object
2. Add to `config.js` → `branchGroups` mapping
3. Add environment variable `SUPPORT_GROUP_<BRANCH>=<group_id>`
4. Update all JSDoc comments mentioning branch lists

#### Adding New Messaging Platforms
1. Create new service (e.g., `slackService.js`) implementing same interface as `telegramService.js`
2. Update `messagingAdapter.js` to support new platform
3. Add platform detection logic in `server.js`

#### Adding New Ticket Fields
1. Update database schema in `issueManager.initDatabase()`
2. Add conversation step in `constants.js` → `CONVERSATION_STEPS`
3. Add prompt in `conversationManager.js` → `getStepMessage()`
4. Add input validation in `conversationManager.handleConversation()`
5. Update `issueManager.createIssue()` to save new field

### Critical Business Rules

1. **Routing is ALWAYS by branch, NEVER by department**
2. **Support group IDs are negative numbers** (Telegram convention)
3. **Status updates only allowed from support staff** (checked by user ID)
4. **Central monitoring is read-only** (cannot update status)
5. **Conversations are stateful** (stored in database between messages)

### Testing Considerations
- Test webhook setup with ngrok for local development
- Test each branch routes to correct group
- Test status update permissions (only support staff)
- Test conversation recovery after bot restart
- Test daily report scheduling

### Deployment Checklist
1. Set up production HTTPS webhook endpoint
2. Configure all branch group IDs in `.env`
3. Add all support staff Telegram user IDs
4. Run `npm install` and `npm rebuild better-sqlite3`
5. Set webhook: `curl https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEBHOOK_URL>`
6. Start server: `node server.js`
7. Test ticket creation from each branch
8. Verify daily reports are sent

### Known Limitations
- SQLite is single-file (not suitable for high-scale multi-instance deployments)
- No ticket assignment algorithm (manual only via `assigned_to` field)
- No SLA tracking/escalation automation
- No file attachment support
- No ticket merging/splitting

### Migration Notes (Historical)
- System was previously CHQ (changed to TRK on 2026-01-14)
- IPIL branch added 2026-01-14
- Originally designed with department-based routing (CORRECTED to branch-based)

## Your Task
Generate technical documentation that:
1. Explains architectural decisions and trade-offs
2. Provides code examples for common modifications
3. Documents API contracts between modules
4. Includes database migration procedures
5. Covers deployment and scaling considerations
6. Explains debugging and troubleshooting approaches
7. Provides security considerations (token management, authorization)

Focus on maintainability, extensibility, and operational excellence.
