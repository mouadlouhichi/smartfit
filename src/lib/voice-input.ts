/**
 * Voice input for meal logging.
 *
 * Wraps the Web Speech API so the meal modal can turn "two eggs, khobz and a
 * latte" into text that the *existing* on-device parser then handles. Nothing
 * new is parsed here — voice is a microphone in front of the text box, which
 * is why it works offline, in French, and with no extra cost.
 *
 * The API is not standard everywhere and the prefix changed (Safari still
 * exposes `webkitSpeechRecognition`), so the module reports support rather
 * than throwing, and the UI hides the button when there is none.
 */

interface SpeechResultAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechResult {
  0: SpeechResultAlternative;
  length: number;
  isFinal: boolean;
}
interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when this browser can listen at all. */
export function speechRecognitionSupported(): boolean {
  return ctor() !== null;
}

export interface VoiceSession {
  /** Stop listening and resolve with whatever was heard. */
  stop: () => void;
  abort: () => void;
}

export interface VoiceOptions {
  /** BCP-47 tag: `fr-MA` makes the recogniser expect Moroccan French food words. */
  locale?: string;
  /** Called with the accumulated transcript; `final` marks the end of a phrase. */
  onTranscript: (text: string, final: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

/**
 * Start listening.
 *
 * `continuous` is on so a pause mid-order ("…and a coffee") does not end the
 * session, and interim results stream back so the athlete sees their words
 * appear while speaking — the single biggest trust factor in voice logging.
 */
export function startVoiceInput(opts: VoiceOptions): VoiceSession | null {
  const Ctor = ctor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = opts.locale ?? 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let stopped = false;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    opts.onEnd?.();
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) finalText = `${finalText} ${transcript}`.trim();
      else interim = `${interim} ${transcript}`.trim();
    }
    const combined = `${finalText} ${interim}`.trim();
    if (combined) opts.onTranscript(combined, interim.length === 0 && finalText.length > 0);
  };

  recognition.onerror = (event) => {
    const message =
      event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access was blocked. Allow it in your browser settings, or type the meal instead.'
        : event.error === 'no-speech'
          ? 'Nothing was heard — try again, a little closer to the phone.'
          : 'Voice input stopped unexpectedly. Typing still works.';
    opts.onError?.(message);
    finish();
  };

  recognition.onend = finish;

  try {
    recognition.start();
  } catch {
    // Chrome throws if a session is already running for this page.
    opts.onError?.('Voice input could not start. Try again in a moment.');
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
      finish();
    },
  };
}

/** Locale tag for the recogniser, from the app locale. */
export function speechLocale(locale: string, countryFor: Record<string, string> = {}): string {
  return countryFor[locale] ?? locale;
}
