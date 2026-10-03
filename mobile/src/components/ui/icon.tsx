import { SymbolView } from 'expo-symbols';
import { memo } from 'react';

import { colors } from '@/theme/tokens';

// SF Symbol (iOS) / Material Symbol (Android, web) pairs used across the app.
const ICONS = {
  mic: { ios: 'mic.fill', android: 'mic', web: 'mic' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  redo: { ios: 'arrow.counterclockwise', android: 'replay', web: 'replay' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  store: { ios: 'storefront', android: 'storefront', web: 'storefront' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  logout: {
    ios: 'rectangle.portrait.and.arrow.right',
    android: 'logout',
    web: 'logout',
  },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  waveform: { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' },
  box: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  trendUp: { ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' },
  trendDown: { ios: 'arrow.down.right', android: 'trending_down', web: 'trending_down' },
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const Icon = memo(function Icon({ name, size = 20, color = colors.text }: IconProps) {
  // Casts: SymbolView's name union is huge; ICONS above is the source of truth.
  return <SymbolView name={ICONS[name] as never} size={size} tintColor={color} />;
});
