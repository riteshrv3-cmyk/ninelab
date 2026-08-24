export default function Slide02Problem() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)", top: "8vh" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>01 — Problem</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh" }}>
        <div style={{ fontSize: "4.5vw", fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, marginBottom: "7vh", letterSpacing: "-0.02em", textWrap: "balance" }}>
          A Broken Pipeline
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4vw" }}>
          <div>
            <div style={{ fontSize: "5.5vw", fontWeight: 800, color: "#F97316", lineHeight: 1, marginBottom: "2vh" }}>1.5M</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "1.5vh" }}>Engineers Graduated Annually</div>
            <div style={{ fontSize: "1.7vw", color: "#94A3B8", lineHeight: 1.55, fontWeight: 400 }}>Most cannot clear a basic technical interview. Colleges track attendance, not readiness.</div>
          </div>
          <div>
            <div style={{ fontSize: "5.5vw", fontWeight: 800, color: "#F97316", lineHeight: 1, marginBottom: "2vh" }}>10K+</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "1.5vh" }}>Colleges Using Spreadsheets</div>
            <div style={{ fontSize: "1.7vw", color: "#94A3B8", lineHeight: 1.55, fontWeight: 400 }}>Placement officers manage drives manually. No real-time student data. No analytics. No pipeline.</div>
          </div>
          <div>
            <div style={{ fontSize: "5.5vw", fontWeight: 800, color: "#F97316", lineHeight: 1, marginBottom: "2vh" }}>500+</div>
            <div style={{ fontSize: "1.8vw", fontWeight: 700, color: "#F8FAFC", marginBottom: "1.5vh" }}>Resumes Per Hire</div>
            <div style={{ fontSize: "1.7vw", color: "#94A3B8", lineHeight: 1.55, fontWeight: 400 }}>Recruiters get unverified resumes with no signal. Sorting is slow, expensive, and unreliable.</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
