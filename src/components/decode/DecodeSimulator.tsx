import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Alliance = "red" | "blue";
type Slot = "1" | "2";

const PATTERNS = [
  { id: "GPP", label: "Green · Purple · Purple", bonus: 10 },
  { id: "PGP", label: "Purple · Green · Purple", bonus: 10 },
  { id: "PPG", label: "Purple · Purple · Green", bonus: 10 },
  { id: "GGG", label: "All Green (perfect)", bonus: 20 },
  { id: "NONE", label: "No pattern committed", bonus: 0 },
] as const;

type PatternId = (typeof PATTERNS)[number]["id"];

interface RobotPlan {
  autoArtifacts: number;
  teleopArtifacts: number;
  gateUnlockSec: number; // seconds into teleop
  endgameAscent: "none" | "low" | "high";
  patternsCompleted: number;
}

const defaultRobot = (offset = 0): RobotPlan => ({
  autoArtifacts: 4 + offset,
  teleopArtifacts: 18,
  gateUnlockSec: 35,
  endgameAscent: "low",
  patternsCompleted: 1,
});

const ASCENT_POINTS = { none: 0, low: 5, high: 15 } as const;
const AUTO_PER_ARTIFACT = 3;
const TELEOP_PER_ARTIFACT = 2;
const GATE_BONUS_MAX = 20; // earlier unlock => higher bonus

function scoreRobot(r: RobotPlan, pattern: PatternId) {
  const auto = r.autoArtifacts * AUTO_PER_ARTIFACT;
  const teleop = r.teleopArtifacts * TELEOP_PER_ARTIFACT;
  // Gate unlock bonus: unlocking earlier (lower seconds) yields more bonus
  const gate = Math.max(0, Math.round(GATE_BONUS_MAX * (1 - r.gateUnlockSec / 90)));
  const ascent = ASCENT_POINTS[r.endgameAscent];
  const patternBonus = PATTERNS.find((p) => p.id === pattern)!.bonus * r.patternsCompleted;
  return { auto, teleop, gate, ascent, patternBonus, total: auto + teleop + gate + ascent + patternBonus };
}

function interferencePenalty(a: RobotPlan, b: RobotPlan) {
  // If both rely on heavy teleop collection and unlock late, they collide on the field.
  const overlap = Math.min(a.teleopArtifacts, b.teleopArtifacts);
  const lateGate = (a.gateUnlockSec + b.gateUnlockSec) / 2 > 45 ? 1.4 : 1;
  const raw = Math.max(0, overlap - 14) * 1.5 * lateGate;
  return Math.round(raw);
}

export function DecodeSimulator() {
  const [activeAlliance, setActiveAlliance] = useState<Alliance>("red");
  const [activeSlot, setActiveSlot] = useState<Slot>("1");
  const [pattern, setPattern] = useState<PatternId>("GPP");

  const [red1, setRed1] = useState<RobotPlan>(defaultRobot(0));
  const [red2, setRed2] = useState<RobotPlan>(defaultRobot(-1));
  const [blue1, setBlue1] = useState<RobotPlan>(defaultRobot(0));
  const [blue2, setBlue2] = useState<RobotPlan>(defaultRobot(-1));

  const setters = { red1: setRed1, red2: setRed2, blue1: setBlue1, blue2: setBlue2 };
  const robots = { red1, red2, blue1, blue2 };
  const currentKey = `${activeAlliance}${activeSlot}` as keyof typeof robots;
  const current = robots[currentKey];
  const setCurrent = (patch: Partial<RobotPlan>) =>
    setters[currentKey]((prev) => ({ ...prev, ...patch }));

  const breakdown = useMemo(() => {
    const r1 = scoreRobot(red1, pattern);
    const r2 = scoreRobot(red2, pattern);
    const b1 = scoreRobot(blue1, pattern);
    const b2 = scoreRobot(blue2, pattern);
    const redPenalty = interferencePenalty(red1, red2);
    const bluePenalty = interferencePenalty(blue1, blue2);
    return {
      red: { r1, r2, penalty: redPenalty, total: r1.total + r2.total - redPenalty },
      blue: { r1: b1, r2: b2, penalty: bluePenalty, total: b1.total + b2.total - bluePenalty },
    };
  }, [red1, red2, blue1, blue2, pattern]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-secondary/40 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block size-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">FTC 2025 · DECODE</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Match Strategy Simulator
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Model alliance roles, artifact targets, gate timing, and obelisk endgame to project your match score.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Projected</span>
            <div className="flex items-baseline gap-4">
              <ScoreBadge alliance="red" value={breakdown.red.total} />
              <span className="text-muted-foreground">vs</span>
              <ScoreBadge alliance="blue" value={breakdown.blue.total} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Left: controls */}
        <section className="space-y-6">
          <div className="rounded-xl border border-border bg-secondary/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Editing Robot</h2>
              <div className="flex gap-2">
                {(["red", "blue"] as Alliance[]).map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant={activeAlliance === a ? "default" : "outline"}
                    onClick={() => setActiveAlliance(a)}
                    className={
                      activeAlliance === a
                        ? a === "red"
                          ? "bg-red-alliance text-white hover:bg-red-alliance/90"
                          : "bg-blue-alliance text-white hover:bg-blue-alliance/90"
                        : ""
                    }
                  >
                    {a.toUpperCase()}
                  </Button>
                ))}
                {(["1", "2"] as Slot[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={activeSlot === s ? "default" : "outline"}
                    onClick={() => setActiveSlot(s)}
                  >
                    Slot {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <SliderRow
                label="Autonomous artifacts"
                hint={`${AUTO_PER_ARTIFACT} pts each`}
                value={current.autoArtifacts}
                min={0}
                max={10}
                onChange={(v) => setCurrent({ autoArtifacts: v })}
              />
              <SliderRow
                label="Teleop artifacts"
                hint={`${TELEOP_PER_ARTIFACT} pts each · watch for interference`}
                value={current.teleopArtifacts}
                min={0}
                max={40}
                onChange={(v) => setCurrent({ teleopArtifacts: v })}
              />
              <SliderRow
                label="Gate unlock time (s into teleop)"
                hint="Earlier unlock → bigger bonus"
                value={current.gateUnlockSec}
                min={5}
                max={90}
                onChange={(v) => setCurrent({ gateUnlockSec: v })}
              />
              <SliderRow
                label="Obelisk patterns completed"
                hint="Multiplies pattern bonus"
                value={current.patternsCompleted}
                min={0}
                max={3}
                onChange={(v) => setCurrent({ patternsCompleted: v })}
              />

              <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
                <div>
                  <Label className="text-sm">Endgame Ascent</Label>
                  <p className="text-xs text-muted-foreground">None 0 · Low 5 · High 15</p>
                </div>
                <div className="flex gap-1">
                  {(["none", "low", "high"] as const).map((lvl) => (
                    <Button
                      key={lvl}
                      size="sm"
                      variant={current.endgameAscent === lvl ? "default" : "outline"}
                      onClick={() => setCurrent({ endgameAscent: lvl })}
                    >
                      {lvl}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-5">
            <h2 className="font-semibold mb-4">Obelisk Pattern</h2>
            <div className="grid gap-2">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPattern(p.id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    pattern === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/40 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PatternGlyph id={p.id} />
                    <span className="text-sm">{p.label}</span>
                  </div>
                  <Badge variant="secondary">+{p.bonus} pts</Badge>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: results */}
        <section className="space-y-6">
          <AllianceCard alliance="red" data={breakdown.red} />
          <AllianceCard alliance="blue" data={breakdown.blue} />

          <div className="rounded-xl border border-border bg-secondary/30 p-5">
            <h3 className="font-semibold mb-2">Coordination Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Stack teleop targets above ~14 per robot and partners start colliding on the field.</li>
              <li>Unlocking the gate before 30s into teleop maximizes the timing bonus.</li>
              <li>Pattern bonus scales linearly with patterns completed — split roles to chase multiple.</li>
              <li>Endgame ascent often decides close matches: low (+5) is the safe default, high (+15) needs practice.</li>
            </ul>
          </div>
        </section>
      </div>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Unofficial planning tool · DECODE scoring model is configurable in code
      </footer>
    </main>
  );
}

function ScoreBadge({ alliance, value }: { alliance: Alliance; value: number }) {
  const color = alliance === "red" ? "text-red-alliance" : "text-blue-alliance";
  return (
    <div className="flex flex-col items-end">
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {alliance}
      </span>
    </div>
  );
}

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm tabular-nums text-primary font-semibold">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function PatternGlyph({ id }: { id: PatternId }) {
  const map: Record<PatternId, string[]> = {
    GPP: ["g", "p", "p"],
    PGP: ["p", "g", "p"],
    PPG: ["p", "p", "g"],
    GGG: ["g", "g", "g"],
    NONE: ["x", "x", "x"],
  };
  return (
    <div className="flex gap-1">
      {map[id].map((c, i) => (
        <span
          key={i}
          className={`size-4 rounded-sm border border-border ${
            c === "g"
              ? "bg-primary"
              : c === "p"
                ? "bg-accent"
                : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function AllianceCard({
  alliance,
  data,
}: {
  alliance: Alliance;
  data: {
    r1: ReturnType<typeof scoreRobot>;
    r2: ReturnType<typeof scoreRobot>;
    penalty: number;
    total: number;
  };
}) {
  const accent =
    alliance === "red" ? "border-red-alliance/60 bg-red-alliance/5" : "border-blue-alliance/60 bg-blue-alliance/5";
  const labelColor = alliance === "red" ? "text-red-alliance" : "text-blue-alliance";
  const rows = [
    ["Slot 1 auto", data.r1.auto],
    ["Slot 1 teleop", data.r1.teleop],
    ["Slot 1 gate", data.r1.gate],
    ["Slot 1 ascent", data.r1.ascent],
    ["Slot 1 pattern", data.r1.patternBonus],
    ["Slot 2 auto", data.r2.auto],
    ["Slot 2 teleop", data.r2.teleop],
    ["Slot 2 gate", data.r2.gate],
    ["Slot 2 ascent", data.r2.ascent],
    ["Slot 2 pattern", data.r2.patternBonus],
  ] as const;
  return (
    <div className={`rounded-xl border p-5 ${accent}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold uppercase tracking-widest ${labelColor}`}>
          {alliance} Alliance
        </h3>
        <span className="text-2xl font-bold tabular-nums">{data.total}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-border/40 py-1">
            <span className="text-muted-foreground">{k}</span>
            <span className="tabular-nums">{v}</span>
          </div>
        ))}
        <div className="col-span-2 flex justify-between pt-2 text-destructive">
          <span>Interference penalty</span>
          <span className="tabular-nums">−{data.penalty}</span>
        </div>
      </div>
    </div>
  );
}