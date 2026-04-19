# Level Design Plan (Finite Campaign + Endless)

Date: 2026-04-17
Project: Machines Phaser

## 1) Goals

1. Keep the current machine fantasy: conveyor chaos + player rescue.
2. Add finite levels with clear completion goals.
3. Preserve current endless gameplay as a separate mode.
4. Avoid repeating the exact same layout every level.
5. Support 2-way, 3-way, and full 4-way food routing.

## 2) Shared Terms

1. Food Packaged: total accepted items consumed by chests.
2. Quota: target Food Packaged value required to clear the level.
3. Finite Level End: level ends immediately when quota is reached.
4. Endless Mode End: no quota; run ends only on clog failure.
5. Meat in design notes maps to Protein in code/data.

## 3) Core Rule Set For Finite Levels

### 3.1 Win Condition

1. Reach quota for the level.
2. Example: quota 100 means acceptedCount must reach 100.

### 3.2 Lose Condition

Use current fail behavior to stay consistent with existing gameplay:

1. Full system clog persists beyond grace window.
2. Optional future tuning: strict time limit per level (off by default).

### 3.3 Quota Ramp

Use a clean early formula first, then tune after playtests:

1. Level 1 quota: 50
2. Level 2 quota: 100
3. Level n quota: n x 50 for campaign pass v1

Examples:

1. L3 = 150
2. L4 = 200
3. L10 = 500

## 4) Layout Language

Current baseline is a rotated H. Keep it as layout family A, then add variants.

### 4.1 Layout A: Rotated H (Main Belt)

One central main belt with side splits.

```text
            Spawn
              |
              v
      <- Lane A [M] Lane B ->
              |
      <- Lane C [M] Lane D ->
              |
              v
            Exit
```

### 4.2 Layout B: Reverse Rotated H

Same shape, reversed main flow (bottom to top) with split taps.

```text
            Exit
              ^
      <- Lane A [M] Lane B ->
              ^
      <- Lane C [M] Lane D ->
              ^
            Spawn
```

### 4.3 Layout C: E Shape

One spine + multiple side belts in same direction.

```text
Spawn -> Spine
          |--> Lane A ---> Chest
          |--> Lane B ---> Chest
          |--> Lane C ---> Chest
```

Design purpose:

1. Strong directional bias.
2. Good for teaching lane-priority decisions.

### 4.4 Layout D: V Shape (No Main Belt)

No central spine. Two (or three) incoming feeders meet at a swap zone.

```text
Feeder L --->\
              > Swap Hub -> Output lanes -> Chests
Feeder R --->/
```

Design purpose:

1. Heavy on player swapping skill.
2. Great for 2-way and 3-way puzzle pressure.

### 4.5 Layout Variation Rules (Anti-Repetition)

1. Never repeat exact layout id on back-to-back levels.
2. Alternate main flow direction every 1 to 2 levels when main belt exists.
3. Use mirrored variants (left-right flip) as separate playable variants.
4. For each level, keep at least 2 layout variants in pool.

## 5) Food Matchup Tiers

### 5.1 Tier 1: 2-Way Levels (Requested Start)

1. Active food types: 2
2. Active side belts: 2
3. Main belt: present except V-shape levels

Mandatory first order from request:

1. Level 1: Greens vs Protein (Meat)
2. Level 2: Carbs vs Condiments
3. Level 3: Carbs vs Greens
4. Level 4: Carbs vs Protein (Meat)

### 5.2 Tier 2: 3-Way Levels

1. Active food types: 3
2. Active side belts: 3
3. Include requested example set: Carbs vs Protein vs Condiments

### 5.3 Tier 3: 4-Way Levels

1. Active food types: all 4
2. Active side belts: all 4
3. Use as late campaign challenge before endless.

## 6) Campaign Blueprint (V1)

This gives a concrete starting sequence for design and balancing.

| Level | Food Matchup | Layout Family | Main Flow | Active Belts | Quota |
| --- | --- | --- | --- | --- | --- |
| L1 | Greens vs Protein | Rotated H Lite | Top -> Bottom | 1 main + 2 side | 50 |
| L2 | Carbs vs Condiments | Rotated H Lite (Mirrored) | Top -> Bottom | 1 main + 2 side | 100 |
| L3 | Carbs vs Greens | Reverse Rotated H Lite | Bottom -> Top | 1 main + 2 side | 150 |
| L4 | Carbs vs Protein | E Shape Lite | Top -> Bottom | 1 spine + 2 side | 200 |
| L5 | Condiments vs Greens | V Shape 2-Way | Split Feeders | 0 main + 2 outputs | 250 |
| L6 | Condiments vs Protein | Reverse E Lite | Bottom -> Top | 1 spine + 2 side | 300 |
| L7 | Carbs vs Protein vs Condiments | Rotated H 3-Lane | Top -> Bottom | 1 main + 3 side | 350 |
| L8 | Carbs vs Greens vs Condiments | Reverse Rotated H 3-Lane | Bottom -> Top | 1 main + 3 side | 400 |
| L9 | Carbs vs Greens vs Protein | E Shape 3-Lane | Top -> Bottom | 1 spine + 3 side | 450 |
| L10 | Condiments vs Greens vs Protein | V Shape 3-Way | Split Feeders | 0 main + 3 outputs | 500 |
| L11 | All 4 Types | Rotated H Full | Top -> Bottom | 1 main + 4 side | 550 |
| L12 | All 4 Types | Reverse Rotated H Full | Bottom -> Top | 1 main + 4 side | 600 |

Notes:

1. Lite means unused lanes are disabled and visually blocked.
2. Full means all four chest lanes active.
3. L11 and L12 act as campaign finals before endless unlock.

## 7) Per-Level Layout Spec Template

Use this template for each authored level file/data object.

```yaml
id: L01
mode: finite
foods: [greens, protein]
quota: 50
layoutFamily: rotated_h
layoutVariantPool: [rh_lite_a, rh_lite_b_mirror]
mainFlowDirection: down
activeLaneIds: [mid_left, mid_right]
chestMapping:
  mid_left: greens
  mid_right: protein
spawn:
  baseIntervalMs: 900
  minIntervalMs: 420
  errorRateStart: 0.10
  errorRateEnd: 0.22
difficultyCurve: gentle
```

## 8) Difficulty Tuning Pass (Initial)

For now, keep mechanics unchanged and tune with numbers only.

### 8.1 Tier 1 (L1-L6)

1. Spawn rate: slow to medium.
2. Error rate: low to medium.
3. Jam grace: forgiving.

### 8.2 Tier 2 (L7-L10)

1. Spawn rate: medium to fast.
2. Error rate: medium to high.
3. Jam grace: standard.

### 8.3 Tier 3 (L11-L12)

1. Spawn rate: fast.
2. Error rate: high.
3. Jam grace: strict.

## 9) Endless Mode Plan

### 9.1 Endless Level Definition

1. Use the current implemented level as endless baseline.
2. Keep current 4-type, 4-lane rotated-H behavior.
3. No quota cap.
4. Ends only when system fully clogs.

### 9.2 Endless Leaderboard Plan (itch.io)

Two practical options:

Option A: Local/Fake Leaderboard (fastest)

1. Store top 10 scores in localStorage.
2. Show label: Local Device Scores.
3. Add reset button in settings.
4. Good for jam demo, not cross-device.

Option B: Real Online Leaderboard (recommended)

1. Use a tiny backend (Supabase or LootLocker).
2. Submit playerName + score + runTime + packagedCount.
3. Validate score server-side with sanity checks.
4. Show global top scores in endless menu.
5. Works for itch.io web deploy.

Recommendation:

1. Start with Option A so endless ships fast.
2. Upgrade to Option B when backend is ready.

## 10) Layout Authoring Checklist

For every new level, verify:

1. Matchup is clear from UI labels and chest colors.
2. Active lanes match intended food count (2, 3, or 4).
3. Flow direction is obvious at a glance.
4. Quota is visible on HUD.
5. Level ends immediately on quota hit.
6. No duplicate layout id from previous level.

## 11) Development Phases For Implementation

This is the practical build sequence for coding the plan in controlled steps.

### Phase 0: Data Contract And Mode Split (0.5 to 1 day)

Goal:

1. Define level data shape once so all later phases use one contract.

Work:

1. Create a simple level config module (example: src/data/levels.js).
2. Add mode flags: campaign, endless.
3. Add schema fields from section 7 template (foods, quota, layoutFamily, flow, lane mapping, spawn profile).
4. Add one endless preset entry that mirrors current gameplay.

Exit Criteria:

1. Game can boot into campaign or endless mode using config only.
2. Endless behavior matches current baseline.

### Phase 1: Finite Quota Loop (1 day)

Goal:

1. Make levels end by quota instead of endless survival.

Work:

1. Add per-level quota tracker and HUD display (Food Packaged / Quota).
2. Trigger level clear when acceptedCount >= quota.
3. Add level clear state panel (continue, retry, menu).
4. Keep existing clog fail state unchanged.

Exit Criteria:

1. L1 can start, fill quota, and cleanly transition to clear screen.
2. No regressions to existing game-over behavior.

### Phase 2: Layout Engine (1 to 2 days)

Goal:

1. Support multiple layout families without duplicating scene logic.

Work:

1. Parameterize belt/chest/claw positions from layout data.
2. Implement layout families in order: Rotated H, Reverse H, E, V.
3. Implement mainFlowDirection toggle (down/up) for applicable layouts.
4. Add lane activation masks so 2-way and 3-way can disable unused lanes.

Exit Criteria:

1. Same scene can render and run all four layout families.
2. Reverse flow works without one-off hacks.

### Phase 3: Early Campaign Content (L1 to L4) (1 day)

Goal:

1. Ship requested opening progression first.

Work:

1. Author L1-L4 in this exact order:
2. L1 Greens vs Protein (quota 50).
3. L2 Carbs vs Condiments (quota 100).
4. L3 Carbs vs Greens (quota 150).
5. L4 Carbs vs Protein (quota 200).
6. Apply layout variation rule (no identical layout back-to-back).

Exit Criteria:

1. Player can complete L1-L4 sequentially in campaign flow.
2. Matchups and quotas display correctly each level.

### Phase 4: Mid Campaign Expansion (L5 to L10) (1 to 2 days)

Goal:

1. Add layout diversity and 3-way versus levels.

Work:

1. Implement and author L5-L6 (remaining 2-way variants).
2. Implement and author L7-L10 (3-way variants), including Carbs vs Protein vs Condiments.
3. Tune spawn/error profiles by tier from section 8.

Exit Criteria:

1. 3-way levels are fully playable and readable.
2. Campaign pacing escalates without sudden unfair spike.

### Phase 5: Final Campaign Tier (L11 to L12) (0.5 to 1 day)

Goal:

1. Finish campaign with full 4-way challenge and unlock endless.

Work:

1. Author L11 (Rotated H Full) and L12 (Reverse Rotated H Full).
2. Add campaign completion state and unlock Endless button.
3. Persist unlocked progress locally.

Exit Criteria:

1. Campaign can run from L1 to L12 in one profile.
2. Endless unlocks only after campaign complete (or debug bypass).

### Phase 6: Endless Integration + Leaderboard V1 (0.5 to 1 day)

Goal:

1. Preserve current endless as separate polished mode with score history.

Work:

1. Route endless mode to current baseline config.
2. Implement local leaderboard (top 10 via localStorage).
3. Add run summary (score, time survived, packaged count).

Exit Criteria:

1. Endless start/run/end flow is independent from campaign.
2. Scores persist after reload on same device.

### Phase 7: Leaderboard V2 Online (Optional Post-Jam) (1 to 2 days)

Goal:

1. Replace local-only ranking with real cross-device board for itch.io.

Work:

1. Choose backend (Supabase or LootLocker).
2. Add submit API and fetch top scores.
3. Add basic anti-cheat sanity checks (score/time thresholds, payload validation).
4. Keep local fallback if network fails.

Exit Criteria:

1. Global leaderboard entries appear consistently on web build.
2. Failed network does not block gameplay.

### Phase 8: Balance, QA, And Release Prep (1 day)

Goal:

1. Make progression fair and stable before publishing.

Work:

1. Run focused balance pass on quota, spawn, and error rates.
2. Verify anti-repetition layout rule across all levels.
3. Regression check for drag controls, card system, and fail/win transitions.
4. Finalize release notes and known issues list.

Exit Criteria:

1. No blocker bugs in full campaign + endless.
2. Difficulty curve feels intentional from L1 through L12.

### Recommended Execution Order Summary

1. Do not author all 12 levels first.
2. Build engine features first (Phase 0-2), then content (Phase 3-5).
3. Keep endless stable in parallel and add leaderboard after campaign core.

## 12) Decisions Locked By This Plan

1. Finite campaign uses quota, not time, as primary clear condition.
2. L1 quota is 50, L2 quota is 100, then +50 per level for v1.
3. Reverse-flow levels are official and required.
4. 3-way versus levels are required before campaign end.
5. Endless mode is the current existing layout.
