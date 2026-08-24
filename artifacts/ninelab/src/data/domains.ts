export interface SubDomain {
  id: string;
  name: string;
  skills: string[];
}

export interface Domain {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bg: string;
  subDomains: SubDomain[];
}

export const DOMAINS: Domain[] = [
  {
    id: "data",
    name: "Data & Analytics",
    emoji: "📊",
    color: "#3b82f6",
    bg: "#eff6ff",
    subDomains: [
      { id: "data-science", name: "Data Science", skills: ["Python", "SQL", "ML", "Statistics"] },
      { id: "data-engineering", name: "Data Engineering", skills: ["Spark", "Kafka", "Airflow", "SQL"] },
      { id: "bi", name: "Business Intelligence", skills: ["Tableau", "Power BI", "SQL", "Excel"] },
      { id: "analytics-eng", name: "Analytics Engineering", skills: ["dbt", "SQL", "Python", "Looker"] },
      { id: "data-viz", name: "Data Visualization", skills: ["D3.js", "Plotly", "Tableau", "Storytelling"] },
    ],
  },
  {
    id: "design",
    name: "UI/UX Design",
    emoji: "🎨",
    color: "#ec4899",
    bg: "#fdf2f8",
    subDomains: [
      { id: "product-design", name: "Product Design", skills: ["Figma", "User Research", "Prototyping"] },
      { id: "ux-research", name: "UX Research", skills: ["Usability Testing", "Surveys", "Analytics"] },
      { id: "visual-design", name: "Visual Design", skills: ["Figma", "Illustrator", "Branding"] },
      { id: "motion-design", name: "Motion Design", skills: ["After Effects", "Principle", "Lottie"] },
      { id: "design-systems", name: "Design Systems", skills: ["Tokens", "Storybook", "Figma Variables", "Accessibility"] },
    ],
  },
  {
    id: "webdev",
    name: "Web Development",
    emoji: "🌐",
    color: "#7c3aed",
    bg: "#f5f3ff",
    subDomains: [
      { id: "frontend", name: "Frontend", skills: ["React", "TypeScript", "Tailwind", "Next.js"] },
      { id: "backend", name: "Backend", skills: ["Node.js", "Python", "PostgreSQL", "REST APIs"] },
      { id: "fullstack", name: "Full Stack", skills: ["React", "Node.js", "MongoDB", "AWS"] },
      { id: "cms", name: "WordPress / CMS", skills: ["WordPress", "PHP", "WooCommerce", "SEO"] },
      { id: "web-perf", name: "Web Performance", skills: ["Lighthouse", "Core Web Vitals", "CDN", "Caching"] },
    ],
  },
  {
    id: "mobile",
    name: "Mobile Dev",
    emoji: "📱",
    color: "#06b6d4",
    bg: "#ecfeff",
    subDomains: [
      { id: "ios", name: "iOS (Swift)", skills: ["Swift", "SwiftUI", "Xcode", "CoreData"] },
      { id: "android", name: "Android (Kotlin)", skills: ["Kotlin", "Jetpack Compose", "Android Studio"] },
      { id: "rn", name: "React Native", skills: ["React Native", "Expo", "TypeScript", "Redux"] },
      { id: "flutter", name: "Flutter", skills: ["Dart", "Flutter", "Firebase", "Provider"] },
      { id: "mobile-arch", name: "Mobile Architecture", skills: ["MVVM", "Clean Arch", "Offline First", "CI/CD"] },
    ],
  },
  {
    id: "aiml",
    name: "AI / ML",
    emoji: "🤖",
    color: "#10b981",
    bg: "#ecfdf5",
    subDomains: [
      { id: "ml-eng", name: "ML Engineering", skills: ["Python", "TensorFlow", "PyTorch", "MLflow"] },
      { id: "nlp", name: "NLP", skills: ["Transformers", "LangChain", "spaCy", "BERT"] },
      { id: "cv", name: "Computer Vision", skills: ["OpenCV", "YOLO", "PyTorch", "Image Processing"] },
      { id: "mlops", name: "MLOps", skills: ["Docker", "Kubernetes", "Airflow", "Kubeflow"] },
      { id: "genai", name: "Generative AI / LLMs", skills: ["LangChain", "RAG", "Vector DBs", "Prompt Eng"] },
    ],
  },
  {
    id: "security",
    name: "Cybersecurity",
    emoji: "🔐",
    color: "#ef4444",
    bg: "#fef2f2",
    subDomains: [
      { id: "pentesting", name: "Penetration Testing", skills: ["Kali Linux", "Metasploit", "Burp Suite"] },
      { id: "security-analysis", name: "Security Analysis", skills: ["SIEM", "IDS/IPS", "Threat Intel"] },
      { id: "cloud-security", name: "Cloud Security", skills: ["AWS Security", "IAM", "Zero Trust"] },
      { id: "soc", name: "SOC Analyst", skills: ["Splunk", "Incident Response", "Malware Analysis"] },
      { id: "appsec", name: "Application Security", skills: ["OWASP Top 10", "SAST", "DAST", "Secure Code"] },
    ],
  },
  {
    id: "cloud",
    name: "Cloud & DevOps",
    emoji: "☁️",
    color: "#f97316",
    bg: "#fff7ed",
    subDomains: [
      { id: "aws", name: "AWS / Azure / GCP", skills: ["AWS", "Terraform", "CloudFormation", "IAM"] },
      { id: "k8s", name: "Kubernetes & Docker", skills: ["Docker", "Kubernetes", "Helm", "Istio"] },
      { id: "cicd", name: "CI/CD Pipelines", skills: ["Jenkins", "GitHub Actions", "GitLab CI", "ArgoCD"] },
      { id: "sre", name: "Site Reliability", skills: ["Prometheus", "Grafana", "On-call", "SLA/SLO"] },
      { id: "platform-eng", name: "Platform Engineering", skills: ["Backstage", "IDP", "GitOps", "Terraform"] },
    ],
  },
  {
    id: "blockchain",
    name: "Blockchain",
    emoji: "⛓️",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    subDomains: [
      { id: "smart-contracts", name: "Smart Contracts", skills: ["Solidity", "Hardhat", "Foundry", "EVM"] },
      { id: "defi", name: "DeFi Development", skills: ["Solidity", "DeFi Protocols", "Web3.js", "Ethers.js"] },
      { id: "web3-fe", name: "Web3 Frontend", skills: ["ethers.js", "wagmi", "RainbowKit", "Next.js"] },
      { id: "blockchain-sec", name: "Blockchain Security", skills: ["Audit", "Formal Verification", "Slither"] },
      { id: "nft-gaming", name: "NFT / On-chain Gaming", skills: ["ERC-721", "IPFS", "Unity Web3", "Solidity"] },
    ],
  },
  {
    id: "gamedev",
    name: "Game Dev",
    emoji: "🎮",
    color: "#f59e0b",
    bg: "#fffbeb",
    subDomains: [
      { id: "unity", name: "Unity Developer", skills: ["Unity", "C#", "Physics", "Shaders"] },
      { id: "unreal", name: "Unreal Engine", skills: ["Unreal", "C++", "Blueprints", "Niagara"] },
      { id: "game-design", name: "Game Designer", skills: ["Level Design", "Balancing", "Narrative", "Figma"] },
      { id: "game-backend", name: "Game Backend", skills: ["Node.js", "Photon", "Redis", "WebSockets"] },
      { id: "game-art", name: "Game Art / 3D", skills: ["Blender", "Substance", "Maya", "ZBrush"] },
    ],
  },
  {
    id: "embedded",
    name: "Embedded / IoT",
    emoji: "🔧",
    color: "#64748b",
    bg: "#f8fafc",
    subDomains: [
      { id: "iot", name: "IoT Developer", skills: ["Arduino", "Raspberry Pi", "MQTT", "C/C++"] },
      { id: "firmware", name: "Firmware Engineer", skills: ["C", "RTOS", "SPI/I2C", "ARM Cortex"] },
      { id: "hardware", name: "Hardware Interface", skills: ["PCB Design", "KiCad", "FPGA", "Verilog"] },
      { id: "automotive", name: "Automotive Systems", skills: ["CAN Bus", "AUTOSAR", "ADAS", "ISO 26262"] },
      { id: "edge-ai", name: "Edge AI / TinyML", skills: ["TensorFlow Lite", "Edge Impulse", "ESP32", "C++"] },
    ],
  },
  {
    id: "qa",
    name: "QA & Testing",
    emoji: "🧪",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    subDomains: [
      { id: "manual-qa", name: "Manual Testing", skills: ["Test Cases", "Bug Reporting", "Jira", "Agile"] },
      { id: "automation-qa", name: "Test Automation", skills: ["Selenium", "Cypress", "Playwright", "TestNG"] },
      { id: "perf-testing", name: "Performance Testing", skills: ["JMeter", "Locust", "k6", "Gatling"] },
      { id: "mobile-qa", name: "Mobile Testing", skills: ["Appium", "XCUITest", "Espresso", "BrowserStack"] },
      { id: "api-testing", name: "API Testing", skills: ["Postman", "RestAssured", "Karate", "Contract Tests"] },
    ],
  },
  {
    id: "product",
    name: "Product Mgmt",
    emoji: "📋",
    color: "#14b8a6",
    bg: "#f0fdfa",
    subDomains: [
      { id: "tech-pm", name: "Technical PM", skills: ["PRDs", "SQL", "APIs", "Agile"] },
      { id: "growth-pm", name: "Growth PM", skills: ["A/B Testing", "Analytics", "Funnels", "OKRs"] },
      { id: "product-analytics", name: "Product Analytics", skills: ["Mixpanel", "Amplitude", "SQL", "Python"] },
      { id: "agile", name: "Agile / Scrum", skills: ["Scrum", "Jira", "Kanban", "Retrospectives"] },
      { id: "ai-pm", name: "AI Product Manager", skills: ["LLM Eval", "Prompt Design", "Model Cards", "Ethics"] },
    ],
  },
  {
    id: "arvr",
    name: "AR / VR / XR",
    emoji: "🥽",
    color: "#a855f7",
    bg: "#faf5ff",
    subDomains: [
      { id: "ar-mobile", name: "Mobile AR", skills: ["ARKit", "ARCore", "Unity AR Foundation", "Swift"] },
      { id: "vr-unity", name: "VR with Unity", skills: ["Unity XR", "Oculus SDK", "OpenXR", "C#"] },
      { id: "vr-unreal", name: "VR with Unreal", skills: ["Unreal", "OpenXR", "Blueprints", "C++"] },
      { id: "webxr", name: "WebXR", skills: ["Three.js", "A-Frame", "WebXR API", "JavaScript"] },
      { id: "spatial", name: "Spatial Computing", skills: ["Vision Pro", "RealityKit", "USDZ", "Hand Tracking"] },
    ],
  },
  {
    id: "robotics",
    name: "Robotics",
    emoji: "🦾",
    color: "#dc2626",
    bg: "#fef2f2",
    subDomains: [
      { id: "ros", name: "ROS / ROS2", skills: ["ROS2", "Python", "C++", "Gazebo"] },
      { id: "robot-perception", name: "Perception", skills: ["LiDAR", "Sensor Fusion", "OpenCV", "PCL"] },
      { id: "robot-control", name: "Motion Control", skills: ["PID", "Kinematics", "MoveIt", "MATLAB"] },
      { id: "drones", name: "Drone Engineering", skills: ["PX4", "ArduPilot", "MAVLink", "Computer Vision"] },
      { id: "industrial-robots", name: "Industrial Robotics", skills: ["PLC", "SCADA", "RobotStudio", "Safety"] },
    ],
  },
  {
    id: "fintech",
    name: "Fintech / Quant",
    emoji: "💹",
    color: "#16a34a",
    bg: "#f0fdf4",
    subDomains: [
      { id: "quant-research", name: "Quant Research", skills: ["Python", "NumPy", "Pandas", "Statistics"] },
      { id: "algo-trading", name: "Algo Trading", skills: ["Python", "Backtrader", "Zerodha API", "Order Books"] },
      { id: "payments-eng", name: "Payments Engineering", skills: ["UPI", "Razorpay", "PCI-DSS", "Idempotency"] },
      { id: "risk-modeling", name: "Risk Modeling", skills: ["VaR", "Monte Carlo", "Python", "R"] },
      { id: "fintech-backend", name: "Fintech Backend", skills: ["Java", "Kafka", "Postgres", "Ledger Design"] },
    ],
  },
  {
    id: "networking",
    name: "Networking & Infra",
    emoji: "🛰️",
    color: "#0891b2",
    bg: "#ecfeff",
    subDomains: [
      { id: "network-eng", name: "Network Engineering", skills: ["Cisco", "BGP", "OSPF", "Wireshark"] },
      { id: "sdn-nfv", name: "SDN / NFV", skills: ["OpenFlow", "ONOS", "Mininet", "Python"] },
      { id: "5g", name: "5G / Telecom", skills: ["5G NR", "Open RAN", "C++", "Linux"] },
      { id: "cdn-edge", name: "CDN & Edge", skills: ["Cloudflare Workers", "Fastly", "Anycast", "QUIC"] },
      { id: "linux-admin", name: "Linux SysAdmin", skills: ["Bash", "systemd", "Ansible", "Networking"] },
    ],
  },
  {
    id: "systems",
    name: "Systems Programming",
    emoji: "⚙️",
    color: "#475569",
    bg: "#f1f5f9",
    subDomains: [
      { id: "rust", name: "Rust Engineering", skills: ["Rust", "Tokio", "WASM", "Memory Safety"] },
      { id: "go", name: "Go Backend", skills: ["Go", "gRPC", "Postgres", "Concurrency"] },
      { id: "cpp", name: "Modern C++", skills: ["C++20", "STL", "CMake", "Templates"] },
      { id: "compilers", name: "Compilers / LLVM", skills: ["LLVM", "Parsing", "Type Systems", "OCaml"] },
      { id: "os-dev", name: "OS / Kernel Dev", skills: ["C", "Linux Kernel", "Drivers", "Assembly"] },
    ],
  },
  {
    id: "biotech",
    name: "Bio / Health Tech",
    emoji: "🧬",
    color: "#84cc16",
    bg: "#f7fee7",
    subDomains: [
      { id: "bioinformatics", name: "Bioinformatics", skills: ["Python", "BioPython", "BLAST", "Genomics"] },
      { id: "medical-imaging", name: "Medical Imaging AI", skills: ["PyTorch", "MONAI", "DICOM", "Segmentation"] },
      { id: "ehr-eng", name: "EHR / Clinical Systems", skills: ["FHIR", "HL7", "HIPAA", "REST APIs"] },
      { id: "drug-discovery", name: "Drug Discovery ML", skills: ["RDKit", "AlphaFold", "PyTorch", "Chemistry"] },
      { id: "wearables", name: "Wearables / Health IoT", skills: ["BLE", "Sensor Fusion", "Swift", "Kotlin"] },
    ],
  },
  {
    id: "quantum",
    name: "Quantum Computing",
    emoji: "🧪",
    color: "#6366f1",
    bg: "#eef2ff",
    subDomains: [
      { id: "qiskit", name: "Qiskit Programming", skills: ["Python", "Qiskit", "Linear Algebra", "Quantum Gates"] },
      { id: "quantum-algo", name: "Quantum Algorithms", skills: ["Shor", "Grover", "QFT", "Complexity"] },
      { id: "quantum-ml", name: "Quantum ML", skills: ["PennyLane", "Variational Circuits", "Python", "PyTorch"] },
      { id: "quantum-crypto", name: "Quantum Cryptography", skills: ["BB84", "Post-Quantum", "Lattice", "Math"] },
      { id: "quantum-hw", name: "Quantum Hardware", skills: ["Superconducting", "Ion Traps", "Microwave", "Physics"] },
    ],
  },
  {
    id: "devrel",
    name: "DevRel / Tech Writing",
    emoji: "✍️",
    color: "#d946ef",
    bg: "#fdf4ff",
    subDomains: [
      { id: "tech-writer", name: "Technical Writer", skills: ["Markdown", "API Docs", "Diátaxis", "Git"] },
      { id: "developer-advocate", name: "Developer Advocate", skills: ["Public Speaking", "Demos", "OSS", "Twitter"] },
      { id: "api-docs", name: "API Documentation", skills: ["OpenAPI", "Swagger", "Redoc", "Postman"] },
      { id: "devrel-content", name: "DevRel Content", skills: ["YouTube", "Blogging", "Tutorials", "Video Editing"] },
      { id: "community-mgmt", name: "Community Management", skills: ["Discord", "Slack", "Events", "Moderation"] },
    ],
  },
];

export const ALL_SUBDOMAINS = DOMAINS.flatMap(domain =>
  domain.subDomains.map(sd => ({ ...sd, domain }))
);

/**
 * Where each onboarding goal-picker option maps in the domain/subdomain
 * taxonomy above. Shared by Onboarding (deep-linking a new student into their
 * first feed) and Opportunities (resolving Prepare/Practice context for the
 * profile-matched preview cards) — one mapping, so the two screens can't
 * silently drift onto different roles for the same targetRole value.
 */
export const ROLE_DESTINATIONS: Record<string, { domain: string; sub: string; label: string }> = {
  "SDE": { domain: "webdev", sub: "fullstack", label: "Full Stack" },
  "Data/ML": { domain: "data", sub: "data-science", label: "Data Science" },
  "App Dev": { domain: "mobile", sub: "rn", label: "React Native" },
  "Cybersecurity": { domain: "security", sub: "security-analysis", label: "Security Analysis" },
};
