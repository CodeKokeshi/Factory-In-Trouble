# Game Maths

## Mechanic Introduction Levels
- Jam beetle is introduced from Campaign Level 2 and up (level index >= 2).
- Drone sabotage is introduced from Campaign Level 3 and up (level index >= 3).
- Debug level keeps both mechanics enabled for testing.

## Jam Beetle Spawn Chance
- Base formula: P_base = 1 / (N_core_food_categories + 1)
- Tuned formula: P_beetle = clamp(P_base * JAM_BEETLE_SPAWN_SCALE, 0.01, 0.95)

Current values:
- N_core_food_categories = 4
- JAM_BEETLE_SPAWN_SCALE = 0.62
- P_base = 1 / (4 + 1) = 0.20
- P_beetle = 0.20 * 0.62 = 0.124 (12.4%)

## Drone Sabotage Timing Maths
- Main cooldown: random integer in [9500, 15500] ms.
- Retry cooldown when no valid target/drop slot exists: random integer in [1400, 3000] ms.
- Stress-defer cooldown (when player is overloaded and side-belt space is tight): random integer in [2600, 5200] ms.
- Warning duration: 1000 ms total (includes fade in + hold + fade out).
- Flight speed: 460 px/sec.

## Adaptive Drone Defer Rule
- Let freeLaneRatio = enterableSideBelts / activeSideBelts.
- Overloaded state is true when any of these are true:
  pressure >= 0.74
  jamLoad >= 0.56
  clogRatio >= 0.45
- Drone spawn is deferred when:
  overloaded == true AND freeLaneRatio < 0.67
- If freeLaneRatio >= 0.67 (lots of free side belts), drone spawn is allowed even under stress.

## Complex Layout Note (No Main Belt Families)
- For no-main-belt families (v_swap, triangle_mesh, dual_spine), the drone drop fallback prefers side-belt slots.
- If the planned wrong-lane drop is unavailable, fallback order is:
1. another wrong lane start/free-start slot
2. source lane slot where the drone stole the item
3. any available side lane start/free-start slot

## Claw Breakdown Prototype (Debug Endless Only)
- Enabled only in Debug Endless (levelId == DEBUG and mode == endless).
- Each transfer claw starts with random heat HP in [4, 8].
- Each successful claw grab drains random heat in [0.8, 1.35].
- If heat reaches 0, the claw overheats and cannot grab.
- Overheated claw auto-repairs over random time in [3600, 6200] ms.
- After repair completes, heat resets to max and claw becomes functional again.
