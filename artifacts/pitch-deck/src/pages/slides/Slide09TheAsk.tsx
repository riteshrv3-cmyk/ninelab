export default function Slide09TheAsk() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: "8vh", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>08 — The Ask</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh", bottom: "12vh", display: "flex", gap: "8vw", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "2vw", color: "#94A3B8", fontWeight: 500, marginBottom: "1.5vh", letterSpacing: "0.04em", textTransform: "uppercase" }}>Raising</div>
          <div style={{ fontSize: "9vw", fontWeight: 800, color: "#F97316", lineHeight: 1, letterSpacing: "-0.04em", marginBottom: "2vh" }}>
            Pre-Seed
          </div>
          <div style={{ fontSize: "2.5vw", color: "#F8FAFC", fontWeight: 600, marginBottom: "4vh" }}>
            [Your target amount here]
          </div>
          <div style={{ width: "6vw", height: "0.3vh", background: "#F97316", marginBottom: "4vh", opacity: 0.6 }} />
          <div style={{ fontSize: "2vw", color: "#94A3B8", fontWeight: 500, marginBottom: "2vh" }}>12-month goal with this raise</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
            <div style={{ fontSize: "1.85vw", color: "#F8FAFC", fontWeight: 500 }}>→ 10 college partnerships signed</div>
            <div style={{ fontSize: "1.85vw", color: "#F8FAFC", fontWeight: 500 }}>→ 50 paying recruiter accounts</div>
            <div style={{ fontSize: "1.85vw", color: "#F8FAFC", fontWeight: 500 }}>→ First rupee of recurring revenue</div>
          </div>
        </div>
        <div style={{ flex: "0 0 32vw", display: "flex", flexDirection: "column", gap: "2.5vh", paddingTop: "1vh" }}>
          <div style={{ fontSize: "1.8vw", color: "#94A3B8", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "0.5vh" }}>Use of Funds</div>
          <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.22)", borderRadius: "0.8vw", padding: "2.5vh 2.2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "1.85vw", color: "#F8FAFC", fontWeight: 500 }}>Sales & College Partnerships</div>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, color: "#F97316" }}>40%</div>
          </div>
          <div style={{ background: "rgba(79,70,229,0.07)", border: "1px solid rgba(79,70,229,0.22)", borderRadius: "0.8vw", padding: "2.5vh 2.2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "1.85vw", color: "#F8FAFC", fontWeight: 500 }}>Product & Engineering</div>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, color: "#818CF8" }}>35%</div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "0.8vw", padding: "2.5vh 2.2vw", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "1.85vw", color: "#F8FAFC", fontWeight: 500 }}>Operations & AI Infrastructure</div>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, color: "#34D399" }}>25%</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
