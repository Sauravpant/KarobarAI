import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { voiceApi, type VoiceConfirmation } from '@/api/endpoints';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ConfirmationPlayer } from '@/features/voice/components/confirmation-player';
import { RecordPanel } from '@/features/voice/components/record-panel';
import { TranscriptEditor } from '@/features/voice/components/transcript-editor';
import { TransactionCard } from '@/features/voice/components/transaction-card';
import { buildConfirmPayload, buildDrafts, validateTransaction, type DraftTransaction } from '@/features/voice/draft';
import { useVoiceRecorder } from '@/features/voice/use-voice-recorder';
import { useActiveShop } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme/tokens';

const MAX_RECORDING_MS = 90_000;

type Phase = 'record' | 'transcribing' | 'transcript' | 'extracting' | 'review' | 'confirming' | 'done';

interface State {
  phase: Phase;
  transcript: string;
  drafts: DraftTransaction[];
  confirmation: VoiceConfirmation | null;
  error: string | null;
}

type Action =
  | { type: 'transcribing' }
  | { type: 'transcribed'; text: string }
  | { type: 'edit-transcript'; text: string }
  | { type: 'extracting' }
  | { type: 'extracted'; drafts: DraftTransaction[] }
  | { type: 'update-draft'; tx: DraftTransaction }
  | { type: 'confirming' }
  | { type: 'confirmed'; confirmation: VoiceConfirmation }
  | { type: 'failed'; phase: Phase; error: string }
  | { type: 'reset' };

const initialState: State = { phase: 'record', transcript: '', drafts: [], confirmation: null, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'transcribing':
      return { ...state, phase: 'transcribing', error: null };
    case 'transcribed':
      return { ...state, phase: 'transcript', transcript: action.text };
    case 'edit-transcript':
      return { ...state, transcript: action.text };
    case 'extracting':
      return { ...state, phase: 'extracting', error: null };
    case 'extracted':
      return { ...state, phase: 'review', drafts: action.drafts };
    case 'update-draft':
      return { ...state, drafts: state.drafts.map((d) => (d.key === action.tx.key ? action.tx : d)) };
    case 'confirming':
      return { ...state, phase: 'confirming', error: null };
    case 'confirmed':
      return { ...state, phase: 'done', confirmation: action.confirmation };
    case 'failed':
      return { ...state, phase: action.phase, error: action.error };
    case 'reset':
      return initialState;
  }
}

export default function VoiceScreen() {
  const shop = useActiveShop();
  const queryClient = useQueryClient();
  const recorder = useVoiceRecorder();
  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel in-flight transcribe/extract when leaving the screen.
  useEffect(() => () => abortRef.current?.abort(), []);

  const nextSignal = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const stopAndTranscribe = useCallback(async () => {
    dispatch({ type: 'transcribing' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await recorder.stop();
      if (!uri) throw new Error('Recording failed. Please try again.');
      const text = await voiceApi.transcribe(shop.id, uri, nextSignal());
      if (!text) throw new Error("Couldn't hear anything. Speak closer to the phone and try again.");
      dispatch({ type: 'transcribed', text });
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      dispatch({ type: 'failed', phase: 'record', error: errorMessage(err) });
    }
  }, [recorder, shop.id]);

  const toggleRecording = useCallback(async () => {
    if (recorder.isRecording) return stopAndTranscribe();
    try {
      await recorder.start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      dispatch({ type: 'failed', phase: 'record', error: errorMessage(err) });
    }
  }, [recorder, stopAndTranscribe]);

  // Hard cap so a forgotten recording doesn't upload minutes of silence.
  useEffect(() => {
    if (state.phase === 'record' && recorder.isRecording && recorder.durationMillis >= MAX_RECORDING_MS) {
      stopAndTranscribe();
    }
  }, [state.phase, recorder.isRecording, recorder.durationMillis, stopAndTranscribe]);

  const extract = async () => {
    dispatch({ type: 'extracting' });
    try {
      const result = await voiceApi.extract(shop.id, state.transcript.trim(), nextSignal());
      const drafts = buildDrafts(result);
      if (!drafts.some((d) => d.items.length)) {
        throw new Error('No items found in what you said. Edit the transcript or record again.');
      }
      dispatch({ type: 'extracted', drafts });
    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      dispatch({ type: 'failed', phase: 'transcript', error: errorMessage(err) });
    }
  };

  const draftErrors = useMemo(
    () => Object.fromEntries(state.drafts.map((d) => [d.key, validateTransaction(d)])),
    [state.drafts],
  );
  const payload = useMemo(() => buildConfirmPayload(state.drafts), [state.drafts]);
  const canConfirm = payload.transactions.length > 0 && Object.values(draftErrors).every((e) => !e);

  const confirm = async () => {
    dispatch({ type: 'confirming' });
    try {
      // Not abortable on purpose: once sent, the server may have written stock; let it finish.
      const confirmation = await voiceApi.confirmWithAudio(shop.id, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['dashboard', shop.id] });
      queryClient.invalidateQueries({ queryKey: ['customers', shop.id] });
      dispatch({ type: 'confirmed', confirmation });
    } catch (err) {
      dispatch({ type: 'failed', phase: 'review', error: errorMessage(err) });
    }
  };

  const updateDraft = useCallback((tx: DraftTransaction) => dispatch({ type: 'update-draft', tx }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const { phase } = state;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Steps phase={phase} />
          {state.error && <Banner message={state.error} />}

          {(phase === 'record' || phase === 'transcribing') && (
            <RecordPanel
              isRecording={recorder.isRecording}
              busyLabel={phase === 'transcribing' ? 'ट्रान्सक्रिप्ट हुँदैछ…' : null}
              durationMillis={recorder.durationMillis}
              onPress={toggleRecording}
            />
          )}

          {(phase === 'transcript' || phase === 'extracting') && (
            <TranscriptEditor
              text={state.transcript}
              onChange={(text) => dispatch({ type: 'edit-transcript', text })}
              onSubmit={extract}
              onRedo={reset}
              loading={phase === 'extracting'}
            />
          )}

          {(phase === 'review' || phase === 'confirming') && (
            <View style={styles.review}>
              <Text style={styles.transcriptQuote} numberOfLines={3}>
                “{state.transcript}”
              </Text>
              {state.drafts.map((tx) => (
                <TransactionCard key={tx.key} tx={tx} shopId={shop.id} error={draftErrors[tx.key]} onChange={updateDraft} />
              ))}
            </View>
          )}

          {phase === 'done' && state.confirmation && (
            <View style={styles.review}>
              <Text style={styles.doneTitle}>
                Saved {state.confirmation.processedCount} item{state.confirmation.processedCount === 1 ? '' : 's'}
              </Text>
              <ConfirmationPlayer audioUri={state.confirmation.audioUri} text={state.confirmation.text} />
            </View>
          )}
        </ScrollView>

        {(phase === 'review' || phase === 'confirming') && (
          <View style={styles.footer}>
            <Button label="Back" variant="secondary" onPress={reset} disabled={phase === 'confirming'} style={styles.footerSecondary} />
            <Button
              label="Confirm & save"
              onPress={confirm}
              loading={phase === 'confirming'}
              disabled={!canConfirm}
              style={styles.footerPrimary}
            />
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.footer}>
            <Button label="Done" variant="secondary" onPress={() => router.back()} style={styles.footerSecondary} />
            <Button label="Record another" onPress={reset} style={styles.footerPrimary} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const STEP_LABELS = ['Speak', 'Check', 'Review', 'Saved'] as const;
const PHASE_STEP: Record<Phase, number> = {
  record: 0,
  transcribing: 0,
  transcript: 1,
  extracting: 1,
  review: 2,
  confirming: 2,
  done: 3,
};

function Steps({ phase }: { phase: Phase }) {
  const current = PHASE_STEP[phase];
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${current + 1} of 4: ${STEP_LABELS[current]}`}>
      {STEP_LABELS.map((label, i) => (
        <View key={label} style={styles.step}>
          <View style={[styles.stepBar, i <= current && styles.stepBarActive]} />
          <Text style={[styles.stepLabel, i === current && styles.stepLabelActive]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  steps: { flexDirection: 'row', gap: spacing.sm },
  step: { flex: 1, gap: spacing.xs },
  stepBar: { height: 3, borderRadius: 2, backgroundColor: colors.border },
  stepBarActive: { backgroundColor: colors.brand },
  stepLabel: { ...typography.caption, color: colors.textSubtle },
  stepLabelActive: { color: colors.text, fontWeight: '600' },
  review: { gap: spacing.md },
  transcriptQuote: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
  doneTitle: { ...typography.heading, color: colors.text },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerSecondary: { flex: 1 },
  footerPrimary: { flex: 2 },
});
