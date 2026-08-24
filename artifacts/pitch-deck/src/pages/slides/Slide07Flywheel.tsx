export default function Slide07Flywheel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: "8vh", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>06 — Go-To-Market</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh" }}>
        <div style={{ fontSize: "4.2vw", fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, marginBottom: "1.5vh", letterSpacing: "-0.02em" }}>
          The College-First Flywheel
        </div>
        <div style={{ fontSize: "1.9vw", color: "#94A3B8", marginBottom: "6vh" }}>
          Start with Tier-2 and Tier-3 colleges — underserved, high volume, zero digital tools today.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
          <div style={{ flex: 1, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.28)", borderRadius: "1vw", padding: "4vh 2.5vw" }}>
            <div style={{ fontSize: "3.5vw", fontWeight: 800, color: "#F97316", lineHeight: 1, marginBottom: "2vh" }}>01</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "1.2vh" }}>Sign Colleges</div>
            <div style={{ fontSize: "1.7vw", color: "#94A3B8", lineHeight: 1.5 }}>Partner with TPOs. Give them a free placement dashboard. Students join automatically.</div>
          </div>
          <div style={{ flex: "0 0 4vw", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "2.5vw", color: "#F97316", fontWeight: 700 }}>→</div>
          </div>
          <div style={{ flex: 1, background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.25)", borderRadius: "1vw", padding: "4vh 2.5vw" }}>
            <div style={{ fontSize: "3.5vw", fontWeight: 800, color: "#818CF8", lineHeight: 1, marginBottom: "2vh" }}>02</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "1.2vh" }}>Students Build Profiles</div>
            <div style={{ fontSize: "1.7vw", color: "#94A3B8", lineHeight: 1.5 }}>Students practice, take tests, build verified profiles. Data quality grows over time.</div>
          </div>
          <div style={{ flex: "0 0 4vw", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "2.5vw", color: "#F97316", fontWeight: 700 }}>→</div>
          </div>
          <div style={{ flex: 1, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: "1vw", padding: "4vh 2.5vw" }}>
            <div style={{ fontSize: "3.5vw", fontWeight: 800, color: "#34D399", lineHeight: 1, marginBottom: "2vh" }}>03</div>
            <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "1.2vh" }}>Recruiters Pay</div>
            <div style={{ fontSize: "1.7vw", color: "#94A3B8", lineHeight: 1.5 }}>Verified talent pool attracts recruiters. Recruiter demand pulls in more colleges. Loop tightens.</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
