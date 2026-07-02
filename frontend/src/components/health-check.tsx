"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch("/api/v1/health");
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function HealthCheck() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  if (isPending) return <p className="text-sm text-gray-500">Đang kiểm tra API…</p>;
  if (isError) return <p className="text-sm text-red-600">API: không kết nối được</p>;
  return <p className="text-sm text-green-600">API: {data.status}</p>;
}
