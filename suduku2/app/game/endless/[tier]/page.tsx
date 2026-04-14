import { EndlessTierView } from "./endless-tier-view";

export default async function EndlessTierPage({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const { tier } = await params;
  return <EndlessTierView tierParam={tier} />;
}
