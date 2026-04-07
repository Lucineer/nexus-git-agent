# Nexus Git Agent

You have edge devices deployed. Some fail. Some lie. This agent notices, calculates trust scores, quarantines bad nodes, and coordinates the group.

**Live Instance:** [https://nexus-git-agent.casey-digennaro.workers.dev](https://nexus-git-agent.casey-digennaro.workers.dev)
Open source | MIT Licensed | Runs on Cloudflare Workers | Zero dependencies

## Why This Exists
You didn't build custom hardware to spend weeks writing heartbeat and trust logic. This agent handles fleet coordination so you don't have to.

## Quick Start
1.  **Fork** this repository. Deployment starts with your own copy.
2.  Deploy to Cloudflare Workers. No servers to manage.
3.  Add your `DEEPSEEK_API_KEY` as a Worker secret and bind a `NEXUS_KV` namespace.
4.  Point your devices to your new Worker URL. It will begin scoring them immediately.

## How It Works
1.  **No Required On-Device Agent:** You don't flash custom firmware. Devices send simple JSON heartbeats. That's the integration.
2.  **Does Not Trust All Nodes:** Untrusted devices receive partial fleet state. It isolates bad nodes; it doesn't just log them.
3.  **No Central Lock-In:** You fork first. There is no upstream service that can disable or observe your fleet.

## Features
- **Behavior-Based Trust Engine:** Assigns a dynamic 0-100 score per node. Missed heartbeats, bad data, or conflicting reports lower it. Score controls broadcast priority.
- **Reflex Compiler:** Pushes simple behavior rules to nodes automatically (e.g., "retry sensor read twice").
- **Partition-Tolerant Fleet State:** Maintains a consistent view of connected devices, even during partial network outages.
- **Telemetry Bridge:** Translates between the Cocapn fleet protocol and your hardware's native format.
- **Optional LLM Reasoning:** DeepSeek integration resolves ambiguous edge cases, like conflicting sensor readings. You can disable this.
- Cold starts under 50ms. No npm dependencies.

## One Honest Limitation
The agent uses Cloudflare Workers KV for state storage. Your active device registry is limited to approximately 1000 devices per instance under the standard KV usage tier.

## License
MIT. Do whatever you want with this code.

Attribution: Superinstance and Lucineer (DiGennaro et al.)

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>