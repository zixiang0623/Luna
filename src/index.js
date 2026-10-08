// Luna — Workers AI chat. モデルを増やす/減らすときは下の M を編集するだけ。
const M = [
  ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "Llama 3.3 70B", "汎用・高品質"],
  ["@cf/meta/llama-4-scout-17b-16e-instruct", "Llama 4 Scout 17B", "汎用・MoE"],
  ["@cf/openai/gpt-oss-120b", "gpt-oss 120B", "推論・大型"],
  ["@cf/openai/gpt-oss-20b", "gpt-oss 20B", "推論・軽量"],
  ["@cf/qwen/qwen3-30b-a3b-fp8", "Qwen3 30B-A3B", "多言語・推論"],
  ["@cf/mistralai/mistral-small-3.1-24b-instruct", "Mistral Small 3.1 24B", "汎用"],
  ["@cf/google/gemma-3-12b-it", "Gemma 3 12B", "多言語"],
  ["@cf/qwen/qwq-32b", "QwQ 32B", "推論"],
  ["@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "DeepSeek R1 Distill 32B", "推論"],
  ["@cf/qwen/qwen2.5-coder-32b-instruct", "Qwen2.5 Coder 32B", "コード"],
  ["@cf/meta/llama-3.1-8b-instruct-fast", "Llama 3.1 8B Fast", "高速"],
  ["@cf/meta/llama-3.2-3b-instruct", "Llama 3.2 3B", "超軽量"],
];
// AI Gateway(default ゲートウェイ)で使えるモデル。IDは自由に編集可。
const G = [
  ["openai/gpt-4o", "GPT-4o", "OpenAI"], ["openai/gpt-4o-mini", "GPT-4o mini", "OpenAI"],
  ["openai/gpt-4.1", "GPT-4.1", "OpenAI"], ["openai/gpt-4.1-mini", "GPT-4.1 mini", "OpenAI"],
  ["anthropic/claude-opus-5-5", "Claude Opus 5.5", "Anthropic"], ["anthropic/claude-sonnet-5-5", "Claude Sonnet 5.5", "Anthropic"],
  ["anthropic/claude-haiku-5-5", "Claude Haiku 5.5", "Anthropic"],
  ["google-ai-studio/gemini-2.5-pro", "Gemini 2.5 Pro", "Google"], ["google-ai-studio/gemini-2.5-flash", "Gemini 2.5 Flash", "Google"],
  ["groq/llama-3.3-70b-versatile", "Llama 3.3 70B (Groq)", "Groq"], ["deepseek/deepseek-chat", "DeepSeek Chat", "DeepSeek"],
  ["mistral/mistral-large-latest", "Mistral Large", "Mistral"], ["xai/grok-4", "Grok 4", "xAI"],
];
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

// Wikipedia検索: 上位3件の導入文を返す
async function wiki(q, lang) {
  const u = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  u.search = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: q, gsrlimit: "3", prop: "extracts|info", exintro: "1", explaintext: "1", exchars: "1500", inprop: "url" });
  const r = await fetch(u, { headers: { "user-agent": "Luna/1.0 (https://github.com/zixiang0623/Luna)" }, cf: { cacheTtl: 3600, cacheEverything: true } });
  const d = await r.json();
  return Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index)
    .map(p => ({ title: p.title, url: p.fullurl, extract: (p.extract || "").trim() })).filter(x => x.extract);
}

// 質問から検索キーワードを抜き出す(失敗したら質問文のまま)
async function kw(env, q, sys) {
  try {
    const t = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: q }], max_tokens: 32, temperature: 0 });
    const k = String(t.response || "").split("\n")[0].replace(/["「」`]/g, "").trim();
    if (k && k.length < 80) return k;
  } catch {}
  return q;
}

// Web検索(β): GEMINI_API_KEY(=Google検索) > TAVILY_API_KEY > BRAVE_API_KEY > DuckDuckGo(不安定)
async function web(q, env, q0) {
  if (env.GEMINI_API_KEY) { // Gemini の Google検索グラウンディング。出典URLと、各出典が裏付ける文章を受け取る
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: q0 + "\n\n(Google検索で調べ、事実を日本語で簡潔にまとめてください)" }] }], tools: [{ google_search: {} }] }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    const c = d.candidates?.[0], g = c?.groundingMetadata, text = (c?.content?.parts || []).map(x => x.text || "").join("");
    const ch = g?.groundingChunks || [], ex = ch.map(() => []);
    for (const sp of g?.groundingSupports || []) for (const i of sp.groundingChunkIndices || []) if (ex[i]) ex[i].push(sp.segment?.text || "");
    const out = ch.map((x, i) => ({ title: x.web?.title || "Google検索", url: x.web?.uri, extract: (ex[i].join(" ") || (i === 0 ? text : "")).slice(0, 1200) })).filter(x => x.url).slice(0, 5);
    return out.length || !text ? out : [{ title: "Google検索(Gemini)", url: "https://www.google.com/search?q=" + encodeURIComponent(q0), extract: text.slice(0, 1500) }];
  }
  if (env.TAVILY_API_KEY) {
    const r = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + env.TAVILY_API_KEY }, body: JSON.stringify({ query: q, max_results: 5 }) });
    const d = await r.json();
    return (d.results || []).map(x => ({ title: x.title, url: x.url, extract: String(x.content || "").slice(0, 1200) }));
  }
  if (env.BRAVE_API_KEY) {
    const r = await fetch("https://api.search.brave.com/res/v1/web/search?count=5&q=" + encodeURIComponent(q), { headers: { "x-subscription-token": env.BRAVE_API_KEY, accept: "application/json" } });
    const d = await r.json();
    return (d.web?.results || []).map(x => ({ title: String(x.title || "").replace(/<[^>]+>/g, ""), url: x.url, extract: String(x.description || "").replace(/<[^>]+>/g, "") }));
  }
  const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: { "user-agent": "Mozilla/5.0 (compatible; Luna/1.0)" } });
  const h = await r.text(), out = [];
  const tx = t => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(h)) && out.length < 5) {
    let u = m[1]; const e = /uddg=([^&]+)/.exec(u);
    if (e) u = decodeURIComponent(e[1]); else if (u.startsWith("//")) u = "https:" + u;
    out.push({ title: tx(m[2]), url: u, extract: tx(m[3]) });
  }
  return out;
}

export default {
  async fetch(r, env) {
    const u = new URL(r.url);
    if (u.pathname === "/api/models")
      return J({
        models: M.map(([id, name, tag]) => ({ id, name, tag })), locked: !!env.ACCESS_KEY,
        gateway: { available: true, models: G.map(([id, name, tag]) => ({ id, name, tag })) },
      });
    if (u.pathname === "/api/chat" && r.method === "POST") {
      if (env.ACCESS_KEY && r.headers.get("x-luna-key") !== env.ACCESS_KEY) return J({ error: "アクセスキーが違います" }, 401);
      let b; try { b = await r.json(); } catch { return J({ error: "bad request" }, 400); }
      const { model, messages, system, temperature, max_tokens } = b;
      if (!/^(@cf\/[\w.-]+\/[\w.-]+|[\w.-]+\/[\w.:@\/-]+)$/.test(model || "") || !Array.isArray(messages) || messages.length > 200) return J({ error: "invalid request" }, 400);
      const ms = messages.slice(-60).map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 32000) }));
      if (!model.startsWith("@cf/")) { // AI Gateway の default ゲートウェイ経由(IDの設定は不要)
        const o = /^openai\/(o\d|gpt-5)/.test(model);
        const gp = { messages: system ? [{ role: "system", content: String(system).slice(0, 12000) }, ...ms] : ms, stream: true, [o ? "max_completion_tokens" : "max_tokens"]: Math.min(+max_tokens || 2048, 16384) };
        if (!o) gp.temperature = +temperature || 0.7;
        try {
          return new Response(await env.AI.run(model, gp, { gateway: { id: "default" } }), { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
        } catch (e) { return J({ error: String(e.message || e) }, 502); }
      }
      const oss = model.includes("gpt-oss");
      const p = oss
        ? { input: ms, instructions: system || undefined, reasoning: { effort: "medium" } }
        : { messages: system ? [{ role: "system", content: String(system).slice(0, 12000) }, ...ms] : ms };
      Object.assign(p, { stream: true, temperature: +temperature || 0.7, [oss ? "max_output_tokens" : "max_tokens"]: Math.min(+max_tokens || 2048, 16384) });
      try {
        return new Response(await env.AI.run(model, p), { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
      } catch (e) { return J({ error: String(e.message || e) }, 502); }
    }
    if (u.pathname === "/api/search" && r.method === "POST") {
      if (env.ACCESS_KEY && r.headers.get("x-luna-key") !== env.ACCESS_KEY) return J({ error: "アクセスキーが違います" }, 401);
      let b; try { b = await r.json(); } catch { return J({ error: "bad request" }, 400); }
      let q = String(b.q || "").slice(0, 500).trim();
      if (!q) return J({ results: [] });
      try { // 質問から検索キーワードを抜き出す(失敗したら質問文のまま)
        const t = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", { messages: [
          { role: "system", content: "ユーザーの質問に答えるためのWikipedia検索キーワードを、1行・最大3語で出力。説明や記号は不要。" },
          { role: "user", content: q }], max_tokens: 24, temperature: 0 });
        const k = String(t.response || "").split("\n")[0].replace(/["「」`]/g, "").trim();
        if (k && k.length < 60) q = k;
      } catch {}
      try {
        let res = await wiki(q, "ja");
        if (!res.length) res = await wiki(q, "en");
        return J({ query: q, results: res });
      } catch (e) { return J({ results: [], error: String(e.message || e) }); }
    }
    if (u.pathname === "/api/websearch" && r.method === "POST") {
      if (env.ACCESS_KEY && r.headers.get("x-luna-key") !== env.ACCESS_KEY) return J({ error: "アクセスキーが違います" }, 401);
      let b; try { b = await r.json(); } catch { return J({ error: "bad request" }, 400); }
      const q0 = String(b.q || "").slice(0, 500).trim();
      if (!q0) return J({ results: [] });
      const q = env.GEMINI_API_KEY ? q0 : await kw(env, q0, "ユーザーの質問に答えるためのWeb検索クエリを、1行・最大6語で出力。説明や記号は不要。");
      try {
        const res = (await web(q, env, q0)).filter(x => /^https?:\/\//.test(x.url) && x.extract);
        return J({ query: q, results: res, error: res.length ? undefined : "Web検索の結果を取得できませんでした(GEMINI_API_KEY / TAVILY_API_KEY / BRAVE_API_KEY のいずれかを設定してください)" });
      } catch (e) { return J({ results: [], error: "Web検索に失敗しました: " + String(e.message || e) }); }
    }
    return env.ASSETS.fetch(r);
  },
};
