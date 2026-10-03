import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { formatDuration } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface ConfirmationPlayerProps {
  audioUri: string;
  /** Shown under the controls; omit when the screen renders the text itself. */
  text?: string;
}

/** Plays server audio (voice confirmation, daily brief) once on mount; replayable. Deletes the temp file on unmount. */
export function ConfirmationPlayer({ audioUri, text }: ConfirmationPlayerProps) {
  const player = useAudioPlayer({ uri: audioUri });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(
    () => () => {
      try {
        new File(audioUri).delete();
      } catch {
        // already gone
      }
    },
    [audioUri],
  );

  const toggle = () => {
    if (status.playing) return player.pause();
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) player.seekTo(0);
    player.play();
  };

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'}
          onPress={toggle}
          style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
        >
          <Icon name={status.playing ? 'pause' : 'play'} size={20} color={colors.textInverse} />
        </Pressable>
        <View style={styles.progressCol}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.time}>
            {formatDuration(status.currentTime * 1000)} / {formatDuration(status.duration * 1000)}
          </Text>
        </View>
      </View>
      {!!text && <Text style={styles.text}>{text}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  play: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPressed: { opacity: 0.8 },
  progressCol: { flex: 1, gap: spacing.xs },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.brand },
  time: { ...typography.caption, color: colors.textSubtle, fontVariant: ['tabular-nums'] },
  text: { ...typography.body, fontSize: 17, lineHeight: 26, color: colors.text },
});
