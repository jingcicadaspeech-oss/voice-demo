"use client";

import { useEffect, useRef, useState } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import styles from "./voice-demo.module.css";

type Bot = {
  id: string;
  name: string;
  description: string;
  agentId: string;
};

type AppConfig = {
  appName: string;
  companyName: string;
  bots: Bot[];
};

type TranscriptEntry = {
  id: string;
  role: "agent" | "user";
  text: string;
  order: number;
};

type RetellUpdateEntry = {
  id?: string;
  utterance_id?: string;
  turn_id?: string;
  role?: string;
  speaker?: string;
  source?: string;
  content?: string;
  text?: string;
  transcript?: string;
  message?: string;
  start_timestamp?: number;
  timestamp?: number;
};

type RetellUpdate = {
  transcript?: string | RetellUpdateEntry[];
};

const client = new RetellWebClient();

export function VoiceDemo() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [callStatus, setCallStatus] = useState("Idle");
  const [speakerStatus, setSpeakerStatus] = useState("Waiting");
  const [eventStatus, setEventStatus] = useState("Loading");
  const [isStarting, setIsStarting] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptMapRef = useRef(new Map<string, TranscriptEntry>());

  const selectedBot =
    config?.bots.find((bot) => bot.id === selectedBotId) ?? config?.bots[0] ?? null;

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        const data = (await response.json()) as AppConfig;

        if (!response.ok) {
          throw new Error("Failed to load app configuration.");
        }

        if (!mounted) {
          return;
        }

        setConfig(data);
        setSelectedBotId(data.bots[0]?.id ?? "");
        setEventStatus("Ready");
      } catch (error) {
        console.error(error);
        if (mounted) {
          setEventStatus("Unable to load configuration.");
        }
      }
    }

    loadConfig();

    const handleCallStarted = () => {
      setIsInCall(true);
      setIsStarting(false);
      setCallStatus("Connected");
      setSpeakerStatus("Listening");
      setEventStatus("Call started");
    };

    const handleCallEnded = () => {
      setIsInCall(false);
      setIsStarting(false);
      setCallStatus("Ended");
      setSpeakerStatus("Waiting");
      setEventStatus("Call ended");
    };

    const handleAgentStart = () => {
      setSpeakerStatus("Agent speaking");
      setEventStatus("Agent response");
    };

    const handleAgentStop = () => {
      setSpeakerStatus("Listening");
    };

    const handleUpdate = (update: RetellUpdate) => {
      const entries = normalizeTranscript(update);
      if (entries.length === 0) {
        return;
      }

      for (const entry of entries) {
        transcriptMapRef.current.set(entry.id, entry);
      }

      const nextEntries = Array.from(transcriptMapRef.current.values()).sort(
        (left, right) => left.order - right.order,
      );
      setTranscript(nextEntries);
    };

    const handleMetadata = (metadata: { agent_name?: string }) => {
      if (metadata.agent_name) {
        setEventStatus(`Connected to ${metadata.agent_name}`);
      }
    };

    const handleError = (error: { message?: string }) => {
      console.error(error);
      setIsInCall(false);
      setIsStarting(false);
      setCallStatus("Error");
      setSpeakerStatus("Waiting");
      setEventStatus(error.message ?? "Voice session error.");
      client.stopCall();
    };

    client.on("call_started", handleCallStarted);
    client.on("call_ended", handleCallEnded);
    client.on("agent_start_talking", handleAgentStart);
    client.on("agent_stop_talking", handleAgentStop);
    client.on("update", handleUpdate);
    client.on("metadata", handleMetadata);
    client.on("error", handleError);

    return () => {
      mounted = false;
      client.off("call_started", handleCallStarted);
      client.off("call_ended", handleCallEnded);
      client.off("agent_start_talking", handleAgentStart);
      client.off("agent_stop_talking", handleAgentStop);
      client.off("update", handleUpdate);
      client.off("metadata", handleMetadata);
      client.off("error", handleError);
      client.stopCall();
    };
  }, []);

  async function startCall() {
    if (!selectedBot) {
      setEventStatus("No bot selected.");
      return;
    }

    try {
      setIsStarting(true);
      setCallStatus("Connecting");
      setSpeakerStatus("Requesting microphone");
      setEventStatus(`Connecting to ${selectedBot.name}`);
      transcriptMapRef.current.clear();
      setTranscript([]);

      const response = await fetch("/api/create-web-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ botId: selectedBot.id }),
      });

      const payload = (await response.json()) as {
        accessToken?: string;
        error?: string;
      };

      if (!response.ok || !payload.accessToken) {
        throw new Error(payload.error ?? "Unable to create the voice session.");
      }

      await client.startCall({
        accessToken: payload.accessToken,
        sampleRate: 24000,
        emitRawAudioSamples: false,
      });
    } catch (error) {
      console.error(error);
      setIsStarting(false);
      setIsInCall(false);
      setCallStatus("Error");
      setSpeakerStatus("Waiting");
      setEventStatus(error instanceof Error ? error.message : "Unable to start call.");
    }
  }

  function stopCall() {
    client.stopCall();
    setIsInCall(false);
    setIsStarting(false);
    setCallStatus("Ending");
    setSpeakerStatus("Waiting");
    setEventStatus("Ending call");
  }

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} />
      <section className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Cicada Speech</p>
            <h1 className={styles.title}>voice demo</h1>
            <p className={styles.subtitle}>
              Choose a bot, allow microphone access, and start a live voice session in
              the browser.
            </p>
          </div>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeLabel}>Session Status</span>
            <strong>{eventStatus}</strong>
          </div>
        </header>

        <section className={styles.grid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Bots</h2>
              <span>{config?.bots.length ?? 0} available</span>
            </div>

            <div className={styles.botList}>
              {(config?.bots ?? []).map((bot) => {
                const isActive = bot.id === selectedBotId;
                return (
                  <button
                    key={bot.id}
                    type="button"
                    className={isActive ? styles.botCardActive : styles.botCard}
                    disabled={isInCall || isStarting}
                    onClick={() => setSelectedBotId(bot.id)}
                  >
                    <strong>{bot.name}</strong>
                    <p>{bot.description}</p>
                  </button>
                );
              })}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Control Room</h2>
              <span>{selectedBot?.name ?? "No selection"}</span>
            </div>

            <div className={styles.metrics}>
              <div className={styles.metricCard}>
                <span>Call Status</span>
                <strong>{callStatus}</strong>
              </div>
              <div className={styles.metricCard}>
                <span>Speaker</span>
                <strong>{speakerStatus}</strong>
              </div>
            </div>

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isInCall || isStarting || !selectedBot}
                onClick={startCall}
              >
                {isStarting ? "Starting..." : "Start voice session"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={!isInCall && !isStarting}
                onClick={stopCall}
              >
                End session
              </button>
            </div>

            <div className={styles.note}>
              <strong>Microphone access is required.</strong>
              <p>
                The browser will ask for permission the first time you start a voice
                session on this device.
              </p>
            </div>
          </article>
        </section>

        <section className={styles.transcriptPanel}>
          <div className={styles.panelHead}>
            <h2>Transcript</h2>
            <span>Live updates</span>
          </div>

          <div className={styles.transcriptList}>
            {transcript.length === 0 ? (
              <div className={styles.emptyState}>
                Transcript updates will appear here once the call begins.
              </div>
            ) : (
              transcript.map((entry) => (
                <article key={entry.id} className={styles.messageCard}>
                  <strong>{entry.role === "agent" ? "Agent" : "User"}</strong>
                  <p>{entry.text}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function normalizeTranscript(update: RetellUpdate): TranscriptEntry[] {
  if (Array.isArray(update.transcript)) {
    return update.transcript
      .map((item, index) => normalizeTranscriptEntry(item, index))
      .filter((value): value is TranscriptEntry => value !== null);
  }

  if (typeof update.transcript === "string") {
    return update.transcript
      .split("\n")
      .map((line, index) => {
        const value = line.trim();
        if (!value) {
          return null;
        }

        const startsWithAgent = value.toLowerCase().startsWith("agent:");
        const startsWithUser = value.toLowerCase().startsWith("user:");

        return normalizeTranscriptEntry(
          {
            role: startsWithUser ? "user" : startsWithAgent ? "agent" : "agent",
            content: value.replace(/^(agent|user):/i, "").trim(),
          },
          index,
        );
      })
      .filter((value): value is TranscriptEntry => value !== null);
  }

  return [];
}

function normalizeTranscriptEntry(
  item: RetellUpdateEntry,
  fallbackIndex: number,
): TranscriptEntry | null {
  const rawText = item.content ?? item.text ?? item.transcript ?? item.message ?? "";
  const role = item.role ?? item.speaker ?? item.source ?? "agent";

  if (!rawText.trim()) {
    return null;
  }

  return {
    id:
      item.id ??
      item.utterance_id ??
      item.turn_id ??
      `${role}-${fallbackIndex}-${rawText.trim()}`,
    role: role.toLowerCase().includes("user") ? "user" : "agent",
    text: rawText.trim(),
    order: Number(item.start_timestamp ?? item.timestamp ?? fallbackIndex),
  };
}
