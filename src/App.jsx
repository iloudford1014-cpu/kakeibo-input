import { useState, useEffect } from "react";

const CATEGORIES = [
  { name: "クレカ支払い", emoji: "💳" },
  { name: "貯蓄", emoji: "👛" },
  { name: "衣服", emoji: "👔" },
  { name: "ホビー", emoji: "🎮" },
  { name: "自己投資", emoji: "🎧" },
  { name: "交際費", emoji: "🍸" },
  { name: "ジム", emoji: "💪" },
  { name: "ヘアカット・AGA", emoji: "✂️" },
  { name: "電気・ガス・水道・通信", emoji: "⚡" },
  { name: "家賃", emoji: "🏠" },
  { name: "サプリメント", emoji: "💊" },
  { name: "医療費", emoji: "🏥" },
  { name: "日用品", emoji: "🛒" },
  { name: "食事", emoji: "🍜" },
];

const STORAGE_KEY = "notion_kakeibo_settings";

export default function App() {
  const [screen, setScreen] = useState("main");
  const [type, setType] = useState("支出");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [settings, setSettings] = useState({ token: "", dbId: "" });
  const [tempSettings, setTempSettings] = useState({ token: "", dbId: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      setSettings(s);
      setTempSettings(s);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tempSettings));
    setSettings(tempSettings);
    setScreen("main");
  };

  const handleKey = (val) => {
    if (val === "del") {
      setAmount((a) => a.slice(0, -1));
    } else if (val === "00") {
      setAmount((a) => (a === "" ? "" : a + "00"));
    } else if (val === "0") {
      setAmount((a) => (a === "" ? "" : a + "0"));
    } else {
      setAmount((a) => (a.length >= 9 ? a : a + val));
    }
  };

  const handleSubmit = async () => {
    if (!amount || !selectedCategory) return;
    if (!settings.token || !settings.dbId) {
      setScreen("settings");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: settings.dbId },
          properties: {
            名前: { title: [{ text: { content: selectedCategory.name } }] },
            金額: { number: parseInt(amount) },
            種別: { select: { name: type } },
            日付: { date: { start: date } },
            メモ: { rich_text: [] },
            カテゴリ: { select: { name: selectedCategory.name } },
          },
        }),
      });
      if (resp.ok) {
        setResult("success");
        setTimeout(() => {
          setResult(null);
          setAmount("");
          setSelectedCategory(null);
        }, 2000);
      } else {
        const err = await resp.json();
        setErrorMsg(err.message || "エラーが発生しました");
        setResult("error");
      }
    } catch (e) {
      setErrorMsg("通信エラー: " + e.message);
      setResult("error");
    }
    setLoading(false);
  };

  if (screen === "settings") {
    return (
      <div style={s.container}>
        <div style={s.settingsHeader}>
          <button style={s.backBtn} onClick={() => setScreen("main")}>←</button>
          <span style={s.settingsTitle}>Notion設定</span>
          <div style={{ width: 40 }} />
        </div>
        <div style={s.settingsBody}>
          <p style={s.settingsDesc}>NotionのIntegration Tokenとデータベース IDを入力してください。</p>
          <div style={s.fieldGroup}>
            <label style={s.label}>Integration Token</label>
            <input style={s.input} type="password" placeholder="secret_xxxx..."
              value={tempSettings.token}
              onChange={(e) => setTempSettings((p) => ({ ...p, token: e.target.value }))} />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>データベース ID</label>
            <input style={s.input} type="text" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={tempSettings.dbId}
              onChange={(e) => setTempSettings((p) => ({ ...p, dbId: e.target.value }))} />
          </div>
          <div style={s.fieldGroup}>
            <label style={s.label}>Notionデータベースに必要なプロパティ</label>
            <div style={s.propList}>
              {[["名前","タイトル"],["金額","数値"],["種別","セレクト（支出/収入）"],["日付","日付"],["カテゴリ","セレクト"],["メモ","テキスト"]].map(([k,v]) => (
                <div key={k} style={s.propItem}>
                  <span style={s.propKey}>{k}</span>
                  <span style={s.propVal}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <button style={s.saveBtn} onClick={saveSettings}>保存する</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.iconBtn} onClick={() => { setTempSettings(settings); setScreen("settings"); }}>⚙️</button>
        <div style={s.typeToggle}>
          <button style={{ ...s.typeBtn, ...(type === "支出" ? s.typeBtnActive : {}) }} onClick={() => setType("支出")}>支出</button>
          <button style={{ ...s.typeBtn, ...(type === "収入" ? s.typeBtnActiveIncome : {}) }} onClick={() => setType("収入")}>収入</button>
        </div>
        <input type="date" style={s.dateInput} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div style={s.catGrid}>
        {CATEGORIES.map((c) => (
          <button key={c.name}
            style={{ ...s.catBtn, ...(selectedCategory?.name === c.name ? (type === "支出" ? s.catBtnActiveSpending : s.catBtnActiveIncome) : {}) }}
            onClick={() => setSelectedCategory(c)}>
            <span style={s.catEmoji}>{c.emoji}</span>
            <span style={s.catName}>{c.name}</span>
          </button>
        ))}
      </div>

      <div style={s.amountBar}>
        <span style={s.amountDisplay}>{amount ? `¥${parseInt(amount).toLocaleString()}` : "¥0"}</span>
        {amount && <button style={s.clearBtn} onClick={() => setAmount("")}>✕</button>}
      </div>

      <div style={s.pad}>
        {[["7","8","9"],["4","5","6"],["1","2","3"],["00","0","del"]].map((row, ri) => (
          <div key={ri} style={s.padRow}>
            {row.map((k) => (
              <button key={k} style={s.padKey} onClick={() => handleKey(k)}>
                {k === "del" ? "⌫" : k}
              </button>
            ))}
            {ri === 3 && (
              <button
                style={{ ...s.submitKey, opacity: (!amount || !selectedCategory || loading) ? 0.5 : 1 }}
                onClick={handleSubmit}
                disabled={!amount || !selectedCategory || loading}>
                {loading ? "送信中" : "入力"}
              </button>
            )}
          </div>
        ))}
      </div>

      {result && (
        <div style={s.overlay}>
          <div style={s.resultCard}>
            {result === "success" ? (
              <>
                <div style={s.resultIcon}>✅</div>
                <div style={s.resultTitle}>保存しました</div>
                <div style={s.resultDetail}>{selectedCategory?.name} ¥{parseInt(amount).toLocaleString()}</div>
              </>
            ) : (
              <>
                <div style={s.resultIcon}>❌</div>
                <div style={s.resultTitle}>エラー</div>
                <div style={s.resultDetail}>{errorMsg}</div>
                <button style={s.closeBtn} onClick={() => setResult(null)}>閉じる</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { minHeight: "100vh", background: "#0f0f0f", color: "#fff", fontFamily: "'Hiragino Sans','Noto Sans JP',sans-serif", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto", userSelect: "none" },
  header: { display: "flex", alignItems: "center", padding: "12px 16px", gap: 12, background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" },
  iconBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 4 },
  typeToggle: { display: "flex", flex: 1, background: "#2a2a2a", borderRadius: 10, padding: 3, gap: 3 },
  typeBtn: { flex: 1, border: "none", background: "none", color: "#888", fontWeight: 700, fontSize: 14, padding: "7px 0", borderRadius: 8, cursor: "pointer" },
  typeBtnActive: { background: "#00c853", color: "#fff" },
  typeBtnActiveIncome: { background: "#2979ff", color: "#fff" },
  dateInput: { background: "#2a2a2a", border: "none", color: "#ccc", borderRadius: 8, padding: "7px 10px", fontSize: 13 },
  catGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "12px 12px 6px", flex: 1 },
  catBtn: { background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 10, padding: "10px 6px", cursor: "pointer", color: "#ccc", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 58, justifyContent: "center" },
  catBtnActiveSpending: { background: "#003820", borderColor: "#00c853", color: "#00c853" },
  catBtnActiveIncome: { background: "#001a4d", borderColor: "#2979ff", color: "#2979ff" },
  catEmoji: { fontSize: 16 },
  catName: { fontSize: 11, textAlign: "center", lineHeight: 1.3, fontWeight: 600 },
  amountBar: { display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "8px 20px", background: "#1a1a1a", borderTop: "1px solid #2a2a2a", borderBottom: "1px solid #2a2a2a", gap: 12 },
  amountDisplay: { fontSize: 36, fontWeight: 800, letterSpacing: "-1px", color: "#fff" },
  clearBtn: { background: "#333", border: "none", color: "#aaa", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 14 },
  pad: { padding: "8px 12px 16px", display: "flex", flexDirection: "column", gap: 6 },
  padRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, height: 60 },
  padKey: { background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#00c853", fontSize: 22, fontWeight: 700, borderRadius: 10, cursor: "pointer" },
  submitKey: { background: "#00c853", border: "none", color: "#fff", fontSize: 18, fontWeight: 800, borderRadius: 10, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  resultCard: { background: "#1e1e1e", borderRadius: 20, padding: "32px 40px", textAlign: "center", border: "1px solid #333", minWidth: 260 },
  resultIcon: { fontSize: 48, marginBottom: 12 },
  resultTitle: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  resultDetail: { color: "#aaa", fontSize: 16 },
  closeBtn: { marginTop: 16, background: "#333", border: "none", color: "#fff", padding: "10px 24px", borderRadius: 10, cursor: "pointer", fontSize: 15 },
  settingsHeader: { display: "flex", alignItems: "center", padding: "16px", borderBottom: "1px solid #2a2a2a", background: "#1a1a1a" },
  backBtn: { background: "none", border: "none", color: "#00c853", fontSize: 20, cursor: "pointer", width: 40 },
  settingsTitle: { flex: 1, textAlign: "center", fontWeight: 800, fontSize: 17 },
  settingsBody: { padding: 20, display: "flex", flexDirection: "column", gap: 20 },
  settingsDesc: { color: "#888", fontSize: 13, lineHeight: 1.6 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, color: "#aaa", fontWeight: 600 },
  input: { background: "#1e1e1e", border: "1px solid #333", color: "#fff", borderRadius: 10, padding: "12px 14px", fontSize: 14, outline: "none" },
  propList: { background: "#1e1e1e", borderRadius: 10, overflow: "hidden", border: "1px solid #2a2a2a" },
  propItem: { display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #2a2a2a", fontSize: 13 },
  propKey: { fontWeight: 700, color: "#00c853" },
  propVal: { color: "#888" },
  saveBtn: { background: "#00c853", border: "none", color: "#fff", fontWeight: 800, fontSize: 16, padding: "16px", borderRadius: 12, cursor: "pointer" },
};
