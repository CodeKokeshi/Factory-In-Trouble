# Touch-Only Machines Variety Continuation Plan

Date: 2026-04-19
Project: Machines Phaser
Depends On: TOUCH_ONLY_MACHINES_VARIETY_PLAN.md

## 1) Why It Can Still Feel Boring Even After Incidents

Incidents help, but boredom returns if the run still has one dominant thought:
1. Fix wrong item.
2. Repeat until quota.

To feel less repetitive, the player needs changing priorities, not only changing threats.

Core issue:
1. Current loop is mostly reactive.
2. Factorio feels good because it is reactive plus planning plus optimization.

## 2) Factorio DNA To Borrow (Without Making Factorio)

Do not copy building systems.
Copy the feelings:
1. I diagnose a bottleneck.
2. I choose a throughput tradeoff.
3. My machine behavior changes because of my choice.
4. I feel smarter on the next run.

## 3) New Core Loop (Touch-Only)

Use this loop every run:
1. Plan: pick simple machine policies before shift.
2. React: handle incidents and mistakes during shift.
3. Optimize: chase rotating production contracts, not only quota.
4. Cash Out: pick one upgrade that changes next run behavior.

This creates variety without keyboard complexity.

## 4) High-Impact Systems Beyond Incidents

## 4.1 Rotating Contracts (Biggest Boredom Killer)

Why this matters:
Quota alone says "do more".
Contracts say "do different".

Contract board rules:
1. Keep base quota.
2. Add 1 active contract at a time.
3. New contract appears after completion or timeout.
4. Contract duration: 18 to 30 seconds.

Contract examples:
1. Clean Batch: deliver 8 correct items with zero jams.
2. Protein Rush: deliver 6 protein in 15 seconds.
3. Balanced Output: deliver 2 of each food type.
4. Chain Order: deliver 5 items to alternating sides.
5. Priority Chest: keep one target chest fed for 10 seconds.

Reward:
1. Score bonus.
2. Maintenance Stars.
3. Temporary machine buff.

Result:
Player focus changes every 20 seconds, which kills monotony.

## 4.2 Pre-Shift Policy Chips (Factorio Feel In 10 Seconds)

Before run starts, player chooses 2 chips from 3 random options.
Touch only:
1. Tap to inspect.
2. Tap to equip.

Chip examples:
1. Lane Priority Firmware: chosen chest gets +20 percent intake preference; tradeoff is slightly lower claw attention on the opposite side.
2. Anti-Jam Servo: first jam in each lane auto-clears once; tradeoff is lower combo gain while active.
3. Smart Filter Arm: inserters bias toward correct lane when possible; tradeoff is slower transfer animation.
4. Emergency Overflow Gate: if lane is packed, next item reroutes to a secondary lane; tradeoff is potential downstream cleanup work.

This is the easiest way to add strategy without adding building.

## 4.3 Lane Gadgets (Mid-Run Agency)

Give player 1 to 2 gadget charges per run.
Touch only:
1. Drag gadget icon onto lane.

Gadget examples:
1. Pocket Buffer: holds one blocking item for 5 seconds, then returns it.
2. Micro Deflector: redirects the next 2 items on that lane.
3. Stabilizer Pulse: prevents claw breakdown on one lane for 8 seconds.

Design value:
1. Player can actively shape flow, not only clean up mistakes.
2. Feels closer to machine operations, not only sorting.

## 4.4 Shift Modifiers With Real Tradeoffs

Keep one run modifier per run, but make it gameplay-defining.

Examples:
1. High Throughput Mandate: faster belts, higher contract rewards, tougher incidents.
2. Safety Audit Mode: slower belts, harsher jam penalties, larger clean-batch rewards.
3. Energy Saver Mode: fewer incidents, but lower base score and tighter contracts.

This creates run identity and replay value.

## 4.5 Meta Progression That Changes Decisions

After each run, choose 1 upgrade from 3.
No keyboard, just tap.

Upgrade trees:
1. Inserter Tree: faster pickup, better target bias, faster recovery from breakdown.
2. Belt Tree: more spacing tolerance, higher lane capacity, lower jam propagation.
3. Control Tree: more gadget charges, better contract rerolls, stronger safety tools.

Rule:
1. Upgrades should change playstyle, not only add raw numbers.

## 4.6 "Factory Supervisor" Calls (Macro Events)

Every 45 to 60 seconds, supervisor issues one macro objective.

Examples:
1. Keep all lanes unjammed for 12 seconds.
2. Fill left-side chests only for 10 seconds.
3. Complete one contract before timer hits zero.

Why:
1. Macro objective reframes the same board state.
2. Strongly reduces repetitive feel.

## 5) Touch-Only Input Map (No Keyboard Needed)

Keep controls simple:
1. Drag item to lane.
2. Tap incidents (drones, beetles).
3. Tap chip selections before run.
4. Drag gadget to lane.
5. Tap one of two contract reroll options (if offered).

Optional future inputs:
1. Hold for advanced repair.
2. Swipe for emergency cuts.

## 6) Recommended Expansion Package (Most Value For Scope)

If you add only three things after incidents, add these:
1. Rotating Contracts.
2. Pre-Shift Policy Chips.
3. Lane Gadgets.

Why this trio wins:
1. Contracts add changing objectives.
2. Chips add planning identity.
3. Gadgets add direct control during chaos.

Together they create the missing Factorio-inspired depth.

## 7) Concrete 2-Minute Shift Example

0s to 10s:
1. Player equips Smart Filter Arm + Anti-Jam Servo.
2. Contract appears: Balanced Output 2 of each.

10s to 40s:
1. Normal sorting plus one beetle incident.
2. Player taps beetle, keeps contract pace.

40s to 70s:
1. Claw Breakdown starts.
2. Player uses Pocket Buffer on overloaded lane.
3. Contract switches to Protein Rush.

70s to 110s:
1. Drone appears, player kills it quickly.
2. Supervisor call: keep all lanes unjammed for 12 seconds.

110s to 120s:
1. Player finishes quota and last contract.
2. End screen offers one upgrade choice for next run.

This feels like machine operations, not only repetitive drag-and-drop.

## 8) Implementation Roadmap (Continuation)

Phase A:
1. Add rotating contract system.
2. Add contract UI strip and rewards.

Phase B:
1. Add pre-shift chip draft (pick 2 of 3).
2. Implement 3 starter chips only.

Phase C:
1. Add gadget tray with 2 gadget types.
2. Add drag-to-lane deploy behavior.

Phase D:
1. Add post-run upgrade pick.
2. Add 6 to 9 upgrades split across 3 trees.

## 9) Guardrails To Prevent Feature Bloat

1. Max 1 active contract at once.
2. Max 2 equipped chips.
3. Max 2 gadget types in first implementation.
4. Max 1 run modifier active.
5. Max 3 choices shown in any single selection UI.

This keeps touch readability and jam deliverability intact.

## 10) Final Direction

If the team is fatigued, do this order only:
1. Contracts first.
2. Chips second.
3. Gadgets third.

Even without more content, this alone will make the game feel significantly less repetitive while preserving the Machines and Factorio-inspired identity.
