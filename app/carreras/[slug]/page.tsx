import { RaceDetailClient } from "./client";

export async function generateStaticParams() {
  const { MOCK_RACES } = await import("@/lib/mock/data");
  return MOCK_RACES.map((race) => ({ slug: race.slug }));
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <RaceDetailClient params={params} />;
}
