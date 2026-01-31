"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Test chart component to verify Recharts setup.
 * This component demonstrates basic Recharts functionality.
 */

const sampleData = [
  { name: "Mon", value: 4 },
  { name: "Tue", value: 3 },
  { name: "Wed", value: 5 },
  { name: "Thu", value: 4 },
  { name: "Fri", value: 6 },
  { name: "Sat", value: 4 },
  { name: "Sun", value: 3 },
];

export function TestChart() {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampleData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[1, 7]} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981" }}
            name="Bristol Score"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
