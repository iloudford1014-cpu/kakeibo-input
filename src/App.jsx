import { useState, useEffect } from "react";

const STORAGE_KEY = "notion_kakeibo_settings";

const CATEGORIES = [
  { label: "クレカ支払い", emoji: "💳" },
  { label: "貯蓄", emoji: "👛" },
  { label: "衣服", emoji: "👔" },
  { label: "ホビー", emoji: "🎮" },
  { label: "自己投資", emoji: "🎧" },
  { label: "交際費", emoji: "🍸" },
  { label: "ジム", emoji: "💪" },
  { label: "ヘアカット・AGA", emoji: "✂️" },
  { label: "電気・ガス・水道・通信", emoji: "⚡" },
  { label: "家賃", emoji: "🏠" },
  { label: "サプリメント", emoji: "💊" },
  { label: "医療費", emoji: "🏥" },
  { label: "日用品", emoji: "🛒" },
  { label: "食事", emoji: "🍜" },
];

const today = () => new Date().toISOString().split("T")[0];

export default function App() {
  const [settings, setSettings] = useState({ token: "", dbId: "" });
  const [showSettings, setShowSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState({ token: "", dbId: "" });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("支出");
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [overlay, setOverlay] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
      setTempSettings(parsed);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempSettings));
    setSettings(tempSettings);
    setShowSettings(false);
  };

  const handleKey = (val) => {
    if (val === "del") {
      setAmount((prev) => prev.slice(0, -1));
    } else if (val === "00") {
      setAmount((prev) => (prev === "" ? "" : prev + "00"));
    } else {
      setAmount((prev) => (prev.length < 8 ? prev + val : prev));
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !amount) return;
    if (!settings.token || !settings.dbId) {
      setErrorMsg("設定からNotion TokenとDB IDを入力してください");
      setOverlay("error");
      return;
    }

    setLoading(true);

    const payload = {
      parent: { database_id: settings.dbId },
      properties: {
        名前: { title: [{ text: { content: `${selectedCategory.emoji} ${selectedCategory.label}` } }] },
        金額: { number: parseInt(amount, 10) },
        種別: { select: { name: type } },
        日付: { date: { start: date } },
        カテゴリ: { select: { name: selectedCategory.label } },
        ...(memo ? { メモ: { rich_text: [{ text: { content: memo } }] } } : {}),
      },
    };

    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: settings.token, databaseId: settings.dbId, payload }),
      });

      if (res.ok) {
        setOverlay("success");
        setAmount("");
        setMemo("");
        setSelectedCategory(null);
        setDate(today());
      } else {
        const data = await res.json();
        setErrorMsg(data.message || "Notionへの送信に失敗しました");
        setOverlay("error");
      }
    } catch (e) {
      setErrorMsg("通信エラー: " + e.message);
      setOverlay("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#1a1a2e", color: "#fff", fontFamily: "sans-serif", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 8px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["支出", "収入"].map((t) => (
            <button key={t} onClick={() => setType(t)}
              style={{ padding: "6px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: "bold", background: type === t ? "#e94560" : "#2a2a4a", color: "#fff" }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => { setTempSettings(settings); setShowSettings(true); }}
          style={{ background: "none", border: "none", color: "#aaa", fontSize: 22, cursor: "pointer" }}>⚙️</button>
      </div>

      <div style={{ padding: "4px 16px 8px" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ background: "#2a2a4a", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 14 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "0 12px 8px" }}>
        {CATEGORIES.map((cat) => (
          <button key={cat.label} onClick={() => setSelectedCategory(cat)}
            style={{ padding: "10px 4px", borderRadius: 10, border: selectedCategory?.label === cat.label ? "2px solid #e94560" : "2px solid transparent", background: selectedCategory?.label === cat.label ? "#3a1a2e" : "#2a2a4a", color: "#fff", cursor: "pointer", fontSize: 12, textAlign: "center" }}>
            <div style={{ fontSize: 20 }}>{cat.emoji}</div>
            <div style={{ marginTop: 2, lineHeight: 1.2 }}>{cat.label}</div>
          </button>
        ))}
      </div>

      <div style={{ padding: "0 12px 8px" }}>
        <input placeholder="メモ（任意）" value={memo} onChange={(e) => setMemo(e.target.value)}
          style={{ width: "100%", background: "#2a2a4a", border: "none", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
      </div>

      <div style={{ textAlign: "right", padding: "4px 20px", fontSize: 36, fontWeight: "bold", letterSpacing: 2, minHeight: 52 }}>
        {amount ? `¥${parseInt(amount).toLocaleString()}` : <span style={{ color: "#555" }}>¥0</span>}
        {amount && <button onClick={() => setAmount("")} style={{ marginLeft: 8, background: "#444", border: "none", color: "#fff", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>×</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "0 12px" }}>
        {["7","8","9","4","5","6","1","2","3","00","0","del"].map((k) => (
          <button key={k} onClick={() => handleKey(k)}
            style={{ padding: "16px", borderRadius: 10, border: "none", background: k === "del" ? "#3a3a5a" : "#2a2a4a", color: "#fff", fontSize: 20, fontWeight: "bold", cursor: "pointer" }}>
            {k === "del" ? "⌫" : k}
          </button>
        ))}
      </div>

      <div style={{ padding: 12 }}>
        <button onClick={handleSubmit} disabled={!selectedCategory || !amount || loading}
          style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: (!selectedCategory || !amount) ? "#444" : "#e94560", color: "#fff", fontSize: 18, fontWeight: "bold", cursor: (!selectedCategory || !amount) ? "default" : "pointer" }}>
          {loading ? "送信中..." : "記録する"}
        </button>
      </div>

      {overlay === "success" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1a2e", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 60 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: "bold", margin: "12px 0" }}>記録しました！</div>
            <button onClick={() => setOverlay(null)} style={{ padding: "10px 32px", borderRadius: 8, border: "none", background: "#e94560", color: "#fff", fontSize: 16, cursor: "pointer" }}>閉じる</button>
          </div>
        </div>
      )}
      {overlay === "error" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1a2e", borderRadius: 16, padding: 32, textAlign: "center", maxWidth: 300 }}>
            <div style={{ fontSize: 60 }}>❌</div>
            <div style={{ fontSize: 22, fontWeight: "bold", margin: "12px 0" }}>エラー</div>
            <div style={{ color: "#aaa", marginBottom: 16 }}>{errorMsg}</div>
            <button onClick={() => setOverlay(null)} style={{ padding: "10px 32px", borderRadius: 8, border: "none", background: "#e94560", color: "#fff", fontSize: 16, cursor: "pointer" }}>閉じる</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1a1a2e", borderRadius: 16, padding: 24, width: "90%", maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 16px" }}>⚙️ 設定</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#aaa" }}>Integration Token</label>
              <input value={tempSettings.token} onChange={(e) => setTempSettings({ ...tempSettings, token: e.target.value })}
                placeholder="secret_xxx..."
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "none", background: "#2a2a4a", color: "#fff", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "#aaa" }}>データベースID</label>
              <input value={tempSettings.dbId} onChange={(e) => setTempSettings({ ...tempSettings, dbId: e.target.value })}
                placeholder="32文字の英数字"
                style={{ width: "100%", marginTop: 4, padding: "8px 12px", borderRadius: 8, border: "none", background: "#2a2a4a", color: "#fff", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSettings(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#2a2a4a", color: "#fff", cursor: "pointer" }}>キャンセル</button>
              <button onClick={saveSettings} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#e94560", color: "#fff", cursor: "pointer", fontWeight: "bold" }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
