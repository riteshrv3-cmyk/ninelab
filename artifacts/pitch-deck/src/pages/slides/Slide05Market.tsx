export default function Slide05Market() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: "#0D0F18", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "absolute", top: "8vh", left: "8vw", right: "8vw", height: "0.22vh", background: "rgba(249,115,22,0.45)" }} />
      <div style={{ position: "absolute", top: "7.2vh", right: "8vw", fontSize: "1.4vw", color: "#F97316", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>04 — Market</div>
      <div style={{ position: "absolute", left: "8vw", right: "8vw", top: "16vh", bottom: "12vh", display: "flex", alignItems: "center", gap: "8vw" }}>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: "1.6vw", color: "#94A3B8", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "1.5vh" }}>India Alone</div>
          <div style={{ fontSize: "11vw", fontWeight: 800, color: "#F97316", lineHeight: 1, letterSpacing: "-0.04em" }}>10K+</div>
          <div style={{ fontSize: "2.2vw", color: "#F8FAFC", fontWeight: 600, marginTop: "1.5vh", textWrap: "balance" }}>Engineering colleges in India</div>
          <div style={{ width: "6vw", height: "0.3vh", background: "#F97316", marginTop: "3vh", opacity: 0.6 }} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4vh" }}>
          <div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", fontWeight: 500, marginBottom: "0.8vh" }}>Annual engineering graduates</div>
            <div style={{ fontSize: "3vw", fontWeight: 800, color: "#F8FAFC" }}>1.5 Million</div>
          </div>
          <div style={{ height: "0.15vh", background: "rgba(148,163,184,0.12)" }} />
          <div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", fontWeight: 500, marginBottom: "0.8vh" }}>Adjacent expansion markets</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
              <div style={{ fontSize: "1.8vw", color: "#F8FAFC", fontWeight: 500 }}>Southeast Asia — Vietnam, Indonesia, Philippines</div>
              <div style={{ fontSize: "1.8vw", color: "#F8FAFC", fontWeight: 500 }}>Middle East — UAE, Saudi Arabia, Qatar</div>
              <div style={{ fontSize: "1.8vw", color: "#F8FAFC", fontWeight: 500 }}>Diaspora hiring — Indian talent placed globally</div>
            </div>
          </div>
          <div style={{ height: "0.15vh", background: "rgba(148,163,184,0.12)" }} />
          <div>
            <div style={{ fontSize: "1.6vw", color: "#94A3B8", fontWeight: 500, marginBottom: "0.8vh" }}>Adjacent revenue layers</div>
            <div style={{ fontSize: "1.8vw", color: "#818CF8", fontWeight: 500 }}>Upskilling — Corporate L&D — Background Verification — Placement Guarantee</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "5vh", left: "8vw", fontSize: "1.5vw", color: "#3D4255", fontWeight: 600 }}>ninelab</div>
    </div>
  );
}
