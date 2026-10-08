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
  u.search = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: q, gsrnamespace: "0", gsrlimit: "8", prop: "extracts|info|pageprops", ppprop: "disambiguation", exintro: "1", explaintext: "1", exchars: "700", exlimit: "max", inprop: "url" });
  const r = await fetch(u, { headers: { "user-agent": "Luna/1.0 (https://github.com/zixiang0623/Luna)" }, cf: { cacheTtl: 3600, cacheEverything: true } });
  const d = await r.json(), ql = q.toLowerCase();
  // 曖昧さ回避・「図1」のような短いページ・本文が極端に短いページを除き、記事名がキーワードと一致するものを優先して上位2件
  return Object.values(d.query?.pages || {})
    .filter(p => !p.pageprops?.disambiguation && !/^[図表画像]\d*$/.test(p.title) && (p.extract || "").trim().length >= 60)
    .map(p => { const t = p.title.toLowerCase(); return { title: p.title, url: p.fullurl, extract: p.extract.trim(), sc: (ql.includes(t) || t.includes(ql) ? 100 : 0) - p.index }; })
    .sort((a, b) => b.sc - a.sc).slice(0, 2).map(({ sc, ...x }) => x);
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
          { role: "system", content: "ユーザーの質問の主題となる、Wikipediaの記事名になりそうな名詞を1行で出力(最大2語)。説明や記号は不要。Wikipediaで調べる価値がない雑談・依頼・挨拶なら「なし」とだけ出力。" },
          { role: "user", content: q }], max_tokens: 24, temperature: 0 });
        const k = String(t.response || "").split("\n")[0].replace(/["「」`]/g, "").trim();
        if (k === "なし") return J({ results: [] });
        if (k && k.length < 60) q = k;
      } catch {}
      try {
        let res = await wiki(q, "ja");
        if (!res.length) res = await wiki(q, "en");
        return J({ query: q, results: res });
      } catch (e) { return J({ results: [], error: String(e.message || e) }); }
    }
    if (u.pathname === "/api/memory" && r.method === "POST") { // 発言から「ユーザー自身についての事実」を抽出
      if (env.ACCESS_KEY && r.headers.get("x-luna-key") !== env.ACCESS_KEY) return J({ error: "アクセスキーが違います" }, 401);
      let b; try { b = await r.json(); } catch { return J({ error: "bad request" }, 400); }
      const text = String(b.text || "").slice(0, 1500), known = (Array.isArray(b.known) ? b.known : []).slice(-50).map(x => String(x).slice(0, 80));
      try {
        const t = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", { messages: [
          { role: "system", content: "あなたはユーザーについての長期記憶を抽出する係です。ユーザーの発言から、今後の会話で役立つ『ユーザー自身についての事実』(名前、呼ばれ方、居住地、職業、趣味、好み、使っている技術、継続中のプロジェクト、目標など)だけを、1件80字以内の日本語の短文にして、JSON配列(文字列の配列)のみで出力する。一時的な話題、質問の内容、一般知識、他人の情報、パスワード・APIキー・カード番号・詳しい住所、健康・性・宗教・政治などのセンシティブな情報は含めない。該当がなければ[]。既存の記憶と重複するものは出さない。\n既存の記憶: " + JSON.stringify(known) },
          { role: "user", content: text }], max_tokens: 200, temperature: 0 });
        const m = String(t.response || "").match(/\[[\s\S]*\]/);
        const arr = m ? JSON.parse(m[0]) : [];
        return J({ add: arr.filter(x => typeof x === "string").map(x => x.trim()).filter(x => x && x.length <= 80).slice(0, 3) });
      } catch { return J({ add: [] }); }
    }
    return env.ASSETS.fetch(r);
  },
};
