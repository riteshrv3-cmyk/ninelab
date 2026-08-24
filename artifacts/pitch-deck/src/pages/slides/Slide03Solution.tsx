export default function Slide03Solution() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: "8vh", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>02 — Solution</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh" }}>
        <div style={{ fontSize: "4.2vw", fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, marginBottom: "2vh", letterSpacing: "-0.02em" }}>
          One Platform. Three Customers.
        </div>
        <div style={{ fontSize: "2vw", color: "#94A3B8", marginBottom: "6vh", fontWeight: 400 }}>
          ninelab serves each side of the hiring equation simultaneously.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "3.5vh" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2.5vw" }}>
            <div style={{ minWidth: "4vw", height: "4vw", borderRadius: "0.6vw", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#F97316" }}>S</div>
            </div>
            <div>
              <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.8vh" }}>Students</div>
              <div style={{ fontSize: "1.75vw", color: "#94A3B8", fontWeight: 400, lineHeight: 1.5 }}>AI mock interviews, MCQ tests, 48-domain course library, profile builder with verified GitHub and LinkedIn analysis. Free to use.</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2.5vw" }}>
            <div style={{ minWidth: "4vw", height: "4vw", borderRadius: "0.6vw", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#F97316" }}>C</div>
            </div>
            <div>
              <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.8vh" }}>Colleges</div>
              <div style={{ fontSize: "1.75vw", color: "#94A3B8", fontWeight: 400, lineHeight: 1.5 }}>Placement dashboard replacing Excel. Announce drives, track student readiness, invite recruiters, view real-time analytics.</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "2.5vw" }}>
            <div style={{ minWidth: "4vw", height: "4vw", borderRadius: "0.6vw", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "1.8vw", fontWeight: 800, color: "#F97316" }}>R</div>
            </div>
            <div>
              <div style={{ fontSize: "2vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.8vh" }}>Recruiters</div>
              <div style={{ fontSize: "1.75vw", color: "#94A3B8", fontWeight: 400, lineHeight: 1.5 }}>Verified talent pool with AI shortlisting. Filter by skill, score, college, work mode. Replace 500-resume screening with a ranked list.</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
