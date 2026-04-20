# Touch-Only Machines Variety Plan

Date: 2026-04-19
Project: Machines Phaser

## 1) Problem To Solve

By level 3+, the player has already learned the core action:
1. See wrong item.
2. Drag to correct lane.
3. Repeat.

If only speed and quota increase, challenge rises but novelty does not.

Goal:
1. Keep the same core sorting fantasy.
2. Add short machine incidents that force different touch decisions.
3. Preserve readability and jam-safe scope.

## 2) Design Rules (Strict)

1. Touch-only input.
2. No keyboard-only mechanics.
3. Locked build uses tap and drag only.
4. Hold and swipe are future-only options.
5. All incidents must be 2 to 8 seconds long.
6. No mechanic should permanently alter rules without clear UI.
7. Sorting remains the main score source.

## 3) Variety Framework: "Factory Incident System"

Instead of only increasing speed, inject tiny machine incidents.

Incident loop:
1. Every 12 to 20 seconds, roll an incident.
2. Never repeat the same incident twice in a row.
3. Duration 3 to 8 seconds.
4. Resolve gives a small bonus.
5. Ignore or fail gives a temporary penalty.

Why this works:
1. Same core game, but moment-to-moment priorities change.
2. Player gets micro-objectives beyond sorting.
3. Touch interaction stays simple.

## 4) Final Incident Set (Touch-Only)

This is the locked set for now:
1. Saboteur Drones.
2. Jam Beetles (space blockers, not speed debuff).
3. Claw Breakdown (1 to 2 claws still active).

## 4.1 Saboteur Drones (Your Idea, Expanded)

Theme:
Rogue maintenance bots enter and reroute food to wrong lanes.

Player interaction:
1. Tap drone 1 to 3 times before it reaches a lane node.
2. Each tap damages it.
3. Final tap destroys it.

If player succeeds:
1. Drone explodes.
2. Nearby items get brief "stabilized" buff (no wrong reroute for 2 seconds).
3. Small score bonus.

If player fails:
1. Drone grabs the nearest correct item.
2. It throws item into a wrong lane.
3. That item gets red warning outline for readability.

Anti-frustration rules:
1. Max 1 active drone at early levels, 2 at late levels.
2. Spawn only when at least one correct item is available.
3. Drone speed scales softly, not sharply.

## 4.2 Jam Beetles (Machine Pests)

Theme:
Tiny metal beetles crawl onto belts and act as physical blockers.

Player interaction:
1. Tap beetle to squash.

If ignored:
1. Beetle occupies a belt slot and behaves like a natural jammer.
2. Because it has no valid chest destination, it permanently blocks flow until killed.
3. Up to 2 beetles can exist at once in early game, up to 3 in late game.

Readability rule:
1. Every beetle gets a pulsing exclamation marker above it.
2. Exclamation color uses danger red-orange for fast recognition.

If squashed:
1. Belt slot is immediately freed.
2. Bonus particles and tiny score pop.

Why it helps:
1. Gives quick aim-and-tap moments.
2. Creates urgent space-management pressure instead of stat pressure.
3. Makes players value belt real estate and lane hygiene.

## 4.3 Claw Breakdown

Theme:
Claw assemblies fail under stress and rotate away from the main belt.

Behavior:
1. Broken claw is disabled and visibly flipped away from the main belt.
2. Broken claw shows sparks plus a warning exclamation marker.
3. During incident, only 1 to 2 claws remain operational.
4. Main-belt foods are forced into whichever claws are still active.

Player pressure result:
1. Reliance on random correct claw assignment drops sharply.
2. Player must manually rescue and reroute much more often.
3. This creates deliberate touch sorting skill checks.

Resolution rule:
1. Incident lasts 6 to 8 seconds.
2. Bonus if player survives without any new jam.
3. Penalty if at least one lane jams during breakdown.

Why it helps:
1. Fits Machines theme strongly (machine failure under load).
2. Changes routing logic, not just numbers.
3. Forces active, intentional sorting.

## 4.4 Optional Extra: QC Scanner Gate (What Else)

Theme:
Quality scanner asks for a quick confirmation on one highlighted item.

Player interaction:
1. Tap one of two large icons: "Pass" or "Reject".

If succeeded:
1. Small combo bump and a short safety bonus.

If failed:
1. Brief multiplier freeze.

Why it helps:
1. Adds tiny decision mini-game.
2. Uses tap only and big touch targets.

## 5) Recommended First Version (Most Impact, Least Risk)

Implement only these first:
1. Saboteur Drones.
2. Jam Beetles.
3. Claw Breakdown.

Reason:
1. Covers fast tap reaction + heavy manual sorting pressure.
2. Very readable machine fantasy.
3. Big variety boost with low engineering risk.

## 6) Level Pacing So It Stops Feeling Samey

Keep quotas fixed where requested, but vary incidents by chapter.

Suggested chapter schedule:
1. L1 to L2:
2. No incidents or tutorial-only beetle.
3. L3:
4. Introduce Jam Beetle only.
5. L4 to L6:
6. Add Claw Breakdown.
7. L7+:
8. Add Saboteur Drones.
9. L10+:
10. Enable 2 incident types per level, random but non-repeating.

This creates novelty even with quota cap at 200.

## 7) Touch UX Rules (Critical)

1. Minimum touch target size: 72px.
2. Incident objects must use pulsing outlines and color coding.
3. Never spawn incident UI directly under player finger while dragging.
4. During drag, incident tap hitboxes should have slight grace radius.
5. Incident warnings should appear 0.6 seconds before effect starts.
6. Use one-line labels only, no paragraph popups.

## 8) Reward Structure To Keep Motivation High

Add "Maintenance Stars" separate from score.

Gain stars by:
1. Killing drones quickly.
2. Clearing beetles before belt backup spreads.
3. Clearing priority beetles marked with urgent exclamation icons.
4. Surviving Claw Breakdown with zero jams.

Spend stars instantly on one-tap machine assists:
1. Auto-sort next wrong item.
2. 3-second lane shield on selected chest.
3. Instant unjam nearest lane.

Why this helps:
1. Adds second objective loop.
2. Keeps agency high when chaos spikes.

## 9) Session Variety Without Complexity Creep

Before each run, pick one "Factory Mutator" from a small pool.

Examples:
1. Sticky Belts: drag release has slight delay.
2. Hyper Sensors: more scanner events, bigger multiplier rewards.
3. Rust Storm: beetles appear more often, but drones are disabled.
4. Servo Decay: claw breakdown events last longer, but grant bigger survival bonus.

Rules:
1. One mutator only per run.
2. Mutator shown on start card.
3. Keep effects obvious and single-line described.

## 10) Metrics For "Is This More Fun?"

Track these simple numbers:
1. Average run length.
2. Number of manual rescues per minute.
3. Incident success rate by type.
4. First jam time.
5. Player retry count after loss.

Good signs:
1. Run length stable or higher.
2. Retry count increases.
3. Incident success climbs over attempts.

## 11) Minimal Build Roadmap

Phase 1 (1 to 2 sessions):
1. Add incident scheduler.
2. Add Jam Beetles (tap).

Phase 2 (1 to 2 sessions):
1. Add Claw Breakdown event.
2. Add flipped-claw visuals and warning markers.

Phase 3 (2 to 3 sessions):
1. Add Saboteur Drones (multi-tap).
2. Add reroute sabotage behavior.

Phase 4 (polish):
1. Add Maintenance Stars.
2. Add 2 to 3 run mutators.
3. Optionally add QC Scanner Gate as fourth incident.

## 12) Final Recommendation

If you do only one thing, do Saboteur Drones first.

Why:
1. It directly solves repetition.
2. It matches Machines theme perfectly.
3. It is touch-native and readable.
4. It creates immediate "save the line" drama without replacing your core sorting gameplay.
