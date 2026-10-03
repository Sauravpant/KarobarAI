import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback } from 'react';

// Speech only: mono 16 kHz AAC (.m4a). Backend resamples to 16 kHz mono anyway,
// so this keeps uploads ~4x smaller than the HIGH_QUALITY preset with no STT loss.
const RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 64_000,
};

export class MicPermissionError extends Error {
  constructor() {
    super('Microphone access denied. Enable it in Settings to record.');
  }
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder, 250);

  const start = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) throw new MicPermissionError();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  /** Stops recording and returns the local file URI. */
  const stop = useCallback(async () => {
    await recorder.stop();
    // Leave record mode so playback goes to the loudspeaker on iOS.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri;
  }, [recorder]);

  return { start, stop, isRecording: state.isRecording, durationMillis: state.durationMillis };
}
