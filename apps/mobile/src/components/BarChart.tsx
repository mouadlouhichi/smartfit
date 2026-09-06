import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  color = '#C8F135',
  height = 180,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 320;
  const padBottom = 22;
  const padTop = 10;
  const chartH = height - padBottom - padTop;
  const barW = width / data.length;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={0} y1={height - padBottom} x2={width} y2={height - padBottom} stroke="#273019" strokeWidth={1} />
        {data.map((d, i) => {
          const h = (d.value / max) * chartH;
          const x = i * barW + barW * 0.2;
          const w = barW * 0.6;
          const y = height - padBottom - h;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={w} height={Math.max(2, h)} rx={4} fill={color} opacity={i === data.length - 1 ? 1 : 0.75} />
              <SvgText
                x={i * barW + barW / 2}
                y={height - 6}
                fontSize={9}
                fill="#9BA886"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
        {padTop ? null : null}
      </Svg>
      <Text className="mt-1 text-xs text-muted-foreground"> </Text>
    </View>
  );
}
