export default function Slide04Product() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: "8vh", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>03 — Product</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh" }}>
        <div style={{ fontSize: "4.2vw", fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, marginBottom: "6vh", letterSpacing: "-0.02em" }}>
          Four Portals. One Data Layer.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3vw 4vw" }}>
          <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "1vw", padding: "3vh 2.5vw" }}>
            <div style={{ fontSize: "1.6vw", fontWeight: 700, color: "#F97316", marginBottom: "1.2vh", letterSpacing: "0.04em", textTransform: "uppercase" }}>Student App</div>
            <div style={{ fontSize: "1.75vw", color: "#F8FAFC", fontWeight: 500, marginBottom: "1vh" }}>AI Career Companion</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.5 }}>Mock interviews, skill tests, 48-domain courses, leaderboard, resume builder, recruiter inbox.</div>
          </div>
          <div style={{ background: "rgba(79,70,229,0.07)", border: "1px solid rgba(79,70,229,0.25)", borderRadius: "1vw", padding: "3vh 2.5vw" }}>
            <div style={{ fontSize: "1.6vw", fontWeight: 700, color: "#818CF8", marginBottom: "1.2vh", letterSpacing: "0.04em", textTransform: "uppercase" }}>Recruiter Portal</div>
            <div style={{ fontSize: "1.75vw", color: "#F8FAFC", fontWeight: 500, marginBottom: "1vh" }}>AI Talent Marketplace</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.5 }}>Browse verified candidates, filter by score or skill, shortlist, post jobs, get AI-matched applicants.</div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "1vw", padding: "3vh 2.5vw" }}>
            <div style={{ fontSize: "1.6vw", fontWeight: 700, color: "#34D399", marginBottom: "1.2vh", letterSpacing: "0.04em", textTransform: "uppercase" }}>TPO Portal</div>
            <div style={{ fontSize: "1.75vw", color: "#F8FAFC", fontWeight: 500, marginBottom: "1vh" }}>College Placement Hub</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.5 }}>Announce drives, track student readiness, invite recruiters, insights dashboard, mentor hub.</div>
          </div>
          <div style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "1vw", padding: "3vh 2.5vw" }}>
            <div style={{ fontSize: "1.6vw", fontWeight: 700, color: "#94A3B8", marginBottom: "1.2vh", letterSpacing: "0.04em", textTransform: "uppercase" }}>Admin Panel</div>
            <div style={{ fontSize: "1.75vw", color: "#F8FAFC", fontWeight: 500, marginBottom: "1vh" }}>Platform Command Center</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.5 }}>Monitor all students, colleges, recruiters, jobs and invites across the entire platform.</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
