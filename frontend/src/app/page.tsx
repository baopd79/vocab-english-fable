import { HealthCheck } from "@/components/health-check";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Vocab English</h1>
      <p className="text-gray-600">Học từ vựng tiếng Anh với AI</p>
      <HealthCheck />
    </main>
  );
}
