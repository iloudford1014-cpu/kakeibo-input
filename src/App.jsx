import { useState, useEffect, useCallback } from "react";

// ── Notion DB（Financeページ配下）───────────────────────────
const LOG_DB = "53897d1851e44fe8a5579f0ea59a5074"; // 支出ログ
const BUDGET_DBS = [
  { key: "monthly", label: "月間", dbId: "2b6510d175014e269c8e5efc61f12347", relation: "月間予算" },
  { key: "variable", label: "変動", dbId: "d269f8c00bdb44b2963e74a848445745", relation: "変動予算" },
];

const STORAGE_KEY = "notion_kakeibo_settings";

// 予算項目名 → 表示（絵文字・短縮名・並び順）。未登録の項目は 💴 で末尾に出る
const META = {
  "食事・サプリ": { emoji: "🍜", short: "食事・サプリ", order: 1 },
  "日用品・美容・医療": { emoji: "🛒", short: "日用品・美容", order: 2 },
  "遊び・家具・家電・趣味・衣服": { emoji: "🎮", short: "遊び・趣味・服", order: 3 },
  "ヘア": { emoji: "✂️", short: "ヘア", order: 4 },
  "サブスク": { emoji: "🎧", short: "サブスク", order: 5 },
  "ジム": { emoji: "💪", short: "ジム", order: 6 },
  "電気・ガス・水道": { emoji: "⚡", short: "光熱費", order: 7 },
  "通信": { emoji: "📱", short: "通信", order: 8 },
  "家賃": { emoji: "🏠", short: "家賃", order: 9 },
  "貯蓄": { emoji: "👛", short: "貯蓄", order: 10 },
  "交際・家具・家電・趣味・衣服・冠婚葬祭": { emoji: "🍸", short: "交際・冠婚葬祭", order: 1 },
  "旅行": { emoji: "✈️", short: "旅行", order: 2 },
  "脱毛・アートメイク": { emoji: "💆", short: "脱毛・アートメイク", order: 3 },
  "賃貸更新料　積立": { emoji: "📦", short: "更新料積立", order: 4 },
};

// 端末のローカル日付（toISOStringはUTCなので朝9時前に前日扱いになるのを防ぐ）
const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const yen = (n) => `¥${Math.round(n || 0).toLocaleString()}`;

const numOf = (prop) => {
  if (!prop) return 0;
  if (prop.type === "number") return prop.number || 0;
  if (prop.type === "formula") return prop.formula?.number || 0;
  if (prop.type === "rollup") return prop.rollup?.number || 0;
  return 0;
};

async function notion(token, body) {
  const res = await fetch("/api/notion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Notionとの通信に失敗しました");
  return data;
}

export default function App() {
  const [token, setToken] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tempToken, setTempToken] = useState("");

  const [budgets, setBudgets] = useState({ monthly: [], variable: [] });
  const [tab, setTab] = useState("monthly");
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.token) {
        setToken(saved.token);
        setTempToken(saved.token);
      } else {
        setShowSettings(true);
      }
    } catch {
      setShowSettings(true);
    }
  }, []);

  const loadBudgets = useCallback(async () => {
    if (!token) return;
    setLoadingBudgets(true);
    try {
      const next = {};
      for (const b of BUDGET_DBS) {
        const data = await notion(token, { action: "query", databaseId: b.dbId, payload: { page_size: 100 } });
        next[b.key] = data.results
          .map((p) => {
            const name = (p.properties["項目"]?.title || []).map((t) => t.plain_text).join("");
            const budget = numOf(p.properties["予算"]);
            const spent = numOf(p.properties["実績"]);
            const meta = META[name] || { emoji: "💴", short: name, order: 99 };
            return { id: p.id, name, budget, spent, ...meta };
          })
          .filter((x) => x.name)
          .sort((a, b2) => a.order - b2.order || b2.budget - a.budget);
      }
      setBudgets(next);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingBudgets(false);
    }
  }, [token]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  // アプリに戻ってきたとき（ホーム画面から再表示）に最新化
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadBudgets();
        setDate(today());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadBudgets]);

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: tempToken.trim() }));
    setToken(tempToken.trim());
    setShowSettings(false);
  };

  const handleKey = (val) => {
    if (val === "del") setAmount((prev) => prev.slice(0, -1));
    else if (val === "00") setAmount((prev) => (prev === "" ? "" : prev + "00"));
    else if (val === "0") setAmount((prev) => (prev === "" ? "" : prev + "0"));
    else setAmount((prev) => (prev.length < 8 ? prev + val : prev));
  };

  const handleSubmit = async () => {
    if (!selected || !amount || sending) return;
    const value = parseInt(amount, 10);
    const rel = BUDGET_DBS.find((b) => b.key === selected.group).relation;
    const payload = {
      parent: { database_id: LOG_DB },
      properties: {
        名前: { title: [{ text: { content: `${selected.emoji} ${selected.short}` } }] },
        金額: { number: value },
        種別: { select: { name: "支出" } },
        日付: { date: { start: date } },
        [rel]: { relation: [{ id: selected.id }] },
        ...(memo ? { メモ: { rich_text: [{ text: { content: memo } }] } } : {}),
      },
    };

    setSending(true);
    try {
      await notion(token, { action: "create", payload });
      // 画面上は即時に反映（Notion側の再計算を待たない）
      const isThisMonth = date.slice(0, 7) === today().slice(0, 7);
      const newSpent = selected.spent + (isThisMonth ? value : 0);
      setBudgets((prev) => ({
        ...prev,
        [selected.group]: prev[selected.group].map((x) => (x.id === selected.id ? { ...x, spent: newSpent } : x)),
      }));
      setToast({ name: selected.short, emoji: selected.emoji, value, remaining: selected.budget - newSpent });
      setTimeout(() => setToast(null), 1800);
      setAmount("");
      setMemo("");
      setSelected(null);
      setDate(today());
      setTimeout(loadBudgets, 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const list = (budgets[tab] || []).map((x) => ({ ...x, group: tab }));
  const all = [...budgets.monthly, ...budgets.variable];
  const monthTotal = budgets.monthly.reduce((s, x) => s + x.budget, 0);
  const monthSpent = budgets.monthly.reduce((s, x) => s + x.spent, 0);
  const pct = monthTotal ? Math.min(100, (monthSpent / monthTotal) * 100) : 0;
  const ready = selected && amount && !sending;

  const C = { bg: "#0f0f14", card: "#1d1d28", card2: "#262636", accent: "#e94560", sub: "#8a8aa0", ok: "#4cd59a" };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", background: C.bg, color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", display: "flex", flexDirection: "column" }}>
      {/* 今月サマリー */}
      <div style={{ padding: "12px 16px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: C.sub }}>今月の月間予算 {loadingBudgets && "· 更新中"}</div>
          <button onClick={() => { setTempToken(token); setShowSettings(true); }} style={{ background: "none", border: "none", color: C.sub, fontSize: 18, padding: 4 }}>⚙️</button>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>残り {yen(monthTotal - monthSpent)}</div>
          <div style={{ fontSize: 12, color: C.sub }}>{yen(monthSpent)} / {yen(monthTotal)}</div>
        </div>
        <div style={{ height: 6, background: C.card2, borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 90 ? C.accent : C.ok, transition: "width .4s" }} />
        </div>
      </div>

      {/* 月間 / 変動 切り替え */}
      <div style={{ display: "flex", gap: 6, padding: "4px 12px 8px" }}>
        {BUDGET_DBS.map((b) => (
          <button key={b.key} onClick={() => { setTab(b.key); setSelected(null); }}
            style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, background: tab === b.key ? C.accent : C.card, color: "#fff" }}>
            {b.label}予算
          </button>
        ))}
      </div>

      {/* 予算項目（タップで選択・残額つき） */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "0 12px 8px" }}>
        {list.map((x) => {
          const rem = x.budget - x.spent;
          const on = selected?.id === x.id;
          return (
            <button key={x.id} onClick={() => setSelected(x)}
              style={{ padding: "8px 4px", borderRadius: 12, border: on ? `2px solid ${C.accent}` : "2px solid transparent", background: on ? "#3a1a2e" : C.card, color: "#fff", textAlign: "center", minHeight: 74 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>{x.emoji}</div>
              <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.2 }}>{x.short}</div>
              <div style={{ fontSize: 11, marginTop: 3, fontWeight: 700, color: rem < 0 ? C.accent : C.sub }}>残 {yen(rem)}</div>
            </button>
          );
        })}
        {!list.length && !loadingBudgets && token && (
          <div style={{ gridColumn: "1 / -1", color: C.sub, fontSize: 13, padding: 12, textAlign: "center" }}>予算項目を読み込めませんでした</div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* 日付・メモ */}
      <div style={{ display: "flex", gap: 6, padding: "0 12px 6px" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ background: C.card, border: "none", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 14, flexShrink: 0 }} />
        <input placeholder="メモ（任意）" value={memo} onChange={(e) => setMemo(e.target.value)}
          style={{ flex: 1, minWidth: 0, background: C.card, border: "none", color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 16 }} />
      </div>

      {/* 金額表示 */}
      <div style={{ textAlign: "right", padding: "2px 20px", fontSize: 38, fontWeight: 700, letterSpacing: 1, minHeight: 52 }}>
        {amount ? yen(parseInt(amount, 10)) : <span style={{ color: "#444" }}>¥0</span>}
      </div>

      {/* テンキー */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "0 12px" }}>
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "del"].map((k) => (
          <button key={k} onClick={() => handleKey(k)}
            style={{ padding: "14px 0", borderRadius: 12, border: "none", background: k === "del" ? C.card2 : C.card, color: "#fff", fontSize: 22, fontWeight: 600 }}>
            {k === "del" ? "⌫" : k}
          </button>
        ))}
      </div>

      <div style={{ padding: 12 }}>
        <button onClick={handleSubmit} disabled={!ready}
          style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: ready ? C.accent : "#333", color: "#fff", fontSize: 18, fontWeight: 700 }}>
          {sending ? "記録中…" : selected ? `${selected.emoji} ${selected.short} に記録` : "項目を選んでください"}
        </button>
      </div>

      {/* 記録完了トースト（自動で消える） */}
      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, top: "calc(env(safe-area-inset-top) + 16px)", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "#14281f", border: `1px solid ${C.ok}`, borderRadius: 14, padding: "12px 18px", textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
            <div style={{ fontWeight: 700 }}>✅ {toast.emoji} {toast.name} {yen(toast.value)}</div>
            <div style={{ fontSize: 13, marginTop: 2, color: toast.remaining < 0 ? C.accent : C.ok }}>
              {toast.remaining < 0 ? `予算オーバー ${yen(-toast.remaining)}` : `残り ${yen(toast.remaining)}`}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div onClick={() => setError("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 24, textAlign: "center", maxWidth: 320 }}>
            <div style={{ fontSize: 40 }}>❌</div>
            <div style={{ margin: "8px 0 16px", color: "#ddd", fontSize: 14 }}>{error}</div>
            <button style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: C.accent, color: "#fff" }}>閉じる</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.card, borderRadius: 16, padding: 24, width: "90%", maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 16px" }}>⚙️ 設定</h3>
            <label style={{ fontSize: 12, color: C.sub }}>Notion Integration Token</label>
            <input value={tempToken} onChange={(e) => setTempToken(e.target.value)} placeholder="ntn_xxx / secret_xxx"
              style={{ width: "100%", marginTop: 4, marginBottom: 8, padding: "10px 12px", borderRadius: 8, border: "none", background: C.card2, color: "#fff", fontSize: 16, boxSizing: "border-box" }} />
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>
              NotionのFinanceページに、このインテグレーションを「接続」しておく必要があります。
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {token && <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.card2, color: "#fff" }}>キャンセル</button>}
              <button onClick={saveSettings} disabled={!tempToken.trim()} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700 }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
