import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, RefreshCw, Share2, Clock, ChevronDown, ChevronUp, Mic, Volume2, VolumeX, Camera, CameraOff } from "lucide-react";
import { useGetNextInterviewQuestion, useEvaluateInterview, useGetInterviewSession, useSubmitInterviewFeedback } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/authFetch";

type Message = { id: string; sender: "bot" | "user"; text: string };

type EvalData = {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  overallRating: string;
  weakPoint: string;
  strongPoint: string;
  questionFeedback: Array<{ question: string; studentAnswer: string; betterAnswer: string; score: number }>;
};

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function stripMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1");
}

// `color` is kept in the prop signature for compatibility but is ignored —
// score colour is always brand, never a threshold-based colour.
function ScoreRing({ score, max, label }: { score: number; max: number; label: string; color?: string }) {
  const pct = Math.round((score / max) * 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#ecedf3" strokeWidth="6" />
          <motion.circle cx="32" cy="32" r={r} fill="none" stroke="#4a55c7" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (pct / 100) * circ }} transition={{ duration: 1, delay: 0.3 }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-black text-brand">{score}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

const CONFIDENCE_EMOJIS = [
  { emoji: "😰", label: "Very nervous" },
  { emoji: "😟", label: "Nervous" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "🙂", label: "Confident" },
  { emoji: "😎", label: "Very confident" },
];

export default function Interview() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const sessionId = parseInt(id || "0", 10);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [expandedFeedback, setExpandedFeedback] = useState<number | null>(null);
  const [addedToTomorrow, setAddedToTomorrow] = useState(false);
  const maxQuestions = 5;

  // Confidence micro-survey
  const [confidenceSent, setConfidenceSent] = useState(false);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [showRealInterviewQ, setShowRealInterviewQ] = useState(false);
  const submitFeedback = useSubmitInterviewFeedback();

  // Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionTimesRef = useRef<number[]>([]);

  // Voice mode
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceModeRef = useRef(false);

  // Camera mode (live self-view, no recording)
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isTypingRef = useRef(false);
  const timerSecondsRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // OpenAI voice: TTS playback + MediaRecorder->Whisper transcription
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session, isLoading: sessionLoading } = useGetInterviewSession(sessionId, {
    query: { enabled: !!sessionId } as any
  });
  const getNextQuestion = useGetNextInterviewQuestion();
  const evaluateInterview = useEvaluateInterview();

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { isTypingRef.current = isTyping; }, [isTyping]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);

  useEffect(() => {
    // Default new users into the audio+video experience; respect an explicit "false"
    // for anyone who has previously turned a mode off.
    const vmStored = localStorage.getItem("voiceMode");
    const vm = vmStored === null ? true : vmStored === "true";
    setVoiceMode(vm);
    voiceModeRef.current = vm;
    const cmStored = localStorage.getItem("cameraMode");
    const cm = cmStored === null ? true : cmStored === "true";
    setCameraMode(cm);
  }, []);

  // Camera lifecycle: turn on/off based on cameraMode + interview not finished
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!cameraMode || isFinished) return;
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera not supported on this device");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        setCameraError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        const msg = err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission denied"
          : "Couldn't start camera";
        setCameraError(msg);
      }
    }
    function stop() {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    if (cameraMode && !isFinished) start();
    else stop();
    return () => { cancelled = true; stop(); };
  }, [cameraMode, isFinished]);

  const toggleCameraMode = () => {
    const next = !cameraMode;
    setCameraMode(next);
    localStorage.setItem("cameraMode", next ? "true" : "false");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping && messages.length > 0 && !isFinished) {
      const last = messages[messages.length - 1];
      if (last?.sender === "bot") {
        setTimerSeconds(0);
        setTimerRunning(true);
      }
    }
  }, [isTyping, messages, isFinished]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  useEffect(() => {
    if (!voiceMode || isTyping || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.sender === "bot") speakText(last.text);
  }, [messages, isTyping, voiceMode]);

  // Fallback: robotic browser voice if OpenAI TTS is unavailable.
  const speakTextFallback = useCallback((clean: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const pick = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
        || voices.find(v => v.lang === "en-IN")
        || voices.find(v => v.lang.startsWith("en-GB"))
        || voices.find(v => v.lang.startsWith("en-"));
      if (pick) utterance.voice = pick;
    };
    setVoice();
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Primary: natural OpenAI TTS voice for the interviewer.
  const speakText = useCallback(async (text: string) => {
    if (!voiceModeRef.current) return;
    const clean = stripMarkdown(text);
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
    window.speechSynthesis?.cancel();
    try {
      const res = await fetch("/api/interview/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok) throw new Error("tts failed");
      const blob = await res.blob();
      if (!voiceModeRef.current) return; // user turned voice off while fetching
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); ttsAudioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); ttsAudioRef.current = null; };
      await audio.play();
    } catch {
      speakTextFallback(clean); // graceful fallback to browser voice
    }
  }, [speakTextFallback]);

  const stopSpeaking = () => {
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    if (session && messages.length === 0 && !session.completed) {
      if (session.currentQuestion) {
        setMessages([{ id: Date.now().toString(), sender: "bot", text: session.currentQuestion }]);
        setQuestionCount(session.questionNumber);
      } else {
        fetchNextQuestion("Start interview");
      }
    } else if (session?.completed) {
      if ((session as any).evaluation) setEvalData((session as any).evaluation as EvalData);
      setIsFinished(true);
    }
  }, [session]);

  const submitAnswer = useCallback((text: string) => {
    if (!text.trim() || isTypingRef.current) return;
    questionTimesRef.current.push(timerSecondsRef.current);
    setTimerRunning(false);
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: "user", text }]);
    setInputValue("");
    fetchNextQuestion(text);
  }, []);

  const fetchNextQuestion = async (answer: string) => {
    stopSpeaking();
    setIsTyping(true);
    setTimerRunning(false);
    try {
      const res = await getNextQuestion.mutateAsync({ id: sessionId, data: { answer } });
      setIsTyping(false);
      if (res.completed) {
        handleComplete();
      } else if (res.question) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: "bot", text: res.question! }]);
        setQuestionCount(res.questionNumber);
      }
    } catch (e) {
      console.error(e);
      setIsTyping(false);
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: "bot", text: "Error. Please try again." }]);
    }
  };

  const handleComplete = async () => {
    stopSpeaking();
    setIsTyping(true);
    setTimerRunning(false);
    try {
      const result = await evaluateInterview.mutateAsync({ id: sessionId });
      setEvalData(result as EvalData);
      setIsFinished(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTyping(false);
    }
  };

  const addWeakPointToTomorrow = async () => {
    const studentId = localStorage.getItem("studentId");
    if (!studentId || !evalData) return;
    try {
      const res = await apiFetch(`/api/students/${studentId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: `Work on: ${evalData.weakPoint}`,
          sublabel: "From yesterday's mock interview",
          href: "/practice",
        }),
      });
      if (res.ok) setAddedToTomorrow(true);
    } catch {
      // Non-critical — the student can always start practice manually.
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;
    submitAnswer(inputValue);
  };

  const handleConfidenceRating = (rating: number) => {
    setPendingRating(rating);
    setShowRealInterviewQ(true);
  };

  const handleRealInterview = async (answer: "yes" | "no") => {
    if (!pendingRating) return;
    try {
      await submitFeedback.mutateAsync({
        id: sessionId,
        data: { selfConfidenceRating: pendingRating, realInterviewUpcoming: answer }
      });
    } catch (e) {
      // silently ignore — don't block UX
    }
    setConfidenceSent(true);
  };

  const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const toggleRecording = async () => {
    // Stop an in-progress recording (either engine).
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        return;
      }
      recognitionRef.current?.stop();
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
      return;
    }
    stopSpeaking();

    // Primary: record with MediaRecorder, transcribe via OpenAI Whisper.
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          setIsRecording(false);
          const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
          if (blob.size === 0) return;
          setIsTranscribing(true);
          try {
            const base64 = await blobToBase64(blob);
            const res = await fetch("/api/interview/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, mimeType: blob.type }),
            });
            const data = await res.json();
            setIsTranscribing(false);
            const text = (data?.text ?? "").trim();
            if (text) { setInputValue(text); submitAnswer(text); }
          } catch {
            setIsTranscribing(false);
          }
        };
        mediaRecorderRef.current = mr;
        setInputValue("");
        mr.start();
        setIsRecording(true);
        return;
      } catch {
        // mic blocked or MediaRecorder failed -> fall through to browser recognition
      }
    }

    // Fallback: browser SpeechRecognition (Chrome/Edge only).
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Microphone/voice input isn't available in this browser. Try Chrome or Edge, and allow mic access.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let latestFinal = "";
    recognition.onstart = () => { setIsRecording(true); setInputValue(""); };
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      latestFinal = final || latestFinal;
      setInputValue(latestFinal || interim);
      if (latestFinal) {
        if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = setTimeout(() => {
          if (latestFinal.trim()) submitAnswer(latestFinal.trim());
        }, 1400);
      }
    };
    recognition.onerror = (e: any) => { console.error("Speech recognition error:", e.error); setIsRecording(false); };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleVoiceMode = () => {
    const next = !voiceMode;
    setVoiceMode(next);
    voiceModeRef.current = next;
    localStorage.setItem("voiceMode", next ? "true" : "false");
    if (!next) stopSpeaking();
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return <div className="p-4 flex justify-center items-center h-screen bg-paper font-bold text-ink">Loading...</div>;
  }

  // ─── Results screen ──────────────────────────────────────────────────────────
  if (isFinished) {
    const times = questionTimesRef.current;
    const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const fastest = times.length ? Math.min(...times) : 0;
    const slowest = times.length ? Math.max(...times) : 0;
    const [interviewTypeLabel] = (session?.round || "Technical").includes("|")
      ? (session?.round || "Technical|Standard").split("|")
      : [session?.round || "Technical"];

    return (
      <div className="p-4 pb-24 max-w-md lg:max-w-2xl mx-auto space-y-4 min-h-screen bg-canvas">
        <Button variant="ghost" onClick={() => setLocation("/practice")} className="mb-2 -ml-2 text-ink-muted font-bold">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </Button>
        <div className="text-center space-y-1">
          <h1 className="text-display text-[30px] lg:text-[36px] font-extrabold text-ink leading-[1.06] tracking-tight">Interview Complete</h1>
          <p className="text-[12px] text-ink-muted font-bold">{interviewTypeLabel} · {session?.company}</p>
        </div>

        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
        {/* Main score card */}
        <Card className="rounded-2xl bg-paper shadow-soft overflow-hidden lg:order-1">
          <CardContent className="p-6 text-center">
            <div className="text-[80px] font-black leading-none mb-1 text-brand">
              {evalData?.overallScore ?? 85}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-3">Overall Score</p>
            {evalData?.overallRating && (
              <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-brand text-paper">
                {evalData.overallRating}
              </span>
            )}
          </CardContent>
        </Card>

        {/* Confidence micro-survey */}
        <AnimatePresence>
          {!confidenceSent && (
            <motion.div
              className="lg:order-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="rounded-2xl bg-paper shadow-soft">
                <CardContent className="p-4">
                  {!showRealInterviewQ ? (
                    <>
                      <p className="text-[14px] font-bold text-ink mb-1">How confident did you feel?</p>
                      <p className="text-[12px] text-ink-muted mb-3">This helps us personalise your practice.</p>
                      <div className="flex justify-around">
                        {CONFIDENCE_EMOJIS.map(({ emoji, label }, i) => (
                          <button
                            key={i}
                            onClick={() => handleConfidenceRating(i + 1)}
                            title={label}
                            className={cn(
                              "text-2xl w-11 h-11 rounded-full border transition active:scale-90 flex items-center justify-center",
                              pendingRating === i + 1 ? "border-brand bg-brand-soft" : "border-line"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                      <p className="text-[14px] font-bold text-ink mb-3">Do you have a real interview coming up?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleRealInterview("yes")}
                          className="flex-1 py-2.5 rounded-full bg-brand text-paper font-bold text-sm transition"
                        >
                          Yes, soon!
                        </button>
                        <button
                          onClick={() => handleRealInterview("no")}
                          className="flex-1 py-2.5 rounded-full border border-line text-brand font-bold text-sm transition"
                        >
                          Not yet
                        </button>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
          {confidenceSent && (
            <motion.div className="lg:order-2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="rounded-2xl bg-paper shadow-soft">
                <CardContent className="p-4 text-center">
                  <p className="text-[14px] font-bold text-ink">
                    <span className="text-done">✓</span> Thanks for the feedback!
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category scores */}
        {evalData && (
          <Card className="rounded-2xl bg-paper shadow-soft lg:order-3">
            <CardContent className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-4">Category Scores</p>
              <div className="flex justify-around">
                <ScoreRing score={evalData.communicationScore} max={10} label="Comms" />
                <ScoreRing score={evalData.technicalScore} max={10} label="Technical" />
                <ScoreRing score={evalData.confidenceScore} max={10} label="Confidence" />
              </div>
            </CardContent>
          </Card>
        )}

        {evalData && (
          <div className="space-y-3 lg:order-5 lg:col-span-2">
            <Card className="border-0 border-l-2 border-done shadow-none rounded-none bg-paper">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Strength</p>
                <p className="text-[14px] font-medium text-ink">{evalData.strongPoint}</p>
              </CardContent>
            </Card>
            <Card className="border-0 border-l-2 border-line shadow-none rounded-none bg-paper">
              <CardContent className="p-4">
                <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Work on this</p>
                <p className="text-[14px] font-medium text-ink mb-2">{evalData.weakPoint}</p>
                <button
                  onClick={addWeakPointToTomorrow}
                  disabled={addedToTomorrow}
                  className={cn(
                    "text-[12px] font-bold disabled:cursor-default",
                    addedToTomorrow ? "text-done" : "text-brand"
                  )}
                >
                  {addedToTomorrow ? "Added to tomorrow's checklist ✓" : "Add to tomorrow's checklist"}
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {times.length > 0 && (
          <Card className="rounded-2xl bg-paper shadow-soft lg:order-4">
            <CardContent className="p-4">
              <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-3">
                <Clock className="w-3 h-3 inline mr-1" /> Response Times
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-black text-ink">{formatTime(avg)}</div><div className="text-[10px] font-bold text-ink-muted">Average</div></div>
                <div><div className="text-lg font-black text-ink">{formatTime(fastest)}</div><div className="text-[10px] font-bold text-ink-muted">Fastest</div></div>
                <div><div className="text-lg font-black text-ink">{formatTime(slowest)}</div><div className="text-[10px] font-bold text-ink-muted">Slowest</div></div>
              </div>
            </CardContent>
          </Card>
        )}
        </div>

        {evalData?.questionFeedback && evalData.questionFeedback.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-2 px-1">Q&A Review</p>
            <div>
              {evalData.questionFeedback.map((qf, i) => (
                <div key={i} className="border-t border-line first:border-t-0">
                  <button className="w-full py-4 text-left flex justify-between items-center gap-2"
                    onClick={() => setExpandedFeedback(expandedFeedback === i ? null : i)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-brand-soft text-brand text-xs font-black flex items-center justify-center flex-shrink-0">
                        {qf.score}
                      </span>
                      <span className="text-[14px] font-bold text-ink truncate">Q{i + 1}: {qf.question.slice(0, 50)}{qf.question.length > 50 ? "…" : ""}</span>
                    </div>
                    {expandedFeedback === i ? <ChevronUp className="w-4 h-4 text-ink-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink-muted flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {expandedFeedback === i && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="pb-4 space-y-3 border-t border-line pt-3">
                          <div>
                            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Your Answer</p>
                            <p className="text-[14px] text-ink">{qf.studentAnswer || "(no answer)"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider mb-1">Better Answer</p>
                            <p className="text-[14px] text-ink border border-line rounded-xl p-3">{qf.betterAnswer}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 rounded-full h-12 font-bold border border-line text-brand" onClick={() => setLocation("/practice")}>
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
          <Button className="flex-1 rounded-full h-12 font-bold bg-brand hover:bg-brand/90 text-paper">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </div>
    );
  }

  // ─── Active interview screen ──────────────────────────────────────────────────
  const progressPercent = (questionCount / maxQuestions) * 100;
  const [interviewType] = (session?.round || "Technical").includes("|")
    ? (session?.round || "Technical|Standard").split("|")
    : [session?.round || "Technical"];

  return (
    <div className="flex flex-col h-[100dvh] bg-canvas max-w-md lg:max-w-2xl mx-auto relative overflow-hidden">
      {/* Header */}
      {/* Interview is a fullscreen route with no TopBar above it, so this
          header is what sits under the status bar once viewport-fit=cover is
          in play — it has to clear the inset itself. */}
      <div className="bg-paper p-4 pt-[calc(1rem+env(safe-area-inset-top))] sticky top-0 z-10 border-b border-line">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="-ml-2 text-ink" onClick={() => setLocation("/practice")}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-display font-extrabold text-base text-ink">{interviewType} Interview</h1>
            <p className="text-[11px] text-ink-muted font-medium">{session?.company} · Q{questionCount}/{maxQuestions}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleCameraMode}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                cameraMode ? "bg-brand text-paper" : "border border-line text-ink-muted"
              )}
              aria-label="Toggle camera"
            >
              {cameraMode ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleVoiceMode}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                voiceMode ? "bg-brand text-paper" : "border border-line text-ink-muted"
              )}
              aria-label="Toggle voice"
            >
              {voiceMode ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
          <motion.div className="h-full bg-brand rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="flex justify-center gap-1.5 mt-2">
          {Array.from({ length: maxQuestions }).map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300",
              i < questionCount ? "bg-brand w-5" : "bg-line w-3")} />
          ))}
        </div>
      </div>

      {/* Camera PIP self-view (top-right floating) */}
      <AnimatePresence>
        {cameraMode && !isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="fixed top-[88px] right-3 z-20 w-[92px] h-[120px] rounded-2xl overflow-hidden border border-line bg-ink shadow-soft max-w-[calc(44vw-0.75rem)]"
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {!cameraError && (
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-ink/50 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-paper animate-pulse" />
                <span className="text-[10px] font-bold text-paper tracking-wider">LIVE</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 bg-ink/95">
                <CameraOff className="w-5 h-5 text-danger mb-1" />
                <span className="text-[10px] font-bold text-paper leading-tight">{cameraError}</span>
              </div>
            )}
            <button
              onClick={toggleCameraMode}
              className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/60 backdrop-blur-sm flex items-center justify-center text-paper"
              aria-label="Close camera"
            >
              <CameraOff className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer */}
      {timerRunning && (
        <div className="flex justify-end px-4 pt-1">
          <div className="flex items-center gap-1 text-[12px] font-bold text-ink-muted">
            <Clock className="w-3 h-3" /> {formatTime(timerSeconds)}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-56">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[88%] px-5 py-4 text-[14px] font-medium whitespace-pre-wrap",
                msg.sender === "user"
                  ? "bg-brand text-paper rounded-3xl rounded-tr-none"
                  : "bg-line text-ink rounded-3xl rounded-tl-none"
              )}>
                {msg.text}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-line rounded-3xl rounded-tl-none px-5 py-5 flex space-x-1.5">
                <motion.div className="w-2 h-2 bg-ink/60 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                <motion.div className="w-2 h-2 bg-ink/60 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                <motion.div className="w-2 h-2 bg-ink/60 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
              </div>
            </motion.div>
          )}
          {isSpeaking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-paper border border-line rounded-2xl px-4 py-2 flex items-center gap-2 shadow-soft">
                <Volume2 className="w-3.5 h-3.5 text-brand" />
                <div className="flex gap-0.5">
                  {[0, 0.15, 0.3, 0.15, 0].map((delay, i) => (
                    <motion.div key={i} className="w-0.5 rounded-full bg-brand"
                      animate={{ height: ["4px", "14px", "4px"] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay }} />
                  ))}
                </div>
                <span className="text-[12px] font-bold text-brand">Speaking…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line pt-4 pb-5 px-4 max-w-md lg:max-w-2xl mx-auto">
        {(isRecording || isTranscribing || isSpeaking) && (
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }}
            className="text-center text-[12px] font-bold text-ink-muted mb-2">
            {isRecording ? "Listening… speak now, tap Stop when done"
              : isTranscribing ? "Transcribing your answer…"
              : "Interviewer speaking…"}
          </motion.div>
        )}
        <form onSubmit={handleTextSubmit} className="flex gap-2 items-end">
          {voiceMode ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={toggleRecording}
              disabled={isTranscribing || isTyping}
              className="relative flex-1 h-14 rounded-full font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60 bg-brand text-paper"
            >
              {isRecording && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-paper/40 pointer-events-none"
                  animate={{ scale: [1, 1.06, 1], opacity: [0.9, 0.25, 0.9] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <Mic className="w-5 h-5" />
              {isRecording ? "Stop" : isTranscribing ? "Transcribing…" : "Tap to speak"}
            </motion.button>
          ) : (
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (inputValue.trim() && !isTyping) submitAnswer(inputValue);
                }
              }}
              placeholder="Type your answer… (Shift+Enter for new line)"
              disabled={isTyping}
              rows={3}
              className="flex-1 min-h-[88px] max-h-[200px] rounded-2xl border-2 border-line focus-visible:border-brand focus-visible:ring-0 px-4 py-3 text-[15px] bg-paper text-ink placeholder:text-ink-muted resize-none leading-relaxed"
            />
          )}
          {!voiceMode && (
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="submit"
                size="icon"
                disabled={isTyping || !inputValue.trim()}
                className="h-14 w-14 rounded-2xl bg-brand hover:bg-brand/90 text-paper flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </form>
      </div>
    </div>
  );
}
