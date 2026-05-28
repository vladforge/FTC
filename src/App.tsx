import { useState } from "react";

import { DecodeSimulator } from "@/components/decode/DecodeSimulator";

type AppView = "simulator";

export default function App() {
  const [view] = useState<AppView>("simulator");

  switch (view) {
    case "simulator":
      return <DecodeSimulator />;
    default:
      return null;
  }
}
