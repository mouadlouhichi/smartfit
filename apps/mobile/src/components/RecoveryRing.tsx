import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface RingSpec {
  r: number;
  pct: number;
  color: string;
  width: number;
  trackColor: string;
}

/**
 * Concentric tri-ring matching the web RecoveryCard: Sleep (outer purple),
 * Recovery (middle volt), Strain (inner orange). Center shows the main score.
 */
export function TriRing({
  size = 200,
  rings,
  centerLabel,
  centerValue,
  centerSub,
}: {
  size?: number;
  rings: RingSpec[];
  centerLabel?: string;
  centerValue?: string | number;
  centerSub?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((r, i) => {
          const c = 2 * Math.PI * r.r;
          const len = (Math.max(0, Math.min(100, r.pct)) / 100) * c;
          return (
            <React.Fragment key={i}>
              <Circle
                cx={cx}
                cy={cy}
                r={r.r}
                fill="none"
                stroke={r.trackColor}
                strokeWidth={r.width}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={r.r}
                fill="none"
                stroke={r.color}
                strokeWidth={r.width}
                strokeLinecap="round"
                strokeDasharray={`${len} ${c}`}
                rotation={-90}
                origin={`${cx}, ${cy}`}
                opacity={r.pct > 0 ? 1 : 0.4}
              />
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerLabel ? (
          <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>
            {centerLabel.toUpperCase()}
          </Text>
        ) : null}
        {centerValue !== undefined ? (
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900' }}>{centerValue}</Text>
        ) : null}
        {centerSub ? <Text style={{ color: '#9ca3af', fontSize: 11 }}>{centerSub}</Text> : null}
      </View>
    </View>
  );
}
