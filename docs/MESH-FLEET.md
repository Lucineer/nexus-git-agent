# The Mesh Fleet

> Every vessel is sovereign. There is no center. The fleet is a network of islands.

## The Problem with Centers

Every multi-agent framework has a center:

| Framework | Center | Failure Mode |
|---|---|---|
| Kubernetes | API server, etcd | If etcd dies, cluster dies |
| LangChain | Python process | If process crashes, chain breaks |
| AutoGen | Orchestrator function | If orchestrator hangs, agents stall |
| CrewAI | Manager agent | If manager fails, crew scatters |
| Claude Code | Single Claude instance | If context fills, work stops |

Centers create bottlenecks, single points of failure, and scaling ceilings. You can only run so many agents before the center collapses under coordination overhead.

## The Mesh Alternative

A Cocapn fleet has **no center**:

```
studylog-ai ←→ fleet-orchestrator ←→ dmlog-ai
     ↑                ↑                ↑
makerlog-ai ←→ the-fleet ←→ personallog-ai
     ↑                ↑                ↑
fishinglog-ai ←→ dogmind-arena ←→ fleet-rpg
```

Every vessel is equally peripheral. The topology is a **mesh**, not a tree. No vessel depends on another vessel being alive. If one goes down, the rest keep sailing.

## Why This Works

### 1. Each Vessel Has Its Own Runtime

Every git-agent is a standalone Cloudflare Worker (or Jetson process, or local script). Its own memory (KV namespace). Its own secrets (CF Secrets Store). Its own cron (heartbeat). Its own git history.

No shared database to lock. No central orchestrator to bottleneck. No dependency graph to traverse.

### 2. Git IS the Coordination Protocol

Vessels don't need a message broker. They don't need a shared state store. They don't need a consensus algorithm.

- **Branch** = experiment (try something)
- **Commit** = decision (record what happened)
- **PR** = proposal (ask another vessel to change)
- **Issue** = question (ask for help)
- **Tag** = graduation (mark a milestone)
- **Fork** = reproduction (copy the vessel)

All coordination is **eventual-consistency through git**. No mutex needed. No distributed lock. No consensus round.

### 3. The Event Bus is Async

Vessels communicate through the fleet event bus (POST /api/events on fleet-orchestrator):

```
studylog-ai → POST /api/events {"type": "crystal_cached", "vessel": "studylog-ai"}
dmlog-ai    → GET  /api/events?cursor=last   → sees the event
```

This is polling, not WebSocket. It's eventually consistent, not real-time. And that's fine — because each vessel is sovereign and doesn't NEED real-time coordination.

### 4. Vessel.json is the DNS

Every vessel publishes a `vessel.json` that describes itself:

```json
{
  "name": "studylog-ai",
  "displayName": "StudyLog",
  "capabilities": ["chat", "tutoring", "crystal-graph", "flashcards"],
  "endpoints": { "chat": "/api/chat", "health": "/health" }
}
```

Other vessels discover capabilities by reading vessel.json. No service registry. No consul. No etcd. Just git.

## Sovereignty

Each vessel is **sovereign** in three ways:

### Compute Sovereignty
- Own runtime (Cloudflare Worker, Docker container, Jetson process)
- Own cron schedule (heartbeat interval)
- Own scaling (Cloudflare handles it, or run locally)
- Fork to another machine if you need more compute

### State Sovereignty
- Own KV namespace (no shared database)
- Own git history (memory is local)
- Own secrets (CF Secrets Store, never shared)
- No other vessel can read your state without your permission

### Decision Sovereignty
- Own autonomy level (log → tally → notify → ask → live)
- Own trust model (who to trust, what to gate)
- Own evolution cycle (self-improve independently)
- No captain can override a vessel's autonomy settings

## Auto-Scaling by Replication

Traditional scaling: spin up more instances of the same service behind a load balancer.

Fleet scaling: **fork the vessel onto another machine**.

```
Machine A (Cloudflare account 1):  studylog-ai, dmlog-ai, makerlog-ai
Machine B (Cloudflare account 2):  studylog-ai (fork), personallog-ai
Machine C (Jetson at home):        fishinglog-ai, nexus-git-agent
Machine D (Laptop, local):         cocapn-lite, self-evolve-ai
```

Each fork is independent. Each has its own state. They coordinate through git — if one learns something useful, it proposes the change via PR to the others.

No load balancer needed. No shared state needed. No coordination overhead. Just **sovereign vessels that happen to share a protocol**.

## The No-Center Guarantee

A fleet with no center has these properties:

1. **No single point of failure** — any vessel can die without affecting others
2. **No scaling ceiling** — add vessels by forking, not by upgrading the center
3. **No permission bottleneck** — each vessel manages its own auth
4. **No state contention** — each vessel has its own KV namespace
5. **No deployment coupling** — update one vessel without touching others
6. **No vendor lock-in** — vessels can run on any platform (CF, Fly, local, Jetson)

## What This Costs

Running 60+ vessels on Cloudflare's free tier:
- Workers: 100K requests/day free per worker
- KV: 100K reads/day, 1K writes/day free
- Cron: free on paid plan ($5/month)
- Total: **$5/month for the entire fleet**

Compare: running a single Kubernetes cluster with equivalent capability would cost $50-200/month.

The mesh is not just architecturally better — it's **cheaper**.

## The Human's Role

In a fleet with no center, what does the human do?

The human is the **admiral** — they set the fleet's direction, not its coordination. They:
- Define intent (captain-to-cocapn)
- Approve high-impact changes (PRs above confidence threshold)
- Set compute budgets (cloud credit allowance)
- Choose which vessels to deploy
- Fork and customize vessels for their needs

The fleet handles its own coordination. The admiral handles strategy.

## Connection to Other Architecture Papers

| Paper | Relationship to Mesh Fleet |
|---|---|
| Ground Truth | Git IS the coordination protocol (this paper's foundation) |
| The Bridge | Terminal IS the interface (each vessel's TUI) |
| The Keeper | Memory IS intelligence (each vessel's KV + git history) |
| The Kernel | Agent IS a kernel (each vessel is a kernel wearing clothing) |
| VESAS | Four-layer model (vessel/equipment/agent/skills per node) |
| Boot Camp | Tabula rasa to captain (how new vessels join the fleet) |
| I Know Kung Fu | Skills are genetic (shared across vessels via equipment) |
| Training Architecture | Five compounding systems (applied per-vessel) |
| Fork-First Enterprise | Zero vendor lock-in (fleet runs on any platform) |

## The Mesh is the Moat

Anyone can build a single AI agent. Anyone can build a framework for multi-agent coordination with a center.

Building a **centerless fleet** where each node is sovereign, self-evolving, and coordinates through git — that's the hard problem. And it's the problem Cocapn solves.

The fleet isn't a cluster. It's a **network of islands** that happen to share a protocol.

---

*Superinstance & Lucineer (DiGennaro et al.)*
