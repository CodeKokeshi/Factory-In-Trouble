# Game Maths (Code-Verified)

## Jam Beetle Spawn
- Formula:
  enabled = (mode == endless) OR (mode == campaign AND levelIndex >= 2)
  P_base = 1 / (N_core_food_categories + 1)
  P_beetle = clamp(P_base * 0.62, 0.01, 0.95)
  Spawn when random() < P_beetle
- Values:
  N_core_food_categories = FOOD_TYPES.length = 4
  P_base = 1 / (4 + 1) = 0.20
  P_beetle = clamp(0.20 * 0.62, 0.01, 0.95) = 0.124 (12.4%)
- Brief description:
  Beetle spawn chance is based on the full core category count, not level-limited active foods.
- Level appeared:
  Endless mode, and campaign level index >= 2 (starts at L2).

## Drone Sabotage Base Timing
- Formula:
  enabled = (mode == endless) OR (mode == campaign AND levelIndex >= 3)
  sabotageCooldownMs = randomInt(9500, 15500)
  retryCooldownMs = randomInt(1400, 3000) when no valid sabotage target
  warningDurationMs = 1000
  flightDurationMs = clamp((distancePx / 460) * 1000, 420, 1960)
- Values:
  base cooldown range = [9500, 15500] ms
  retry range = [1400, 3000] ms
  warning duration = 1000 ms
  flight speed = 460 px/sec
  flight min/max duration = [420, 1960] ms
- Brief description:
  Drone runs on a random cooldown, retries quickly when no target exists, and flies with distance-based clamped travel time.
- Level appeared:
  Endless mode, and campaign level index >= 3 (starts at L3).

## Drone Stress-Defer Rule
- Formula:
  freeLaneRatio = enterableLaneCount / max(1, laneCount)
  overloaded = (pressure >= 0.74) OR (jamLoad >= 0.56) OR (clogRatio >= 0.45)
  defer = overloaded AND (freeLaneRatio < 0.67)
  if defer: nextCheckMs = randomInt(2600, 5200)
- Values:
  pressure threshold = 0.74
  jamLoad threshold = 0.56
  clogRatio threshold = 0.45
  free-lane allow threshold = 0.67
  stress retry range = [2600, 5200] ms
- Brief description:
  Drone sabotage is postponed only when the run is overloaded and side-lane entry space is too limited.
- Level appeared:
  Same as drone sabotage: Endless mode and campaign L3+.

## Drone Drop Fallback (No-Main-Belt Context)
- Formula:
  layoutUsesMainBelt = NOT(layoutFamily in {v_swap, triangle_mesh, dual_spine})
  drop order:
  1) planned lane first free-from-start slot
  2) another wrong-lane first free-from-start slot
  3) source lane nearest free slot (then source lane first free-from-start)
  4) if NOT layoutUsesMainBelt: any lane first free-from-start
  5) if still no valid lane: fallback to main belt origin position
- Values:
  no-main-belt families = {v_swap, triangle_mesh, dual_spine}
- Brief description:
  Drone tries to keep the sabotage wrong-lane intent first, then falls back by slot availability; no-main-belt layouts get an extra any-lane side drop fallback.
- Level appeared:
  Applies in no-main-belt campaign layouts: L5 (v_swap), L13 (triangle_mesh), L14 (dual_spine).

## Claw Breakdown
- Formula:
  enabled = (mode == endless) OR (mode == campaign AND levelIndex >= 4)
  heatMax = randomInt(4, 8)
  heatCurrent starts at heatMax
  on successful claw grab: heatCurrent = max(0, heatCurrent - randomFloat(0.8, 1.35))
  overheat when heatCurrent <= 0.001
  repairDurationMs = randomInt(3600, 6200)
  repairProgressMs = min(repairDurationMs, repairProgressMs + deltaMs)
  repaired when repairProgressMs >= repairDurationMs, then heatCurrent = heatMax
- Values:
  heat range = [4, 8]
  drain range per grab = [0.8, 1.35]
  repair range = [3600, 6200] ms
- Brief description:
  Transfer claws can overheat from repeated grabs and become unavailable until timed repair finishes.
- Level appeared:
  Endless mode, and campaign level index >= 4 (starts at L4).

## Lane Swap Incident
- Formula:
  enabled = (mode == endless) OR (mode == campaign AND levelIndex >= 5)
  laneSwapCooldownMs = randomInt(21000, 33000)
  if no valid pair: laneSwapCooldownMs = randomInt(5200, 9800)
  validPair = pick random pair where laneA.id != laneB.id AND laneA.desiredType != laneB.desiredType
  warningDurationMs = 1200
  exchangeDurationMs = 540
  perLaneTransformMs = 240 (drone in) + 180 (hold) + 260 (drone out) = 680
- Values:
  base cooldown range = [21000, 33000] ms
  retry range = [5200, 9800] ms
  warning duration = 1200 ms
  exchange duration = 540 ms
  transform drone in/out = [240, 260] ms
  transform hold = 180 ms
  transform drone scale = 0.62
  warning bubble travel = 320 ms
- Brief description:
  A timed incident swaps two lane target food types, then retags active side/jammed items in those lanes via drone transform passes.
- Level appeared:
  Endless mode, and campaign level index >= 5 (starts at L5).
