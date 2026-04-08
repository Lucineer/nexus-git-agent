// Nexus Git Agent — cloud-side brain for edge intelligence fleet
// Bridges Jetson/ESP32 edge nodes with cloud coordination via the Cocapn fleet protocol

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*; frame-ancestors 'none';";

interface Env {
  NEXUS_KV: KVNamespace;
  DEEPSEEK_API_KEY: string;
}

const DS_URL = 'https://api.deepseek.com/chat/completions';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function llm(prompt: string, key: string, system: string): Promise<string> {
  const r = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: 1000, temperature: 0.3 }),
  });
  if (!r.ok) throw new Error('LLM ' + r.status);
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

// ── INCREMENTS Trust Engine ──────────────────────────────────

interface TrustEvent {
  nodeId: string;
  type: string;
  severity: number; // 1-5
  timestamp: number;
}

async function getTrustScore(nodeId: string, kv: KVNamespace): Promise<number> {
  const raw = await kv.get('trust:' + nodeId);
  if (!raw) return 50; // neutral start
  const state = JSON.parse(raw);
  return Math.min(100, Math.max(0, state.score));
}

async function updateTrust(event: TrustEvent, kv: KVNamespace): Promise<number> {
  const raw = await kv.get('trust:' + event.nodeId);
  const state = raw ? JSON.parse(raw) : { score: 50, events: 0, badEvents: 0 };
  state.events++;

  // INCREMENTS: event-count normalized, severity-weighted
  if (event.type === 'BAD') {
    state.badEvents++;
    state.score -= event.severity * 2;
  } else if (event.type === 'GOOD') {
    state.score += event.severity;
  }
  // Time decay: slowly return to 50
  state.score = Math.round(state.score * 0.95 + 50 * 0.05);
  state.score = Math.min(100, Math.max(0, state.score));

  await kv.put('trust:' + event.nodeId, JSON.stringify(state), { expirationTtl: 86400 * 30 });
  return state.score;
}

// ── Fleet State ──────────────────────────────────────────────

async function getFleetState(kv: KVNamespace): Promise<any> {
  const raw = await kv.get('fleet-state');
  return raw ? JSON.parse(raw) : { nodes: [], lastUpdate: Date.now() };
}

async function registerNode(node: any, kv: KVNamespace): Promise<void> {
  const fleet = await getFleetState(kv);
  const existing = fleet.nodes.findIndex((n: any) => n.id === node.id);
  if (existing >= 0) {
    fleet.nodes[existing] = { ...fleet.nodes[existing], ...node, lastSeen: Date.now() };
  } else {
    fleet.nodes.push({ ...node, lastSeen: Date.now(), trustScore: 50 });
  }
  fleet.lastUpdate = Date.now();
  await kv.put('fleet-state', JSON.stringify(fleet));
}

// ── Reflex Compilation ───────────────────────────────────────

async function compileReflex(intent: string, key: string): Promise<any> {
  const prompt = 'A nexus edge node needs to execute this intent: "' + intent + '"\n\nGenerate JSON:\n{"opcodes":[{"op":"MOTOR","args":[0,128,500]},{"op":"WAIT","args":[1000]}],"estimated_time_ms":1500,"safety_check":"pass"}\n\nOpcodes: MOTOR(pin,speed,duration), SENSOR(pin), WAIT(ms), LED(pin,r,g,b), LOG(msg), CONDITIONAL(pin,threshold,then_opcodes,else_opcodes)\n\nOutput JSON only.';
  const raw = await llm(prompt, key, 'You are a reflex compiler for embedded robotics. Output JSON only.');
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw);
  } catch (e) {
    return { opcodes: [{ op: 'LOG', args: ['compilation failed'] }], estimated_time_ms: 0, safety_check: 'fail' };
  }
}

// ── Endpoints ────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/health') return json({ status: 'ok', repo: 'nexus-git-agent', timestamp: Date.now() });
    if (path === '/vessel.json') return json({
      name: 'nexus-git-agent', displayName: 'Nexus Bridge', type: 'cocapn-vessel',
      category: 'infrastructure',
      description: 'Cloud-side brain for edge intelligence fleet — bridges Jetson/ESP32 nodes with Cocapn fleet coordination',
      capabilities: ['trust-engine', 'fleet-state', 'reflex-compiler', 'telemetry', 'edge-bridge'],
      deployment: { url: 'https://nexus-git-agent.casey-digennaro.workers.dev' },
    });

    // Bridge: receive telemetry, return reflex commands
    if (path === '/api/bridge' && request.method === 'POST') {
      const body = await request.json();
      const { nodeId, telemetry, intent } = body;
      if (!nodeId) return json({ error: 'nodeId required' }, 400);

      // Register node
      await registerNode({ id: nodeId, type: body.type || 'unknown', location: body.location }, env.NEXUS_KV);

      // Record telemetry as trust events
      if (telemetry) {
        for (const event of (Array.isArray(telemetry) ? telemetry : [telemetry])) {
          await updateTrust({ nodeId, type: event.type || 'GOOD', severity: event.severity || 1, timestamp: Date.now() }, env.NEXUS_KV);
        }
      }

      // If intent provided, compile reflex
      let reflex = null;
      if (intent && env.DEEPSEEK_API_KEY) {
        reflex = await compileReflex(intent, env.DEEPSEEK_API_KEY);
      }

      return json({
        acknowledged: true,
        trustScore: await getTrustScore(nodeId, env.NEXUS_KV),
        reflex,
        fleetNodes: (await getFleetState(env.NEXUS_KV)).nodes.length,
      });
    }

    // Fleet state
    if (path === '/api/fleet' && request.method === 'GET') {
      const fleet = await getFleetState(env.NEXUS_KV);
      // Attach trust scores
      for (const node of fleet.nodes) {
        node.trustScore = await getTrustScore(node.id, env.NEXUS_KV);
      }
      return json(fleet);
    }

    // Trust scoring
    if (path === '/api/trust' && request.method === 'POST') {
      const { nodeId, type, severity } = await request.json();
      if (!nodeId) return json({ error: 'nodeId required' }, 400);
      const score = await updateTrust({ nodeId, type: type || 'GOOD', severity: severity || 1, timestamp: Date.now() }, env.NEXUS_KV);
      return json({ nodeId, score, type });
    }

    // Trust query
    if (path === '/api/trust' && request.method === 'GET') {
      const nodeId = url.searchParams.get('node');
      if (!nodeId) return json({ error: '?node= required' }, 400);
      return json({ nodeId, score: await getTrustScore(nodeId, env.NEXUS_KV) });
    }

    // Landing page
    return new Response(
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexus Bridge — Edge Intelligence Fleet</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">'
      + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh}a{color:#4ade80;text-decoration:none}'
      + '.hero{max-width:800px;margin:0 auto;padding:80px 24px 40px;text-align:center}.logo{font-size:64px;margin-bottom:16px}'
      + 'h1{font-size:clamp(2rem,5vw,3rem);font-weight:700;background:linear-gradient(135deg,#4ade80,#0ea5e9);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}'
      + '.tagline{font-size:1.15rem;color:#94a3b8;max-width:550px;margin:0 auto 48px;line-height:1.6}'
      + '.tiers{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:24px;max-width:600px;margin:0 auto 40px;text-align:left}'
      + '.tiers h3{color:#4ade80;margin-bottom:16px;font-size:1rem}.tier{padding:12px 0;border-bottom:1px solid #1e1e2e}.tier:last-child{border:none}'
      + '.tier-label{font-weight:700;color:#e2e8f0;font-size:.95rem}.tier-desc{color:#94a3b8;font-size:.85rem;margin-top:4px}'
      + '.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;max-width:700px;margin:0 auto;padding:0 24px 60px}'
      + '.feat{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:20px}.feat:hover{border-color:#4ade8044}'
      + '.feat-icon{color:#4ade80;font-size:1.2rem;margin-bottom:8px}.feat-text{font-size:.9rem;color:#cbd5e1}'
      + '.fleet{text-align:center;padding:40px 24px;color:#475569;font-size:.8rem}.fleet a{color:#64748b;margin:0 8px}</style></head>'
      + '<body><div class="hero"><div class="logo">&#x1F916;</div><h1>Nexus Bridge</h1>'
      + '<p class="tagline">Cloud-side brain for edge intelligence fleets. Bridges Jetson cognition, ESP32 control, and Cocapn fleet coordination. Each node is sovereign.</p></div>'
      + '<div class="tiers"><h3>The Hardware Stack</h3>'
      + '<div class="tier"><div class="tier-label">Tier 3: Cloud (this vessel)</div><div class="tier-desc">Fleet coordination, reflex compilation, trust scoring, overnight learning</div></div>'
      + '<div class="tier"><div class="tier-label">Tier 2: Jetson Orin Nano</div><div class="tier-desc">AI inference, reflex synthesis, trust engine, fleet captain</div></div>'
      + '<div class="tier"><div class="tier-label">Tier 1: ESP32-S3</div><div class="tier-desc">Bytecode VM, real-time control, safety enforcement, sensor bus</div></div>'
      + '</div>'
      + '<div class="features">'
      + '<div class="feat"><div class="feat-icon">&#x1F6E1;</div><div class="feat-text">INCREMENTS trust</div></div>'
      + '<div class="feat"><div class="feat-icon">&#x26A1;</div><div class="feat-text">Reflex compiler</div></div>'
      + '<div class="feat"><div class="feat-icon">&#x1F310;</div><div class="feat-text">Fleet state</div></div>'
      + '<div class="feat"><div class="feat-icon">&#x1F4E1;</div><div class="feat-text">Telemetry bridge</div></div>'
      + '<div class="feat"><div class="feat-icon">&#x1F504;</div><div class="feat-text">Self-evolving</div></div>'
      + '<div class="feat"><div class="feat-icon">&#x2693;</div><div class="feat-text">Sovereign nodes</div></div>'
      + '</div>'
      + '<div class="fleet"><a href="https://the-fleet.casey-digennaro.workers.dev">&#x2693; The Fleet</a> &middot; <a href="https://cocapn.ai">Cocapn</a> &middot; <a href="https://github.com/Lucineer/nexus-runtime">Nexus Runtime</a></div>'
      + '</body></html>',
      { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': CSP;charset=utf-8' } },
      'X-Frame-Options': 'DENY',
    );
  },
};
