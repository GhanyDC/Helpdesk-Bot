# ChatGPT Prompt: User & Support Staff Documentation

You are a technical writer creating user-friendly documentation for a Telegram-based helpdesk system. Use the following project context to generate comprehensive guides:

## Project Overview
This is a **branch-based helpdesk ticketing system** deployed on Telegram that routes support requests to different company locations.

## Core Concept

### Branch-Based Routing (The Foundation)
- **BRANCH = Company Location** (JHQ, TRK, GS, IPIL)
- Each branch has ONE dedicated Telegram support group
- When employees create tickets, they select their BRANCH first
- The system automatically routes tickets to the correct branch support group
- **Department is for context only** (Accounting, Sales, HR, etc.) - NOT used for routing

### User Roles
1. **Employees** - Create and track support tickets via the Telegram bot
2. **Support Staff** - Respond to tickets and update statuses in their branch's support group
3. **Management** - Monitor all tickets across branches via Central Monitoring Group (read-only)

### Ticket Lifecycle
1. Employee starts conversation with bot (@Initial_HelpdeskBot)
2. Bot asks questions: Branch → Department → Issue Category → Urgency → Description → Contact
3. Bot creates ticket and sends it to the appropriate branch support group
4. Support staff view ticket in their group and can:
   - Update status (pending/in-progress/resolved/closed)
   - View statistics (/stats command)
   - Get branch-specific stats
5. Employees receive automatic notifications when ticket status changes
6. Daily summary reports sent automatically at 6 PM

### Available Branches
- **JHQ** - Main Head Office
- **TRK** - Regional Office (formerly CHQ)
- **GS** - Service Center
- **IPIL** - IPIL Office

### Issue Categories
- System Issue
- Network Problem
- Hardware Failure
- Software Bug
- Access Request
- Password Reset
- Other

### Urgency Levels
- Low - Can wait a few days
- Medium - Needed within 24 hours
- High - Urgent, needs immediate attention

### Support Commands (for support staff in groups)
- `/status <ticket_id> <new_status>` - Update ticket status
- `/stats` - View overall statistics
- `/stats <branch>` - View branch-specific statistics
- `/help` - Show available commands

## Your Task
Generate user documentation that:
1. Uses simple, non-technical language
2. Includes step-by-step instructions with screenshots descriptions
3. Covers common scenarios (creating tickets, checking status, etc.)
4. Provides troubleshooting for common issues
5. Explains what each option means and when to use it
6. Is organized by user role (Employee Guide, Support Staff Guide, Manager Guide)

Keep explanations clear and practical, focusing on "how to use" rather than "how it works internally."
