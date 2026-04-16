# Roguelike Card System Plan

## 1) Goal Of Cards

Cards are panic choices and build choices.
They should help the player survive spikes, especially near high scores where the factory feels overwhelming.

Card goals:
1. Give breathing room during danger spikes.
2. Add meaningful choices instead of pure reflex play.
3. Keep runs different through random card drafts.
4. Avoid free wins by attaching tradeoffs to strongest effects.

## 2) Draft Timing Strategy (Hybrid)

Use all three signals, with clear priority:
1. Emergency trigger (highest priority).
2. Score milestone trigger.
3. Time pity trigger.

### 2.1 Emergency Trigger

Draft appears if pressure stays high long enough.

Suggested rule:
1. Calculate Pressure every 0.5 seconds.
2. If Pressure >= 0.72 for at least 2.0 seconds, trigger a draft.
3. Respect a minimum cooldown between drafts.

Suggested Pressure formula:

Pressure = 0.35 MainFill + 0.25 IntakeBlock + 0.20 JamLoad + 0.20 SpeedStress

Where each term is normalized between 0 and 1.

### 2.2 Score Milestone Trigger

Draft appears at fixed score steps.

Suggested rule:
1. Trigger at every 6000 score.
2. Example checkpoints: 6000, 12000, 18000, 24000, 30000.

### 2.3 Time Pity Trigger

Draft appears if no choices have shown for too long.

Suggested rule:
1. If no draft for 75 seconds and Pressure >= 0.45, trigger a draft.

### 2.4 Safety Rules

1. Global draft cooldown: 18 seconds.
2. Never trigger a second draft while one is open.
3. During high pressure (>= 0.75), guarantee at least one Rescue card in the 3 choices.

## 3) Card Types

Use three archetypes so each draft has tension:
1. Rescue: immediate survival and reset tools.
2. Control: board cleanup or flow control.
3. Greed: stronger scoring or speed upside with risk.

Draft composition rule:
1. Slot A: Rescue or Control.
2. Slot B: Control or Greed.
3. Slot C: Any type, weighted by pressure and run stage.

## 4) Card Catalog (Initial)

### 4.1 Rescue Cards

#### Card R1: Coolant Flush
- Effect: instantly set main and side speeds to base speed.
- Duration: lock at base for 10 seconds.
- Recovery: ramp back to normal scaling over 8 seconds.
- Tradeoff: multiplier set to x1.

#### Card R2: Smart Sort Protocol
- Effect: analyze all active items, route each to correct lane, clear main belt.
- Extra: unjam one wrong item per lane if possible.
- Tradeoff: no score gain for 6 seconds.

#### Card R3: Emergency Brake
- Effect: 45 percent global slow motion for 7 seconds.
- Tradeoff: next 12 spawned items give -20 percent score.

#### Card R4: Overflow Purge
- Effect: remove up to 5 oldest jammed items.
- Tradeoff: lose flat points equal to 250 plus 30 per removed item.

### 4.2 Control Cards

#### Card C1: Inserter Calibration
- Effect: transfer claws choose correct lane bias for 14 seconds.
- Tradeoff: side belt speed reduced by 10 percent during effect.

#### Card C2: Belt Rephase
- Effect: side belt spacing tolerance increases for 12 seconds.
- Result: fewer instant pileups from near-touching items.
- Tradeoff: main belt speed +8 percent while active.

#### Card C3: Chest Priority Mode
- Effect: each chest temporarily accepts one wrong item without jamming.
- Charges: 1 grace accept per chest over 15 seconds.
- Tradeoff: consume score for grace items is zero.

#### Card C4: Predictive Pull
- Effect: next 20 spawns have improved lane balancing weight.
- Tradeoff: spawn interval decreases by 8 percent during the effect.

### 4.3 Greed Cards

#### Card G1: Turbo Shift
- Effect: +25 percent score gain for 18 seconds.
- Tradeoff: +18 percent speed on all belts.

#### Card G2: Combo Furnace
- Effect: multiplier gains are doubled for 14 seconds.
- Tradeoff: one jam resets multiplier and applies -200 points.

#### Card G3: Risky Throughput
- Effect: spawn rate increases by 25 percent for 16 seconds.
- Reward: each correct chest consume grants bonus +2 flat score.

#### Card G4: Fragile Jackpot
- Effect: instant +1200 score.
- Tradeoff: next 10 seconds have no drag slow motion assist.

## 5) Balance Rules

1. Strong rescue cards cannot appear in consecutive drafts.
2. Maximum top-tier rescue picks per run: 3.
3. Card rarity weights should shift over time:
4. Early run favors Control.
5. Mid run mixes all types.
6. Late run raises Rescue and Greed frequency.

Suggested rarity buckets:
1. Common: 60 percent.
2. Rare: 30 percent.
3. Epic: 10 percent.

## 6) Data Shape For Implementation

Use a consistent data model so cards are easy to add one-by-one.

Suggested fields:
1. id
2. name
3. archetype
4. rarity
5. triggerTags
6. description
7. durationMs
8. apply(scene)
9. canAppear(scene)
10. cooldownMs

## 7) MVP Implementation Order (One By One)

### Phase 1: Framework
1. Add Draft Manager.
2. Add Pressure calculation.
3. Add trigger system (Emergency, Score, Pity).
4. Add simple 3-card modal UI.

### Phase 2: First Lifesaver Cards
1. Implement Coolant Flush.
2. Implement Smart Sort Protocol.

### Phase 3: Control Layer
1. Implement Inserter Calibration.
2. Implement Chest Priority Mode.

### Phase 4: Greed Layer
1. Implement Turbo Shift.
2. Implement Combo Furnace.

### Phase 5: Expand Catalog
1. Add remaining cards from this plan.
2. Tune rarity weights and tradeoffs from playtest data.

## 8) Acceptance Criteria For Each Card

For each new card implemented:
1. Effect starts and ends correctly.
2. Tradeoff is visible and testable.
3. Card cannot trigger invalid states.
4. Card does not break game-over logic.
5. Card has readable name and one-line summary.

## 9) First Playtest Focus

1. Are emergency drafts showing when pressure feels bad.
2. Are score milestone drafts too frequent or too sparse.
3. Do lifesaver cards create relief without removing challenge.
4. Does card choice feel clear in under 2 seconds.
5. At around 30000 score, does player still have comeback options.
