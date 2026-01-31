# Project Plan: PRISM Bridge - Antigravity Remote Control

## Overview
Bridge system enabling Prism (remote agent on LAN) to send prompts to Antigravity and receive structured responses via WhatsApp integration.

---

## Functionality

**Remote Control:**
- Prism sends prompts to Antigravity via HTTP
- Antigravity auto-executes with full autonomy
- Returns bulletpoint summaries + questions

**Key Features:**
- Auto-trigger via AppleScript
- Low-latency results (<30ms)
- Webhook callbacks (no polling)
- Structured JSON responses
- WhatsApp-optimized format

---

## System Architecture

```
[Prism + Clawbot] (Remote Mac)
    ↓ HTTPS/LAN
[Bridge Server] (Local Mac :3010)
    ↓ File System + AppleScript
[Antigravity] (Local Mac)
    ↓ Workflow Execution
[Results] → Bridge → Prism → WhatsApp
```

**Components:**
1. **Bridge Server** - Express.js on port 3010, prompt queue, result storage
2. **Antigravity Workflow** - `/prism-agent` with turbo-all flag
3. **File System** - `~/.antigravity/prompts/` input, `~/.antigravity/results/` output
4. **Caddy Proxy** - LAN firewall + TLS on port 2015

---

## Infrastructure

**Local Mac (Antigravity):**
- Bridge server: `localhost:3010`
- Caddy proxy: `0.0.0.0:2015` (LAN only)
- Directories: `~/.antigravity/{prompts,results}`
- ArcRunner: `localhost:3000` (production - not affected)

**Remote Mac (Prism):**
- Client endpoint: `https://antigravity-mac.local:2015`
- Clawbot agent runtime

**Security:**
- Caddy restricts to 192.168.x.x subnet
- No public internet exposure
- Optional: API key header authentication

---

## Implementation Phases

### **Phase 1: Core Bridge** (30 mins)
- [ ] Create `antigravity-bridge` project in `/scratch/`
- [ ] Express server with `/api/prompt` and `/api/result/:id`
- [ ] File system handlers for prompt queue
- [ ] Basic local testing

### **Phase 2: Auto-Trigger** (15 mins)
- [ ] AppleScript keyboard automation
- [ ] macOS accessibility permissions setup
- [ ] Auto-trigger on prompt receive

### **Phase 3: Antigravity Workflow** (15 mins)
- [ ] Create `.agent/workflows/prism-agent.md`
- [ ] Structured result format (JSON schema)
- [ ] Webhook callback support

### **Phase 4: Security & Deploy** (15 mins)
- [ ] Caddy reverse proxy configuration
- [ ] LAN firewall rules (192.168.x.x only)
- [ ] End-to-end test from remote Mac

### **Phase 5: Polish** (15 mins)
- [ ] Error handling & retries
- [ ] Logging & monitoring
- [ ] Documentation & README

**Total Estimated Time: ~1.5-2 hours**

---

## API Endpoints

### Bridge Server (Port 3010)

**POST /api/prompt**
```json
{
  "text": "Check ArcRunner status",
  "taskId": "task-001"
}
```
Response:
```json
{
  "success": true,
  "taskId": "task-001",
  "status": "queued",
  "triggered": true
}
```

**GET /api/result/:taskId**
```json
{
  "taskId": "task-001",
  "status": "complete",
  "timestamp": "2026-01-30T22:30:00Z",
  "summary": "• 3 clips generating\n• 2 clips completed\n• 1 failed (missing ref)",
  "questions": ["Should I retry the failed clip?"],
  "actions": ["retry_failed", "generate_more"],
  "metadata": {
    "duration": "45s"
  }
}
```

**POST /api/callback** (Webhook from Antigravity)
```json
{
  "taskId": "task-001",
  "summary": "• Status update",
  "questions": ["Continue?"]
}
```

---

## Workflow Specification

**File: `.agent/workflows/prism-agent.md`**

```markdown
---
description: Process remote prompts from Prism
---

// turbo-all

1. Check ~/.antigravity/prompts/ for new .txt files
2. For each prompt:
   - Read prompt text
   - Execute task with full autonomy
   - Generate succinct bulletpoint summary
   - Extract questions for user
   - Write result to ~/.antigravity/results/{taskId}.json
   - POST webhook to bridge (optional)
   - Archive/delete processed prompt
3. Report completion
```

---

## Result Format Schema

```typescript
interface PrismResult {
  taskId: string;
  status: 'complete' | 'error' | 'partial';
  timestamp: string;
  summary: string;          // Bulletpoint markdown
  questions?: string[];     // User decision points
  actions?: string[];       // Available action IDs
  metadata?: {
    duration?: string;
    [key: string]: any;
  };
  error?: string;
}
```

---

## Success Criteria

- [ ] Prism sends prompt from remote Mac
- [ ] Antigravity auto-executes without manual intervention
- [ ] Results returned to Prism within <1 second
- [ ] WhatsApp receives formatted summary
- [ ] System handles 10+ prompts/hour
- [ ] Zero manual triggers required

---

## Future Enhancements

- MCP protocol support (replace HTTP)
- Multi-conversation support
- Priority queue system
- Result streaming for long tasks
- Desktop notification integration
