import { createFileRoute } from "@tanstack/react-router";
import { DecodeSimulator } from "@/components/decode/DecodeSimulator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DECODE Match Strategy Simulator | FTC" },
      { name: "description", content: "Interactive FTC DECODE strategy simulator: toggle alliance roles, plan artifact collection, time gate unlocks, and project endgame obelisk bonuses." },
      { property: "og:title", content: "DECODE Match Strategy Simulator" },
      { property: "og:description", content: "Plan FTC DECODE matches with alliance coordination, gate timing, and obelisk endgame scoring." },
    ],
  }),
  component: Index,
});

function Index() {
  return <DecodeSimulator />;
}
