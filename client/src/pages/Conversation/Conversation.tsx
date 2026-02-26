import { FC, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { SocketContext } from "./SocketContext";
import { ServerAudio } from "./components/ServerAudio/ServerAudio";
import { UserAudio } from "./components/UserAudio/UserAudio";
import { Button } from "../../components/Button/Button";
import { ServerAudioStats } from "./components/ServerAudio/ServerAudioStats";
import { AudioStats } from "./hooks/useServerAudio";
import { TextDisplay } from "./components/TextDisplay/TextDisplay";
import { MediaContext } from "./MediaContext";
import { ServerInfo } from "./components/ServerInfo/ServerInfo";
import { ModelParamsValues, useModelParams } from "./hooks/useModelParams";
import fixWebmDuration from "webm-duration-fix";
import { getMimeType, getExtension } from "./getMimeType";
import { type ThemeType } from "./hooks/useSystemTheme";
import { WSMessage } from "../../protocol/types";
import { useTranscriptSummary } from "./hooks/useTranscriptSummary";
import { env } from "../../env";

type ConversationProps = {
  workerAddr: string;
  workerAuthId?: string;
  sessionAuthId?: string;
  sessionId?: number;
  email?: string;
  theme: ThemeType;
  audioContext: MutableRefObject<AudioContext | null>;
  worklet: MutableRefObject<AudioWorkletNode | null>;
  onConversationEnd?: () => void;
  isBypass?: boolean;
  startConnection: () => Promise<void>;
  embed?: boolean;
  contractorId: string;
  contractorLabel?: string;
  leadApiBasePath: string;
} & Partial<ModelParamsValues>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_PATTERN = /^\+?[1-9]\d{7,14}$/;

const buildURL = ({
  workerAddr,
  params,
  workerAuthId,
  email,
  contractorId,
  textSeed,
  audioSeed,
}: {
  workerAddr: string;
  params: ModelParamsValues;
  workerAuthId?: string;
  email?: string;
  contractorId?: string;
  textSeed: number;
  audioSeed: number;
}) => {
  const newWorkerAddr = (workerAddr === "same" || workerAddr === "")
    ? `${window.location.hostname}:${window.location.port}`
    : workerAddr;

  if (workerAddr === "same" || workerAddr === "") {
    console.log("Overriding workerAddr to", newWorkerAddr);
  }

  const wsProtocol = (window.location.protocol === "https:") ? "wss" : "ws";
  const url = new URL(`${wsProtocol}://${newWorkerAddr}/api/chat`);
  if (workerAuthId) {
    url.searchParams.append("worker_auth_id", workerAuthId);
  }
  if (email) {
    url.searchParams.append("email", email);
  }
  if (contractorId) {
    url.searchParams.append("contractor_id", contractorId);
  }
  url.searchParams.append("text_temperature", params.textTemperature.toString());
  url.searchParams.append("text_topk", params.textTopk.toString());
  url.searchParams.append("audio_temperature", params.audioTemperature.toString());
  url.searchParams.append("audio_topk", params.audioTopk.toString());
  url.searchParams.append("pad_mult", params.padMult.toString());
  url.searchParams.append("text_seed", textSeed.toString());
  url.searchParams.append("audio_seed", audioSeed.toString());
  url.searchParams.append("repetition_penalty_context", params.repetitionPenaltyContext.toString());
  url.searchParams.append("repetition_penalty", params.repetitionPenalty.toString());
  url.searchParams.append("text_prompt", params.textPrompt.toString());
  url.searchParams.append("voice_prompt", params.voicePrompt.toString());
  console.log(url.toString());
  return url.toString();
};

export const Conversation: FC<ConversationProps> = ({
  workerAddr,
  workerAuthId,
  audioContext,
  worklet,
  onConversationEnd,
  email,
  theme,
  embed = false,
  contractorId,
  contractorLabel,
  leadApiBasePath,
  ...params
}) => {
  const getAudioStats = useRef<() => AudioStats>(() => ({
    playedAudioDuration: 0,
    missedAudioDuration: 0,
    totalAudioMessages: 0,
    delay: 0,
    minPlaybackDelay: 0,
    maxPlaybackDelay: 0,
  }));
  const isRecording = useRef<boolean>(false);
  const audioChunks = useRef<Blob[]>([]);

  const audioStreamDestination = useRef<MediaStreamAudioDestinationNode>(audioContext.current!.createMediaStreamDestination());
  const stereoMerger = useRef<ChannelMergerNode>(audioContext.current!.createChannelMerger(2));
  const audioRecorder = useRef<MediaRecorder>(new MediaRecorder(audioStreamDestination.current.stream, { mimeType: getMimeType("audio"), audioBitsPerSecond: 128000 }));
  const [audioURL, setAudioURL] = useState<string>("");
  const [isOver, setIsOver] = useState(false);
  const [showLeadPrompt, setShowLeadPrompt] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSubmitError, setLeadSubmitError] = useState<string | null>(null);
  const [isLeadSubmitting, setIsLeadSubmitting] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [contactValidationError, setContactValidationError] = useState<string | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const { summary, summaryStatus, generateSummary } = useTranscriptSummary(env.VITE_OPENAI_API_KEY);

  const conversationStartedAt = useRef<string | null>(null);
  const conversationEndedAt = useRef<string | null>(null);
  const hasConnectedOnce = useRef(false);

  const modelParams = useModelParams(params);
  const micDuration = useRef<number>(0);
  const actualAudioPlayed = useRef<number>(0);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const textSeed = useMemo(() => Math.round(1000000 * Math.random()), []);
  const audioSeed = useMemo(() => Math.round(1000000 * Math.random()), []);

  const WSURL = buildURL({
    workerAddr,
    params: modelParams,
    workerAuthId,
    email,
    contractorId,
    textSeed,
    audioSeed,
  });

  const startRecording = useCallback(() => {
    if (isRecording.current) {
      return;
    }
    try {
      stereoMerger.current.disconnect();
    } catch { }
    try {
      worklet.current?.disconnect(audioStreamDestination.current);
    } catch { }

    worklet.current?.connect(stereoMerger.current, 0, 0);
    stereoMerger.current.connect(audioStreamDestination.current);

    setAudioURL("");
    audioRecorder.current.start();
    isRecording.current = true;
  }, [isRecording, worklet, audioStreamDestination, audioRecorder, stereoMerger]);

  const stopRecording = useCallback(() => {
    if (!isRecording.current) {
      return;
    }
    try {
      worklet.current?.disconnect(stereoMerger.current);
    } catch { }
    try {
      stereoMerger.current.disconnect(audioStreamDestination.current);
    } catch { }
    audioRecorder.current.stop();
    isRecording.current = false;
  }, [isRecording, worklet, audioStreamDestination, audioRecorder, stereoMerger]);

  const onDisconnect = useCallback(() => {
    setIsOver(true);
    conversationEndedAt.current = new Date().toISOString();
    stopRecording();
    setShowLeadPrompt(true);
  }, [stopRecording]);

  const onSocketMessage = useCallback((message: WSMessage) => {
    if (message.type === "text") {
      setTranscriptChunks((current) => [...current, message.data]);
    }
  }, []);

  const { socketStatus, sendMessage, socket, start, stop } = useSocket({
    uri: WSURL,
    onDisconnect,
    onMessage: onSocketMessage,
  });

  useEffect(() => {
    audioRecorder.current.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };
    audioRecorder.current.onstop = async () => {
      let blob: Blob;
      const mimeType = getMimeType("audio");
      if (mimeType.includes("webm")) {
        blob = await fixWebmDuration(new Blob(audioChunks.current, { type: mimeType }));
      } else {
        blob = new Blob(audioChunks.current, { type: mimeType });
      }
      setAudioURL(URL.createObjectURL(blob));
      audioChunks.current = [];
    };
  }, [audioRecorder, setAudioURL, audioChunks]);

  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, stop, workerAuthId]);

  useEffect(() => {
    if (socketStatus === "connected") {
      hasConnectedOnce.current = true;
      if (!conversationStartedAt.current) {
        conversationStartedAt.current = new Date().toISOString();
      }
    }
  }, [socketStatus]);

  useEffect(() => {
    if (isOver && hasConnectedOnce.current && !leadSubmitted) {
      setShowLeadPrompt(true);
      generateSummary(transcriptChunks);
    }
  }, [isOver, leadSubmitted]);

  const onPressConnect = useCallback(async () => {
    if (isOver) {
      if (!leadSubmitted) {
        setShowLeadPrompt(true);
        return;
      }
      window.location.reload();
      return;
    }
    audioContext.current?.resume();
    if (socketStatus !== "connected") {
      start();
    } else {
      stop();
    }
  }, [socketStatus, isOver, leadSubmitted, start, stop, audioContext]);

  const submitLead = useCallback(async () => {
    const emailValue = contactEmail.trim();
    const mobileValue = contactMobile.trim();

    if (!emailValue && !mobileValue) {
      setContactValidationError("Provide either an email address or mobile number.");
      return;
    }
    if (emailValue && !EMAIL_PATTERN.test(emailValue)) {
      setContactValidationError("Enter a valid email address.");
      return;
    }
    if (mobileValue && !MOBILE_PATTERN.test(mobileValue.replace(/[\s()-]/g, ""))) {
      setContactValidationError("Enter a valid mobile number in international format (for example +61412345678).");
      return;
    }

    setContactValidationError(null);
    setLeadSubmitError(null);
    setIsLeadSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsLeadSubmitting(false);
    setLeadSubmitted(true);
    onConversationEnd?.();
  }, [
    contactEmail,
    contactMobile,
    onConversationEnd,
  ]);

  const socketColor = useMemo(() => {
    if (socketStatus === "connected") {
      return "bg-[#4f9d69]";
    } else if (socketStatus === "connecting") {
      return "bg-amber-400";
    }
    return "bg-red-400";
  }, [socketStatus]);

  const socketButtonMsg = useMemo(() => {
    if (isOver && leadSubmitted) {
      return "New Conversation";
    }
    if (isOver) {
      return "Awaiting Contact Details";
    }
    if (socketStatus === "connected") {
      return "End Conversation";
    }
    return "Connecting...";
  }, [isOver, leadSubmitted, socketStatus]);

  return (
    <SocketContext.Provider
      value={{
        socketStatus,
        sendMessage,
        socket,
      }}
    >
      <div className="bg-[#f7f9f8] min-h-screen">
        <div className={`main-grid h-screen max-h-screen w-screen p-4 m-auto ${embed ? "max-w-screen-md" : "max-w-96 md:max-w-screen-lg"}`}>
          <div className="controls text-center flex justify-center items-center gap-2">
            <Button
              onClick={onPressConnect}
              disabled={(socketStatus !== "connected" && !isOver) || (isOver && !leadSubmitted)}
            >
              <span className="flex items-center gap-2">
                {socketStatus === "connecting" && (
                  <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {socketButtonMsg}
              </span>
            </Button>
            <div className={`h-3 w-3 rounded-full ${socketColor}`} />
          </div>
          {audioContext.current && worklet.current && (
            <MediaContext.Provider value={
              {
                startRecording,
                stopRecording,
                audioContext: audioContext as MutableRefObject<AudioContext>,
                worklet: worklet as MutableRefObject<AudioWorkletNode>,
                audioStreamDestination,
                stereoMerger,
                micDuration,
                actualAudioPlayed,
              }
            }
            >
              <div className="relative player h-full max-h-full w-full justify-between gap-3 md:p-12">
                <ServerAudio
                  setGetAudioStats={(callback: () => AudioStats) =>
                    (getAudioStats.current = callback)
                  }
                  theme={theme}
                />
                <UserAudio theme={theme} />
                {!embed && (
                  <div className="pt-8 text-sm flex justify-center items-center flex-col download-links">
                    {audioURL && <div><a href={audioURL} download={`personaplex_audio.${getExtension("audio")}`} className="pt-2 text-center block">Download audio</a></div>}
                  </div>
                )}
              </div>
              <div className="scrollbar player-text rounded-lg border border-gray-200 bg-white" ref={textContainerRef}>
                <TextDisplay containerRef={textContainerRef} />
              </div>
              {!embed && (
                <div className="player-stats hidden md:block">
                  <ServerAudioStats getAudioStats={getAudioStats} />
                </div>
              )}
            </MediaContext.Provider>
          )}
        </div>
        {!embed && (
          <div className="max-w-96 md:max-w-screen-lg p-4 m-auto text-center">
            <ServerInfo />
          </div>
        )}
      </div>

      {showLeadPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            {!leadSubmitted ? (
              <>
                <h2 className="text-xl font-semibold text-black">Conversation Summary</h2>

                <div className="mt-3 min-h-[80px] rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
                  {summaryStatus === "loading" && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating summary...
                    </div>
                  )}
                  {summaryStatus === "done" && summary && (
                    <div dangerouslySetInnerHTML={{ __html: summary }} />
                  )}
                  {summaryStatus === "error" && (
                    <p className="text-gray-500 italic">Summary unavailable.</p>
                  )}
                  {summaryStatus === "idle" && (
                    <p className="text-gray-400 italic">Waiting for conversation to end...</p>
                  )}
                </div>

                <p className="mt-4 text-sm text-gray-600">
                  Leave your details and {contractorLabel ?? "our team"} will be in touch.
                </p>

                <div className="mt-4">
                  <label htmlFor="lead-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    id="lead-email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    type="email"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="name@example.com"
                  />
                </div>
                <div className="mt-3">
                  <label htmlFor="lead-mobile" className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <input
                    id="lead-mobile"
                    value={contactMobile}
                    onChange={(event) => setContactMobile(event.target.value)}
                    type="tel"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="+61412345678"
                  />
                </div>

                {contactValidationError && <p className="mt-3 text-sm text-red-600">{contactValidationError}</p>}
                {leadSubmitError && <p className="mt-3 text-sm text-red-600">{leadSubmitError}</p>}

                <div className="mt-5">
                  <Button className="w-full" onClick={submitLead} disabled={isLeadSubmitting}>
                    {isLeadSubmitting ? "Submitting..." : "Submit Details"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center py-4">
                  <svg className="h-12 w-12 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-black">Thanks for your submission!</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Someone from {contractorLabel ?? "our team"} will be in contact with you soon.
                  </p>
                </div>
                <div className="mt-5">
                  <Button className="w-full" onClick={() => window.location.reload()}>
                    Start New Conversation
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
};
