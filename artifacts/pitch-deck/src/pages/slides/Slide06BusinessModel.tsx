export default function Slide06BusinessModel() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: "8vh", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>05 — Business Model</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh" }}>
        <div style={{ fontSize: "4vw", fontWeight: 800, color: "#F8FAFC", lineHeight: 1.1, marginBottom: "1.5vh", letterSpacing: "-0.02em" }}>
          Recruiters Pay. Colleges Pay.
        </div>
        <div style={{ fontSize: "2vw", color: "#94A3B8", marginBottom: "5vh" }}>
          Students are free — they generate the verified data that everyone else pays for.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "3vw" }}>
          <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.28)", borderRadius: "1vw", padding: "3.5vh 2.2vw" }}>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#F97316", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1.5vh" }}>Stream 1</div>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, color: "#F8FAFC", marginBottom: "1.2vh" }}>Recruiter SaaS</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.55, marginBottom: "2.5vh" }}>Monthly / annual subscription for access to the verified talent pool, shortlisting, job posting, and AI candidate matching.</div>
            <div style={{ height: "0.15vh", background: "rgba(249,115,22,0.2)", marginBottom: "2vh" }} />
            <div style={{ fontSize: "1.55vw", color: "#F8FAFC", fontWeight: 500 }}>Pricing: per recruiter seat</div>
            <div style={{ fontSize: "1.55vw", color: "#F8FAFC", fontWeight: 500 }}>Target: HR teams, startup founders, campus recruiters</div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: "1vw", padding: "3.5vh 2.2vw" }}>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#34D399", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1.5vh" }}>Stream 2</div>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, color: "#F8FAFC", marginBottom: "1.2vh" }}>College SaaS</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.55, marginBottom: "2.5vh" }}>Annual institutional license for the TPO dashboard — drive management, student analytics, recruiter invite tools, placement reports.</div>
            <div style={{ height: "0.15vh", background: "rgba(16,185,129,0.2)", marginBottom: "2vh" }} />
            <div style={{ fontSize: "1.55vw", color: "#F8FAFC", fontWeight: 500 }}>Pricing: per college per year</div>
            <div style={{ fontSize: "1.55vw", color: "#F8FAFC", fontWeight: 500 }}>Target: TPOs, placement cells, HoDs</div>
          </div>
          <div style={{ background: "rgba(79,70,229,0.07)", border: "1px solid rgba(79,70,229,0.22)", borderRadius: "1vw", padding: "3.5vh 2.2vw" }}>
            <div style={{ fontSize: "1.5vw", fontWeight: 700, color: "#818CF8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1.5vh" }}>Stream 3 — Future</div>
            <div style={{ fontSize: "2.2vw", fontWeight: 800, color: "#F8FAFC", marginBottom: "1.2vh" }}>Pro Tier + API</div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", lineHeight: 1.55, marginBottom: "2.5vh" }}>Student Pro subscription for resume verification badge, priority recruiter visibility, and advanced course access. API for enterprise ATS integrations.</div>
            <div style={{ height: "0.15vh", background: "rgba(79,70,229,0.2)", marginBottom: "2vh" }} />
            <div style={{ fontSize: "1.55vw", color: "#F8FAFC", fontWeight: 500 }}>Pricing: per student per month</div>
            <div style={{ fontSize: "1.55vw", color: "#F8FAFC", fontWeight: 500 }}>Target: final-year students, enterprise HR</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
