"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

type ChartType = "bar" | "line" | "pie" | "scatter" | "area";

interface ChartConfig {
  chart_type: ChartType;
  x_axis: string;
  y_axis: string;
  title: string;
  color?: string | null;
}

interface VisualizerProps {
  data: Record<string, any>[];
  config: ChartConfig;
}

const COLORS = ["#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function Visualizer({ data, config }: VisualizerProps) {
  const { chart_type, x_axis, y_axis } = config;

  // Format data specifically for pie charts
  const pieData = useMemo(() => {
    if (chart_type !== "pie") return [];
    return data.map((item) => ({
      name: item[x_axis],
      value: Number(item[y_axis]) || 0,
    }));
  }, [data, chart_type, x_axis, y_axis]);

  const renderChart = () => {
    switch (chart_type) {
      case "bar":
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
            <XAxis dataKey={x_axis} stroke="#a1a1aa" fontSize={12} tickLine={false} />
            <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "8px" }}
              itemStyle={{ color: "#e4e4e7" }}
            />
            <Bar dataKey={y_axis} fill={config.color || COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
            <XAxis dataKey={x_axis} stroke="#a1a1aa" fontSize={12} tickLine={false} />
            <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "8px" }}
              itemStyle={{ color: "#e4e4e7" }}
            />
            <Line
              type="monotone"
              dataKey={y_axis}
              stroke={config.color || COLORS[1]}
              strokeWidth={3}
              dot={{ r: 4, fill: "#18181b", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
      case "pie":
        return (
          <PieChart>
            <Tooltip
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "8px" }}
              itemStyle={{ color: "#e4e4e7" }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }} />
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
              ))}
            </Pie>
          </PieChart>
        );
      case "scatter":
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={x_axis} name={x_axis} stroke="#a1a1aa" fontSize={12} />
            <YAxis dataKey={y_axis} name={y_axis} stroke="#a1a1aa" fontSize={12} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "8px" }}
            />
            <Scatter data={data} fill={config.color || COLORS[2]} />
          </ScatterChart>
        );
      default:
        return (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Unsupported chart type: {chart_type}
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mt-4 shadow-sm">
      <div className="mb-4">
        <h4 className="text-sm font-medium text-zinc-200">{config.title}</h4>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
