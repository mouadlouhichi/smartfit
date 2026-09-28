import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

export interface LineDatum {
  label: string;
  value: number;
}

export function LineChart({
  data,
  color = '#f3ff47',
  height = 160,
  accessibilityLabel,
  formatValue = (value) => String(value),
}: {
  data: LineDatum[];
  color?: string;
  height?: number;
  accessibilityLabel: string;
  formatValue?: (value: number) => string;
}) {
  if (data.length === 0) {
    return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} />;
  }

  const width = 320;
  const padX = 18;
  const padTop = 14;
  const padBottom = 28;
  const chartH = height - padTop - padBottom;
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const center = (min + max) / 2;
  const span = Math.max(max - min, Math.max(Math.abs(center) * 0.08, 1));
  const chartMax = center + span / 2;
  const points = data.map((point, index) => ({
    ...point,
    x: data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * (width - padX * 2),
    y: padTop + ((chartMax - point.value) / span) * chartH,
  }));
  const polyline = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const summary = points.map((point) => `${point.label}: ${formatValue(point.value)}`).join('; ');

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${accessibilityLabel}. ${summary}`}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((fraction) => {
          const y = padTop + chartH * fraction;
          return (
            <Line
              key={fraction}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="#333333"
              strokeWidth={1}
            />
          );
        })}
        {points.length > 1 && (
          <Polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {points.map((point, index) => (
          <Circle
            key={`${point.label}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 5 : 3.5}
            fill={color}
            stroke="#111111"
            strokeWidth={2}
          />
        ))}
        {points.length > 0 && (
          <>
            <SvgText x={padX} y={height - 7} fontSize={10} fill="#a3a3a3" textAnchor="start">
              {points[0].label}
            </SvgText>
            {points.length > 1 && (
              <SvgText
                x={width - padX}
                y={height - 7}
                fontSize={10}
                fill="#a3a3a3"
                textAnchor="end"
              >
                {points[points.length - 1].label}
              </SvgText>
            )}
          </>
        )}
      </Svg>
    </View>
  );
}
