"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Radar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, 
  RadialLinearScale, ArcElement, Title, Tooltip, Legend
);

export default function AnalysisChart({ data }: { data: any }) {
  if (!data) return null;

  const chartData = {
    labels: data.labels,
    datasets: data.datasets || [{
      label: data.title || '분석 데이터',
      data: data.values,
      backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE'],
      borderRadius: 8,
    }]
  };

  const options = {
    responsive: true,
    plugins: { legend: { position: 'bottom' as const } },
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mt-8">
      <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        {data.title || "데이터 시각화"}
      </h4>
      <div className="max-h-[300px] flex justify-center">
        {data.type === 'bar' && <Bar data={chartData} options={options} />}
        {data.type === 'pie' && <Pie data={chartData} options={options} />}
        {data.type === 'radar' && <Radar data={chartData} options={options} />}
      </div>
    </div>
  );
}