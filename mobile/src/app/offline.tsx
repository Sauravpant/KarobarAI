import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StateView } from '@/components/ui/state-view';
import { RecordPanel } from '@/features/voice/components/record-panel';
import { deleteRecording, listRecordings, saveRecording, type SavedRecording } from '@/features/voice/offline-store';
import { useVoiceRecorder } from '@/features/voice/use-voice-recorder';
import { formatDuration } from '@/lib/format';
import { useActiveShop } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const MAX_RECORDING_MS = 90_000;

const formatRecordedAt = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function OfflineScreen() {
  const shop = useActiveShop();
  const recorder = useVoiceRecorder();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    try {
      setRecordings(listRecordings(shop.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [shop.id]);

  // Reload on focus: a recording disappears once the voice screen confirms it.
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => player.pause();
    }, [reload, player]),
  );

  const stopAndSave = useCallback(async () => {
    const duration = recorder.durationMillis;
    try {
      const uri = await recorder.stop();
      if (!uri) throw new Error('Recording failed. Please try again.');
      saveRecording(shop.id, uri, duration);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [recorder, shop.id, reload]);

  const toggleRecording = async () => {
    if (recorder.isRecording) return stopAndSave();
    setError(null);
    try {
      await recorder.start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Hard cap, same as the voice screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState only runs after `await recorder.stop()`
    if (recorder.isRecording && recorder.durationMillis >= MAX_RECORDING_MS) stopAndSave();
  }, [recorder.isRecording, recorder.durationMillis, stopAndSave]);

  const togglePlay = (uri: string) => {
    if (playingUri === uri && status.playing) return player.pause();
    if (playingUri !== uri) {
      player.replace({ uri });
      setPlayingUri(uri);
    } else if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
      player.seekTo(0);
    }
    player.play();
  };

  const confirmDelete = (rec: SavedRecording) =>
    Alert.alert('Delete recording?', `${formatRecordedAt(rec.recordedAt)} · this cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (playingUri === rec.uri) {
            player.pause();
            setPlayingUri(null);
          }
          deleteRecording(rec.uri);
          reload();
        },
      },
    ]);

  const process = (rec: SavedRecording) => {
    player.pause();
    router.push({ pathname: '/voice', params: { recording: rec.name } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {error && <Banner message={error} />}

        <Card>
          <RecordPanel
            isRecording={recorder.isRecording}
            busyLabel={null}
            durationMillis={recorder.durationMillis}
            onPress={toggleRecording}
          />
          <Text style={styles.hint}>No internet needed. Recordings stay on this phone until you process them.</Text>
        </Card>

        <Text style={styles.sectionLabel}>SAVED ON THIS PHONE · {recordings.length}</Text>
        {recordings.length === 0 ? (
          <StateView title="Nothing saved" message="Recordings made without internet show up here." />
        ) : (
          recordings.map((rec) => {
            const isPlaying = playingUri === rec.uri && status.playing;
            return (
              <Card key={rec.uri} style={styles.row}>
                <View style={styles.rowTop}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isPlaying ? 'Pause recording' : 'Play recording'}
                    onPress={() => togglePlay(rec.uri)}
                    style={({ pressed }) => [styles.play, pressed && styles.pressed]}
                  >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={18} color={colors.textInverse} />
                  </Pressable>
                  <View style={styles.meta}>
                    <Text style={styles.title}>{formatRecordedAt(rec.recordedAt)}</Text>
                    <Text style={styles.caption}>{formatDuration(rec.durationMillis)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete recording"
                    onPress={() => confirmDelete(rec)}
                    hitSlop={12}
                    style={styles.iconButton}
                  >
                    <Icon name="trash" size={20} color={colors.danger} />
                  </Pressable>
                </View>
                <Button label="Process & confirm" onPress={() => process(rec)} />
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  sectionLabel: { ...typography.label, color: colors.textSubtle, marginTop: spacing.md },
  row: { gap: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  play: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  meta: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  iconButton: { padding: spacing.sm },
});
