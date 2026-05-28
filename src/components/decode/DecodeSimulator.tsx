import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
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

  const [robots, setRobots] = useState({
    redSlot1: defaultRobot(0),
    redSlot2: defaultRobot(-1),
    blueSlot1: defaultRobot(0),
    blueSlot2: defaultRobot(-1),
  });

  const currentKey =
    `${activeAlliance}Slot${activeSlot}` as keyof typeof robots;
  const current = robots[currentKey];
  const setCurrent = (patch: Partial<RobotPlan>) =>
    setRobots((prev) => ({
      ...prev,
      [currentKey]: { ...prev[currentKey], ...patch },
    }));

  console.log("MatchStrategySimulator state", {
    activeAlliance,
    activeSlot,
    pattern,
    robots,
    currentKey,
  });

  const breakdown = useMemo(() => {
    const r1 = scoreRobot(robots.redSlot1, pattern);
    const r2 = scoreRobot(robots.redSlot2, pattern);
    const b1 = scoreRobot(robots.blueSlot1, pattern);
    const b2 = scoreRobot(robots.blueSlot2, pattern);
    const redPenalty = interferencePenalty(robots.redSlot1, robots.redSlot2);
    const bluePenalty = interferencePenalty(robots.blueSlot1, robots.blueSlot2);
    return {
      red: { r1, r2, penalty: redPenalty, total: r1.total + r2.total - redPenalty },
      blue: { r1: b1, r2: b2, penalty: bluePenalty, total: b1.total + b2.total - bluePenalty },
    };
  }, [robots, pattern]);

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
          <AllianceCard
            alliance="red"
            data={breakdown.red}
            activeAlliance={activeAlliance}
            activeSlot={activeSlot}
          />
          <AllianceCard
            alliance="blue"
            data={breakdown.blue}
            activeAlliance={activeAlliance}
            activeSlot={activeSlot}
          />

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
  activeAlliance,
  activeSlot,
}: {
  alliance: Alliance;
  data: {
    r1: ReturnType<typeof scoreRobot>;
    r2: ReturnType<typeof scoreRobot>;
    penalty: number;
    total: number;
  };
  activeAlliance: Alliance;
  activeSlot: Slot;
}) {
  const accent =
    alliance === "red" ? "border-red-alliance/60 bg-red-alliance/5" : "border-blue-alliance/60 bg-blue-alliance/5";
  const labelColor = alliance === "red" ? "text-red-alliance" : "text-blue-alliance";
  const activeSlotInThisAlliance = activeAlliance === alliance ? activeSlot : null;
  const slotBreakdowns = {
    slot1: data.r1,
    slot2: data.r2,
  };
  const rows = [
    { key: "slot1-auto", slot: "1" as const, label: "Slot 1 auto", value: slotBreakdowns.slot1.auto },
    { key: "slot1-teleop", slot: "1" as const, label: "Slot 1 teleop", value: slotBreakdowns.slot1.teleop },
    { key: "slot1-gate", slot: "1" as const, label: "Slot 1 gate", value: slotBreakdowns.slot1.gate },
    { key: "slot1-ascent", slot: "1" as const, label: "Slot 1 ascent", value: slotBreakdowns.slot1.ascent },
    { key: "slot1-pattern", slot: "1" as const, label: "Slot 1 pattern", value: slotBreakdowns.slot1.patternBonus },
    { key: "slot2-auto", slot: "2" as const, label: "Slot 2 auto", value: slotBreakdowns.slot2.auto },
    { key: "slot2-teleop", slot: "2" as const, label: "Slot 2 teleop", value: slotBreakdowns.slot2.teleop },
    { key: "slot2-gate", slot: "2" as const, label: "Slot 2 gate", value: slotBreakdowns.slot2.gate },
    { key: "slot2-ascent", slot: "2" as const, label: "Slot 2 ascent", value: slotBreakdowns.slot2.ascent },
    { key: "slot2-pattern", slot: "2" as const, label: "Slot 2 pattern", value: slotBreakdowns.slot2.patternBonus },
  ];
  return (
    <div className={`rounded-xl border p-5 ${accent}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold uppercase tracking-widest ${labelColor}`}>
          {alliance} Alliance
        </h3>
        <span className="text-2xl font-bold tabular-nums">{data.total}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {rows.map((row) => (
          <ScoreLineItem
            key={row.key}
            label={row.label}
            value={row.value}
            highlight={row.slot === activeSlotInThisAlliance}
            allianceTone={alliance}
          />
        ))}
        <ScoreLineItem label="Interference penalty" value={-data.penalty} emphasizeDestructive />
      </div>
    </div>
  );
}

function ScoreLineItem({
  label,
  value,
  emphasizeDestructive = false,
  highlight = false,
  allianceTone = "red",
}: {
  label: string;
  value: number;
  emphasizeDestructive?: boolean;
  highlight?: boolean;
  allianceTone?: Alliance;
}) {
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;

    setFlash(true);
    prevValue.current = value;
    const timeout = setTimeout(() => setFlash(false), 450);
    return () => clearTimeout(timeout);
  }, [value]);

  const slotHighlightClass = highlight
    ? allianceTone === "red"
      ? "bg-red-alliance/10 border border-red-alliance/40 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]"
      : "bg-blue-alliance/10 border border-blue-alliance/40 shadow-[0_0_0_1px_rgba(59,130,246,0.22)]"
    : "border border-transparent";

  return (
    <div
      className={`col-span-2 flex justify-between border-b border-border/40 py-1 px-1 rounded-sm transition-colors duration-500 ${
        flash ? "bg-primary/15" : "bg-transparent"
      } ${slotHighlightClass} ${emphasizeDestructive ? "text-destructive pt-2 border-b-0" : ""}`}
    >
      <span className={emphasizeDestructive ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}