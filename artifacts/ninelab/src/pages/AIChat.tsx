import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Send, RefreshCw, CheckCircle, Zap, Mic, Volume2 } from "lucide-react";
import { Toko } from "@/components/ninelab/Toko";
import { Confetti } from "@/components/ninelab/Confetti";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api/authFetch";

const UPDATE_MARKER = "___PROFILE_UPDATE___";
const MAX_HISTORY = 30;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  streaming?: boolean;
  profileUpdated?: boolean;
  reaction?: string;
  suggestions?: string[];
  ts: number;
}

type TokoMood = "normal" | "thinking" | "happy" | "error";

// ── Speech Recognition types ───────────────────────────────────────────────────

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
}

interface ISpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: { length: number; [index: number]: ISpeechRecognitionResult };
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ── Contextual suggestion chips ────────────────────────────────────────────────

const GLOBAL_CHIPS = [
  { emoji: "🔥", label: "Rate my profile" },
  { emoji: "✍️", label: "Write my bio" },
  { emoji: "🚀", label: "Add a project" },
  { emoji: "🗺️", label: "Placement roadmap" },
  { emoji: "💼", label: "FAANG prep tips" },
  { emoji: "📍", label: "Set my preferred cities" },
  { emoji: "🏆", label: "How to get into a unicorn?" },
  { emoji: "📈", label: "Boost my profile score" },
  { emoji: "🎯", label: "What to focus on this month?" },
  { emoji: "🤝", label: "I got a new certification" },
];

function getSuggestions(text: string): { emoji: string; label: string }[] {
  const t = text.toLowerCase();
  if (t.includes("project")) return [{ emoji: "🚀", label: "Add another project" }, { emoji: "🔗", label: "Add GitHub link" }];
  if (t.includes("bio")) return [{ emoji: "✅", label: "Looks good, save it" }, { emoji: "✏️", label: "Make it shorter" }];
  if (t.includes("resume")) return [{ emoji: "📄", label: "Generate a resume" }, { emoji: "🎨", label: "Try Tech template" }];
  if (t.includes("interview") || t.includes("dsa")) return [{ emoji: "🧠", label: "Start mock interview" }, { emoji: "💡", label: "DSA study plan" }];
  if (t.includes("score") || t.includes("profile")) return [{ emoji: "📈", label: "How to score higher?" }, { emoji: "🔍", label: "What's missing?" }];
  if (t.includes("cert") || t.includes("aws") || t.includes("course")) return [{ emoji: "🏅", label: "Add certification" }, { emoji: "📚", label: "Which cert next?" }];
  if (t.includes("salary") || t.includes("lpa") || t.includes("package")) return [{ emoji: "💰", label: "Set my salary expectation" }, { emoji: "📊", label: "Market rates for my skills" }];
  if (t.includes("location") || t.includes("city") || t.includes("bangalore") || t.includes("mumbai")) return [{ emoji: "📍", label: "Update my locations" }, { emoji: "🌐", label: "Set remote preference" }];
  const shuffled = [...GLOBAL_CHIPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

const REACTIONS = ["❤️", "🔥", "😂", "👏", "💯"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Toko avatar ───────────────────────────────────────────────────────────────

function TokoAvatar() {
  return (
    <div
      aria-label="Toko"
      className="w-8 h-8 rounded-full bg-toko-soft flex items-center justify-center shrink-0"
    >
      <Toko size={22} />
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────────────────

function DateSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-line" />
      <span className="text-[10px] font-semibold text-ink-muted px-2">{label}</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

// ── AI Bubble ─────────────────────────────────────────────────────────────────

function AIBubble({
  msg, onReact, onSuggestion, streaming,
}: {
  msg: Message;
  onReact: (id: string, emoji: string) => void;
  onSuggestion: (text: string) => void;
  streaming: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const displayText = msg.text.includes(UPDATE_MARKER)
    ? msg.text.slice(0, msg.text.indexOf(UPDATE_MARKER)).trim()
    : msg.text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex items-end gap-2 max-w-[86%]"
    >
      <TokoAvatar />

      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Bubble */}
        <div className="relative group">
          <div className="bg-brand text-white rounded-2xl rounded-bl-md px-4 py-3">
            {msg.streaming && !displayText ? (
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-[12px] text-white/70 italic">toko is on it</span>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-white/70"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-white leading-relaxed whitespace-pre-wrap break-words">
                {displayText}
                {msg.streaming && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="inline-block w-0.5 h-3.5 bg-white ml-0.5 rounded-sm align-middle"
                  />
                )}
              </p>
            )}
          </div>

          {/* Reaction trigger */}
          {!msg.streaming && (
            <button
              onClick={() => setShowPicker((p) => !p)}
              className="absolute -bottom-2 -right-1 w-5 h-5 rounded-full bg-paper border border-line text-ink flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              {msg.reaction ?? "+"}
            </button>
          )}
        </div>

        {/* Reaction picker */}
        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex gap-1 bg-paper rounded-2xl px-2 py-1.5 border border-line self-start"
            >
              {REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => { onReact(msg.id, emoji); setShowPicker(false); }}
                  className="text-[18px] hover:scale-125 active:scale-95 transition-transform"
                >{emoji}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {msg.reaction && !showPicker && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="self-start text-[16px] cursor-pointer" onClick={() => setShowPicker(true)}
          >{msg.reaction}</motion.span>
        )}

        {msg.profileUpdated && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-paper border border-line rounded-xl self-start"
          >
            <CheckCircle className="w-3 h-3 text-done" />
            <span className="text-[10px] font-black text-ink">Profile updated! purrfect 😎</span>
          </motion.div>
        )}

        {!msg.streaming && msg.suggestions && msg.suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="flex flex-wrap gap-1.5"
          >
            {msg.suggestions.map((s) => (
              <button key={s} onClick={() => !streaming && onSuggestion(s)} disabled={streaming}
                className="text-[12px] font-semibold bg-brand-soft text-brand px-3 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-40 whitespace-nowrap"
              >{s}</button>
            ))}
          </motion.div>
        )}

        <span className="text-[10px] text-ink-muted ml-0.5">{fmtTime(msg.ts)}</span>
      </div>
    </motion.div>
  );
}

// ── User Bubble ───────────────────────────────────────────────────────────────

function UserBubble({ msg }: { msg: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex items-end gap-2 max-w-[82%] ml-auto flex-row-reverse"
    >
      <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-black shrink-0 mb-1">
        me
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="bg-paper shadow-soft rounded-2xl rounded-br-md px-4 py-3">
          <p className="text-[13px] text-ink leading-relaxed">{msg.text}</p>
        </div>
        <span className="text-[10px] text-ink-muted mr-0.5">{fmtTime(msg.ts)}</span>
      </div>
    </motion.div>
  );
}

// ── Resume Chat Banner ────────────────────────────────────────────────────────

function ResumeBanner({ onContinue, onFresh }: { onContinue: () => void; onFresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-4 mt-3 bg-paper shadow-soft rounded-2xl px-4 py-3 flex items-center gap-3"
    >
      <TokoAvatar />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-black text-ink">Continue where we left off? 🐾</p>
        <p className="text-[10px] text-ink-muted">toko remembers your last chat</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onContinue}
          className="text-[11px] font-bold bg-brand text-white px-3 py-1.5 rounded-full active:scale-95 transition-transform"
        >Yes!</button>
        <button onClick={onFresh}
          className="text-[11px] font-bold border border-line text-brand px-3 py-1.5 rounded-full active:scale-95 transition-transform"
        >Fresh start</button>
      </div>
    </motion.div>
  );
}

// ── Welcome chips ─────────────────────────────────────────────────────────────

function WelcomeChips({ onSelect, disabled }: { onSelect: (s: string) => void; disabled: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="flex flex-wrap gap-2 pt-1 pb-2"
    >
      {GLOBAL_CHIPS.slice(0, 6).map(({ emoji, label }) => (
        <button key={label} onClick={() => onSelect(label)} disabled={disabled}
          className="flex items-center gap-1.5 text-[12px] font-semibold bg-brand-soft text-brand px-3 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-40"
        >
          <span className="text-base leading-none">{emoji}</span>{label}
        </button>
      ))}
      <button
        onClick={() => { const p = GLOBAL_CHIPS[Math.floor(Math.random() * GLOBAL_CHIPS.length)]; onSelect(p.label); }}
        disabled={disabled}
        className="flex items-center gap-1.5 text-[12px] font-semibold bg-brand-soft text-brand px-3 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-40"
      >
        <Zap className="w-3.5 h-3.5 text-brand" />Surprise me!
      </button>
    </motion.div>
  );
}

// ── Listening wave animation ──────────────────────────────────────────────────

function ListeningWave() {
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          animate={{ scaleY: [0.4, 1.4, 0.4] }}
          transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
          className="w-[3px] rounded-full bg-paper origin-center"
          style={{ height: 16 }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIChat() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("there");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [tokoMood, setTokoMood] = useState<TokoMood>("normal");
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingHistory, setPendingHistory] = useState<Message[] | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const storageKey = studentId ? `kt-chat-${studentId}` : null;

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = localStorage.getItem("studentId");
    const name = localStorage.getItem("studentName") || "there";
    if (!id) { setLocation("/"); return; }
    setStudentId(id);
    const first = name.split(" ")[0];
    setStudentName(first);
    setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));

    const key = `kt-chat-${id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (parsed.length > 1) {
          setPendingHistory(parsed);
          setShowResumeBanner(true);
          return; // wait for user to choose
        }
      } catch { /* ignore */ }
    }

    startFreshChat(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startFreshChat(name: string) {
    const welcome: Message = {
      id: "welcome",
      role: "ai",
      ts: Date.now(),
      // Toko's voice: an agent reporting work he actually does, not a mascot
      // making species puns. Lowercase, first person, short lines.
      text: `hey ${name}. i'm toko.\n\ni read the job boards every morning, i know what's on your profile, and i'll tell you straight when something is a stretch.\n\ni can fix your bio, add a project, or work out what's missing for a role you want.\n\nwhat are we doing today?`,
      suggestions: [],
    };
    setMessages([welcome]);
  }

  // ── Persist messages to localStorage ─────────────────────────────────────

  useEffect(() => {
    if (!storageKey || messages.length === 0) return;
    const toSave = messages.filter((m) => !m.streaming).slice(-MAX_HISTORY);
    localStorage.setItem(storageKey, JSON.stringify(toSave));
  }, [messages, storageKey]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Reactions ─────────────────────────────────────────────────────────────

  const handleReact = useCallback((id: string, emoji: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m));
  }, []);

  // ── Voice input ───────────────────────────────────────────────────────────

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => setListening(true);
    rec.onresult = (e: ISpeechRecognitionEvent) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (final) { setInput((prev) => (prev + " " + final).trim()); setInterimText(""); }
      else setInterimText(interim);
    };
    rec.onend = () => { setListening(false); setInterimText(""); };
    rec.onerror = () => { setListening(false); setInterimText(""); };

    rec.start();
    recognitionRef.current = rec;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming || !studentId) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: text.trim(), ts: Date.now() };
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiId, role: "ai", text: "", streaming: true, ts: Date.now() };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setStreaming(true);
    setTokoMood("thinking");

    try {
      const res = await apiFetch(`/api/students/${studentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!res.ok || !res.body) throw new Error("Network error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let profileUpdated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; profileUpdated?: boolean; error?: boolean };
            if (data.content) {
              accumulated += data.content;
              setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, text: accumulated } : m));
            }
            if (data.done) {
              profileUpdated = data.profileUpdated ?? false;
              if (data.error) throw new Error("AI error");
            }
          } catch (e) { if ((e as Error).message === "AI error") throw e; }
        }
      }

      const displayText = accumulated.includes(UPDATE_MARKER)
        ? accumulated.slice(0, accumulated.indexOf(UPDATE_MARKER)).trim()
        : accumulated;
      const suggestions = getSuggestions(displayText).map((s) => `${s.emoji} ${s.label}`);

      setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, streaming: false, profileUpdated, suggestions } : m));
      setTokoMood(profileUpdated ? "happy" : "normal");

      if (profileUpdated) {
        setShowConfetti(true);
        setTimeout(() => { setShowConfetti(false); setTokoMood("normal"); }, 2500);
        toast({ title: "Profile updated!", description: "saved to your profile" });
      }
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === aiId ? { ...m, text: "Ugh, something went wrong 😿 Try again in a sec?", streaming: false, suggestions: [] } : m
      ));
      setTokoMood("error");
      setTimeout(() => setTokoMood("normal"), 2000);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const resetChat = () => {
    if (storageKey) localStorage.removeItem(storageKey);
    setShowResumeBanner(false);
    startFreshChat(studentName);
  };

  // ── Build message list with date separators ───────────────────────────────

  type ListItem = { type: "msg"; msg: Message } | { type: "sep"; label: string };
  const listItems: ListItem[] = [];
  let lastDay = "";
  for (const msg of messages) {
    const day = new Date(msg.ts).toDateString();
    if (day !== lastDay) { listItems.push({ type: "sep", label: dayLabel(msg.ts) }); lastDay = day; }
    listItems.push({ type: "msg", msg });
  }

  const showWelcomeChips = messages.length === 1 && messages[0].id === "welcome";

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] bg-canvas">

      {/* Confetti */}
      <AnimatePresence>{showConfetti && <Confetti key="confetti" />}</AnimatePresence>

      {/* ── Header ── */}
      <div className="bg-brand">
        <div className="px-4 py-2.5 flex items-center gap-3 lg:max-w-2xl lg:mx-auto">
          <div
            aria-label="Toko"
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0"
          >
            <Toko size={22} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-display font-black text-white text-sm">Toko</p>
              <span className="text-[10px] font-bold text-white/80 border border-white/30 px-1.5 py-0.5 rounded-full">AI</span>
            </div>
            <p className="text-[10px] text-white/70 font-semibold">
              {tokoMood === "thinking" ? "reading that…" : "online · knows your profile"}
            </p>
          </div>

          <button onClick={resetChat}
            className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center active:scale-90 transition-transform"
            title="New chat"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Resume chat banner ── */}
      <AnimatePresence>
        {showResumeBanner && (
          <ResumeBanner
            onContinue={() => {
              if (pendingHistory) setMessages(pendingHistory);
              setShowResumeBanner(false);
              setPendingHistory(null);
            }}
            onFresh={() => {
              setShowResumeBanner(false);
              setPendingHistory(null);
              startFreshChat(studentName);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 lg:max-w-2xl lg:mx-auto">
        <AnimatePresence initial={false}>
          {listItems.map((item, idx) =>
            item.type === "sep" ? (
              <DateSep key={`sep-${idx}`} label={item.label} />
            ) : item.msg.role === "ai" ? (
              <AIBubble
                key={item.msg.id}
                msg={item.msg}
                onReact={handleReact}
                onSuggestion={sendMessage}
                streaming={streaming}
              />
            ) : (
              <UserBubble key={item.msg.id} msg={item.msg} />
            )
          )}
        </AnimatePresence>

        {showWelcomeChips && !streaming && (
          <WelcomeChips onSelect={sendMessage} disabled={streaming} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="bg-paper border-t border-line">
        <div className="px-4 pt-3 pb-4 lg:max-w-2xl lg:mx-auto">
          {/* Interim voice text preview */}
          <AnimatePresence>
            {interimText && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] text-ink-muted italic mb-1.5 px-1"
              >
                "{interimText}"
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2">
            {/* Voice button */}
            {voiceSupported && (
              <button
                onPointerDown={startListening}
                onPointerUp={stopListening}
                onPointerLeave={stopListening}
                disabled={streaming}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-40 ${
                  listening
                    ? "bg-brand text-white"
                    : "border border-line text-ink-muted"
                }`}
                title="Hold to speak"
              >
                {listening ? (
                  <ListeningWave />
                ) : (
                  <Mic className="w-4 h-4 text-ink-muted" />
                )}
              </button>
            )}

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={listening && interimText ? interimText : input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder={listening ? "Listening... 🎤" : "ask toko anything…"}
                rows={1}
                disabled={streaming}
                className={`w-full resize-none text-[13px] text-ink placeholder:text-ink-muted bg-paper rounded-2xl px-4 py-2.5 outline-none border transition-all max-h-[96px] disabled:opacity-60 ${
                  listening ? "border-brand" : "border-line focus:border-brand"
                }`}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center disabled:opacity-35 shrink-0 transition-opacity"
            >
              {streaming ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </motion.button>
          </div>

          <p className="text-[9.5px] text-ink-muted text-center mt-2 font-medium flex items-center justify-center gap-1">
            {voiceSupported && <><Volume2 className="w-3 h-3" /> Hold mic to speak •</>}
            toko can update your profile · add projects · career advice
          </p>
        </div>
      </div>
    </div>
  );
}
