import { useAuth } from "@/context/AuthContext";
import {
  AUDIO_TWEET_MAX_DURATION_SECONDS,
  AUDIO_TWEET_MAX_SIZE_BYTES,
  AUDIO_TWEET_WINDOW_LABEL,
  isAudioTweetWindowOpen,
} from "@/lib/audioTweet";
import {
  containsKeywordTweet,
  notifyAboutKeywordTweet,
} from "@/lib/tweetNotifications";
import axiosInstance from "@/lib/axiosInstance";
import axios from "axios";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Globe,
  Image,
  MapPin,
  Mic,
  Play,
  ShieldCheck,
  Smile,
  Square,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { getPlanById } from "@/lib/subscription";

const AUDIO_SESSION_STORAGE_PREFIX = "twitter-audio-upload-session";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const formatSeconds = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const getAudioSessionStorageKey = (email: string) =>
  `${AUDIO_SESSION_STORAGE_PREFIX}:${email}`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
};

const loadAudioDuration = (file: File) => {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read audio duration."));
    };
    audio.src = objectUrl;
  });
};

interface TweetComposerProps {
  onTweetPosted?: (tweet: unknown) => void;
}

const TweetComposer = ({ onTweetPosted }: TweetComposerProps) => {
  const { user } = useAuth();
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageurl, setimageurl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSizeBytes, setAudioSizeBytes] = useState(0);
  const [audioError, setAudioError] = useState("");
  const [audioInfo, setAudioInfo] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUploadToken, setAudioUploadToken] = useState("");
  const [audioUploadTokenExpiresAt, setAudioUploadTokenExpiresAt] = useState<
    number | null
  >(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const maxLength = 200;
  const currentPlan = getPlanById(user?.subscriptionPlan || "free");
  const activeTweetLimit = user?.subscriptionTweetLimit ?? currentPlan.tweetLimit;
  const activeTweetCount = user?.subscriptionTweetCount ?? 0;
  const isTweetQuotaExceeded =
    activeTweetLimit !== Number.POSITIVE_INFINITY && activeTweetCount >= activeTweetLimit;
  const audioWindowOpen = isAudioTweetWindowOpen();
  const hasValidAudioSession =
    Boolean(audioUploadToken) &&
    Boolean(audioUploadTokenExpiresAt) &&
    audioUploadTokenExpiresAt !== null &&
    audioUploadTokenExpiresAt > Date.now();

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;

  const clearAudioPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const resetAudioState = () => {
    clearAudioPreview();
    setAudioFile(null);
    setAudioPreviewUrl("");
    setAudioDuration(0);
    setAudioSizeBytes(0);
    setAudioError("");
    setAudioInfo("");
    setRecordingSeconds(0);
  };

  const stopRecordingInfrastructure = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const activeStream = recordingStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }

    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const persistAudioSession = (token: string, expiresAt: number) => {
    if (!user?.email) return;

    localStorage.setItem(
      getAudioSessionStorageKey(user.email),
      JSON.stringify({ token, expiresAt })
    );
  };

  const clearPersistedAudioSession = () => {
    if (!user?.email) return;

    localStorage.removeItem(getAudioSessionStorageKey(user.email));
  };

  const loadStoredAudioSession = () => {
    if (!user?.email) {
      setAudioUploadToken("");
      setAudioUploadTokenExpiresAt(null);
      return;
    }

    const storedValue = localStorage.getItem(getAudioSessionStorageKey(user.email));
    if (!storedValue) {
      setAudioUploadToken("");
      setAudioUploadTokenExpiresAt(null);
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as {
        token?: string;
        expiresAt?: number;
      };

      if (parsed.token && parsed.expiresAt && parsed.expiresAt > Date.now()) {
        setAudioUploadToken(parsed.token);
        setAudioUploadTokenExpiresAt(parsed.expiresAt);
        return;
      }
    } catch {
      // Ignore malformed session data.
    }

    clearPersistedAudioSession();
    setAudioUploadToken("");
    setAudioUploadTokenExpiresAt(null);
  };

  useEffect(() => {
    loadStoredAudioSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => {
    return () => {
      clearAudioPreview();
      stopRecordingInfrastructure();
    };
  }, []);

  const prepareAudioFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      throw new Error("Please select a valid audio file.");
    }

    if (file.size > AUDIO_TWEET_MAX_SIZE_BYTES) {
      throw new Error("Audio files must be 100 MB or smaller.");
    }

    const duration = await loadAudioDuration(file);

    if (duration > AUDIO_TWEET_MAX_DURATION_SECONDS) {
      throw new Error("Audio files must be 5 minutes or shorter.");
    }

    clearAudioPreview();
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;

    setAudioFile(file);
    setAudioDuration(duration);
    setAudioSizeBytes(file.size);
    setAudioPreviewUrl(nextPreviewUrl);
    setAudioError("");
    setAudioInfo("Audio ready to upload.");
    setAudioPanelOpen(true);
  };

  const requestAudioOtp = async () => {
    if (!user?.email) {
      setAudioError("Please sign in before requesting an audio OTP.");
      return false;
    }

    if (!audioWindowOpen) {
      setAudioError(
        `Audio tweets are only available between ${AUDIO_TWEET_WINDOW_LABEL}.`
      );
      return false;
    }

    setIsRequestingOtp(true);
    setOtpError("");
    setOtpStatus("");

    try {
      const response = await axiosInstance.post("/audio-otp/request", {
        email: user.email,
      });

      setOtpModalOpen(true);
      setOtpStatus(response.data?.message || "OTP sent to your registered email.");
      setOtpCode(response.data?.devOtp || "");
      return true;
    } catch (error) {
      setOtpError(getErrorMessage(error, "Failed to request an OTP."));
      return false;
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const verifyAudioOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.email) {
      setOtpError("Please sign in before verifying an OTP.");
      return;
    }

    if (!otpCode.trim()) {
      setOtpError("Enter the OTP that was sent to your email.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError("");

    try {
      const response = await axiosInstance.post("/audio-otp/verify", {
        email: user.email,
        otp: otpCode.trim(),
      });

      setAudioUploadToken(response.data.uploadToken);
      setAudioUploadTokenExpiresAt(response.data.expiresAt);
      persistAudioSession(response.data.uploadToken, response.data.expiresAt);
      setOtpModalOpen(false);
      setOtpStatus("Audio upload verified for this session.");
      setOtpCode("");
    } catch (error) {
      setOtpError(getErrorMessage(error, "OTP verification failed."));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || (!content.trim() && !audioFile)) return;

    if (audioFile && !audioWindowOpen) {
      setAudioError(
        `Audio tweets are only available between ${AUDIO_TWEET_WINDOW_LABEL}.`
      );
      return;
    }

    if (audioFile && !hasValidAudioSession) {
      setAudioError("Verify your registered email with OTP before posting audio.");
      setOtpModalOpen(true);
      await requestAudioOtp();
      return;
    }

    setIsLoading(true);
    try {
      if (audioFile) {
        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append("author", user._id);
        formData.append("email", user.email);
        formData.append("uploadToken", audioUploadToken);
        formData.append("content", content.trim());

        const res = await axiosInstance.post("/audio/post", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        const shouldNotify = containsKeywordTweet(content);
        if (shouldNotify) {
          notifyAboutKeywordTweet({
            ...res.data,
            author: {
              displayName: user.displayName,
              avatar: user.avatar,
            },
          });
        }

        onTweetPosted?.({
          ...res.data,
          __skipNotification: shouldNotify,
        });
      } else {
        const tweetdata = {
          author: user._id,
          content,
          image: imageurl,
        };
        const res = await axiosInstance.post("/post", tweetdata);
        const shouldNotify = containsKeywordTweet(content);

        if (shouldNotify) {
          notifyAboutKeywordTweet({
            ...res.data,
            author: {
              displayName: user.displayName,
              avatar: user.avatar,
            },
          });
        }

        onTweetPosted?.({
          ...res.data,
          __skipNotification: shouldNotify,
        });
      }

      setContent("");
      setimageurl("");
      setPreviewError(false);
      resetAudioState();
      setAudioPanelOpen(false);
    } catch (error) {
      setAudioError(getErrorMessage(error, "Failed to post tweet."));
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    const image = e.target.files[0];
    const formdataimg = new FormData();
    formdataimg.set("image", image);
    try {
      const res = await axios.post(
        "https://api.imgbb.com/1/upload?key=97f3fb960c3520d6a88d7e29679cf96f",
        formdataimg
      );
      const url = res.data.data.display_url;
      if (url) {
        setimageurl(url);
        setPreviewError(false);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioUploadClick = () => {
    if (!audioWindowOpen) {
      setAudioError(
        `Audio tweets are only available between ${AUDIO_TWEET_WINDOW_LABEL}.`
      );
      return;
    }

    if (!hasValidAudioSession) {
      void requestAudioOtp();
      return;
    }

    audioFileInputRef.current?.click();
  };

  const handleAudioFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsLoading(true);
    try {
      await prepareAudioFile(file);
    } catch (error) {
      setAudioError(getErrorMessage(error, "Failed to prepare audio file."));
      resetAudioState();
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const finalizeRecordedAudio = async () => {
    const mimeType = recordingChunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(recordingChunksRef.current, { type: mimeType });

    if (!blob.size) {
      throw new Error("No audio was recorded.");
    }

    if (blob.size > AUDIO_TWEET_MAX_SIZE_BYTES) {
      throw new Error("Recorded audio exceeds the 100 MB limit.");
    }

    const file = new File([blob], `voice-tweet-${Date.now()}.webm`, {
      type: mimeType,
    });

    await prepareAudioFile(file);
  };

  const startRecording = async () => {
    if (!audioWindowOpen) {
      setAudioError(
        `Audio tweets are only available between ${AUDIO_TWEET_WINDOW_LABEL}.`
      );
      return;
    }

    if (!hasValidAudioSession) {
      setAudioError("Verify your registered email with OTP before recording.");
      await requestAudioOtp();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAudioError("This browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setAudioError("");
      setAudioInfo("Recording voice note...");
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          await finalizeRecordedAudio();
          setAudioInfo("Recording ready to upload.");
        } catch (error) {
          setAudioError(getErrorMessage(error, "Unable to save recording."));
        } finally {
          stopRecordingInfrastructure();
          recordingChunksRef.current = [];
        }
      };

      mediaRecorderRef.current = recorder;
      recordingStreamRef.current = stream;
      recorder.start();

      recordingTimerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);

        if (recordingSecondsRef.current >= AUDIO_TWEET_MAX_DURATION_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch {
      setAudioError("Unable to access the microphone.");
      stopRecordingInfrastructure();
    }
  };

  const removeAudioAttachment = () => {
    resetAudioState();
    setAudioInfo("");
  };

  if (!user) return null;

  return (
    <>
      <Card className="bg-black/95 border-gray-800 border-x-0 border-t-0 rounded-none">
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar} alt={user.displayName} />
              <AvatarFallback>{user.displayName[0]}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <form onSubmit={handleSubmit}>
                <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Current plan</div>
                      <div className="text-sm font-semibold text-white">{currentPlan.displayName}</div>
                    </div>
                    <Link
                      href="/subscription"
                      className="inline-flex items-center rounded-full border border-gray-700 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-gray-900"
                    >
                      Upgrade plan
                    </Link>
                  </div>
                  <div className="mt-3 text-sm text-gray-400">
                    {activeTweetLimit === Number.POSITIVE_INFINITY
                      ? "Unlimited tweeting is enabled for your account."
                      : `${activeTweetCount}/${activeTweetLimit} tweets used in this cycle.`}
                  </div>
                  {isTweetQuotaExceeded && (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                      Your plan limit is reached. Upgrade to post more tweets.
                    </div>
                  )}
                </div>

                <Textarea
                  placeholder={audioFile ? "Add an optional caption for your audio tweet..." : "What's happening?"}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-transparent border-none text-xl text-white placeholder-gray-500 resize-none min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0 whitespace-pre-wrap break-words"
                />

                {imageurl && (
                  <div className="mb-4 overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
                    <img
                      src={imageurl}
                      alt="Tweet preview"
                      onError={() => setPreviewError(true)}
                      className={`w-full max-h-96 object-cover ${previewError ? "hidden" : "block"}`}
                    />
                    {previewError && (
                      <div className="p-4 text-sm text-gray-400">
                        Image preview unavailable.
                      </div>
                    )}
                  </div>
                )}

                {audioFile && (
                  <div className="mb-4 rounded-2xl border border-gray-800 bg-gray-950 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Mic className="h-4 w-4 text-blue-400" />
                        <span>Audio tweet ready</span>
                      </div>
                      <button
                        type="button"
                        onClick={removeAudioAttachment}
                        disabled={isLoading || (!content.trim() && !audioFile) || isTweetQuotaExceeded}
                        aria-label="Remove audio"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <audio controls className="w-full">
                      <source src={audioPreviewUrl} type={audioFile.type} />
                      Your browser does not support the audio element.
                    </audio>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>{formatSeconds(audioDuration)}</span>
                      <span>{formatBytes(audioSizeBytes)}</span>
                      <span>Limit: 5 minutes / 100 MB</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950/70 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center space-x-2 text-blue-400">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="p-2 rounded-full hover:bg-blue-900/20"
                        onClick={() => setAudioPanelOpen((prev) => !prev)}
                      >
                        <Mic className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="p-2 rounded-full hover:bg-blue-900/20"
                        onClick={handleAudioUploadClick}
                        disabled={isLoading}
                      >
                        <Upload className="h-5 w-5" />
                      </Button>
                      <label
                        htmlFor="tweetImage"
                        className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                      >
                        <Image className="h-5 w-5" />
                        <input
                          type="file"
                          accept="image/*"
                          id="tweetImage"
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={isLoading}
                        />
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 rounded-full hover:bg-blue-900/20"
                        type="button"
                      >
                        <BarChart3 className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 rounded-full hover:bg-blue-900/20"
                        type="button"
                      >
                        <Smile className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 rounded-full hover:bg-blue-900/20"
                        type="button"
                      >
                        <Calendar className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 rounded-full hover:bg-blue-900/20"
                        type="button"
                      >
                        <MapPin className="h-5 w-5" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-blue-400" />
                        <span className="text-sm text-blue-400 font-semibold">
                          Everyone can reply
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {characterCount > 0 && (
                          <div className="flex items-center space-x-2">
                            <div className="relative w-8 h-8">
                              <svg className="w-8 h-8 transform -rotate-90">
                                <circle
                                  cx="16"
                                  cy="16"
                                  r="14"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                  className="text-gray-700"
                                />
                                <circle
                                  cx="16"
                                  cy="16"
                                  r="14"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                  strokeDasharray={`${2 * Math.PI * 14}`}
                                  strokeDashoffset={`${
                                    2 * Math.PI * 14 * (1 - characterCount / maxLength)
                                  }`}
                                  className={
                                    isOverLimit
                                      ? "text-red-500"
                                      : isNearLimit
                                        ? "text-yellow-500"
                                        : "text-blue-500"
                                  }
                                />
                              </svg>
                            </div>
                            {isNearLimit && (
                              <span
                                className={`text-sm ${
                                  isOverLimit ? "text-red-500" : "text-yellow-500"
                                }`}
                              >
                                {maxLength - characterCount}
                              </span>
                            )}
                          </div>
                        )}
                        <Separator orientation="vertical" className="h-6 bg-gray-700" />

                        <Button
                          type="submit"
                          disabled={
                            (!content.trim() && !audioFile) ||
                            isOverLimit ||
                            isLoading ||
                            isRecording ||
                            Boolean(audioFile && !audioWindowOpen)
                          }
                          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-full px-6"
                        >
                          {isLoading ? "Posting..." : "Post"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {audioPanelOpen && (
                    <div className="rounded-2xl border border-gray-800 bg-black/80 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Mic className="h-4 w-4 text-blue-400" />
                            Audio tweet mode
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            Record or upload voice notes between {AUDIO_TWEET_WINDOW_LABEL}.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-3 py-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
                            {hasValidAudioSession ? "OTP verified" : "OTP required"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-3 py-1">
                            <Calendar className="h-3.5 w-3.5 text-blue-400" />
                            {audioWindowOpen ? "Window open" : "Window closed"}
                          </span>
                        </div>
                      </div>

                      {!audioWindowOpen && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-300">
                          <AlertCircle className="mt-0.5 h-4 w-4" />
                          <span>
                            Audio uploads are blocked outside the {AUDIO_TWEET_WINDOW_LABEL} window.
                          </span>
                        </div>
                      )}

                      {!hasValidAudioSession && (
                        <div className="flex items-start gap-2 rounded-xl border border-blue-900/50 bg-blue-950/30 p-3 text-sm text-blue-200">
                          <ShieldCheck className="mt-0.5 h-4 w-4" />
                          <span>
                            Verify the registered email with an OTP before recording or uploading audio.
                          </span>
                        </div>
                      )}

                      {audioError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
                          <AlertCircle className="mt-0.5 h-4 w-4" />
                          <span>{audioError}</span>
                        </div>
                      )}

                      {audioInfo && !audioError && (
                        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-sm text-gray-300">
                          {audioInfo}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={() => {
                            void requestAudioOtp();
                          }}
                          disabled={isRequestingOtp || isLoading}
                        >
                          {isRequestingOtp ? "Sending OTP..." : "Request OTP"}
                        </Button>

                        <Button
                          type="button"
                          className="rounded-full bg-white/10 hover:bg-white/15 text-white"
                          onClick={() => {
                            if (isRecording) {
                              stopRecording();
                              return;
                            }

                            void startRecording();
                          }}
                          disabled={isLoading}
                        >
                          {isRecording ? (
                            <>
                              <Square className="mr-2 h-4 w-4" />
                              Stop recording ({formatSeconds(recordingSeconds)})
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Record voice
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          className="rounded-full bg-white/10 hover:bg-white/15 text-white"
                          onClick={handleAudioUploadClick}
                          disabled={isLoading || isRecording}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload audio file
                        </Button>
                      </div>

                      <input
                        ref={audioFileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileChange}
                      />

                      {isRecording && (
                        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-200">
                          Recording in progress. The clip will stop automatically after 5 minutes.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-gray-800 bg-black text-white shadow-2xl">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">Verify audio upload</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Enter the OTP sent to {user.email} before uploading audio.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:bg-gray-900 hover:text-white"
                  onClick={() => setOtpModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {otpStatus && (
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-sm text-gray-300">
                  {otpStatus}
                </div>
              )}

              {process.env.NODE_ENV !== "production" && otpCode && (
                <div className="rounded-xl border border-blue-900/60 bg-blue-950/30 p-3 text-sm text-blue-200">
                  Development OTP: {otpCode}
                </div>
              )}

              {otpError && (
                <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">
                  {otpError}
                </div>
              )}

              <form onSubmit={verifyAudioOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">OTP code</label>
                  <input
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    placeholder="Enter 6-digit OTP"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-700 bg-transparent px-4 py-3 text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    className="flex-1 rounded-full bg-white/10 text-white hover:bg-white/15"
                    onClick={() => setOtpModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 rounded-full bg-blue-500 text-white hover:bg-blue-600"
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default TweetComposer;
