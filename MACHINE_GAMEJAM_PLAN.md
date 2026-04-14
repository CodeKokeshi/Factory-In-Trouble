# Machine Theme Game Plan (Polished And Jam-Safe)

## 1) Clear Game Pitch

You are the human quality-control worker in a broken food-sorting factory.

A center main conveyor receives food from a top-center entry chute.
Four side claws pull items off that center line into category belts.
Each category belt ends in a chest (Condiments, Carbs, Protein, Greens).
Wrong items clog chests.
Your job is to grab wrong items and place them onto the correct belt before the factory jams.

This keeps the machine theme strong:
- Automation exists.
- Automation is flawed.
- Human intervention is the gameplay.

## 2) Core Promise To The Player

Fast, readable chaos where machines fail and player skill saves output.

Player fantasy:
- Not building a factory.
- Not managing menus.
- Doing rapid hands-on rescue in a live conveyor system.

## 3) Scope Lock (Very Important)

Do this now for game jam safety.

In scope:
1. One fixed factory layout.
2. Four food types only: Condiments, Carbs, Protein, Greens.
3. Four claw lanes and four category chests.
4. One gameplay action: grab item and drop it on another belt.
5. Timer-based round with score.
6. Win and lose states.

Out of scope for jam:
1. Building or editing factory layout.
2. Research tree, upgrades, crafting, economy.
3. More than one core mechanic.
4. Complex NPC workers.
5. Online leaderboard.
6. More than one map unless extra time remains.

## 4) Exact Factory Layout (Fixed)

Use one screen layout only.

Recommended layout:
1. Main food entry is at top center.
2. Main conveyor is in the middle of screen and runs from top to bottom.
3. The overall machine shape looks like a sideways H.
4. Four claw positions are fixed on the sides of the main belt:
5. Middle left claw
6. Middle right claw
7. Bottom left claw
8. Bottom right claw
9. Each claw feeds its own side belt and chest.

Meaning:
- Main vertical belt is the source stream.
- Side claws pull items from the main belt into branch belts.
- Branch belts carry items to their assigned chest.

Player cannot move belts or claws.
Only item correction is allowed.

### 4.1 Starter Lane Assignment (Use This For Jam)

Use this fixed mapping for your first playable build:
1. Middle left lane -> Carbs chest
2. Middle right lane -> Protein chest
3. Bottom left lane -> Greens chest
4. Bottom right lane -> Condiments chest

Keep this mapping constant across the whole jam build.

### 4.2 Screen Blueprint (1280 x 720)

Use these approximate coordinates for graybox implementation:
1. Main entry spawn point: x=640, y=40
2. Main belt body: x=620, y=80, width=40, height=560
3. Middle left claw zone: x=560, y=300
4. Middle right claw zone: x=720, y=300
5. Bottom left claw zone: x=560, y=500
6. Bottom right claw zone: x=720, y=500
7. Left chest x-position around 180 (middle and bottom rows)
8. Right chest x-position around 1100 (middle and bottom rows)

These values are placeholders and can be adjusted after first playtest.

## 5) Exact Gameplay Rules

### 5.1 Food Types

Use only these for jam:
1. Condiments
2. Carbs
3. Protein
4. Greens

### 5.2 Item Flow

1. Items spawn on main belt every X seconds.
2. At claw zones, one claw pulls item to a side belt.
3. Because claws are flawed, items can enter the wrong side belt.
4. Side belt moves item toward chest.

### 5.3 Chest Validation

Each chest accepts only one type:
1. Condiments chest accepts Condiments only.
2. Carbs chest accepts Carbs only.
3. Protein chest accepts Protein only.
4. Greens chest accepts Greens only.

If correct item reaches chest:
- Item is consumed.
- Score increases.

If wrong item reaches chest:
- Chest rejects item.
- Item stays and creates a jam.
- Belt behind it starts backing up.

### 5.4 Player Action

Player can:
1. Click and hold wrong item.
2. Drag to another side belt.
3. Release to drop item.

If dropped on correct belt:
- Item continues toward correct chest.

If dropped on wrong belt again:
- Still wrong, still risky.

No crafting, no combining, no extra tools.
One action only.

## 6) Win, Lose, Score

### 6.1 Win Condition

Reach target score before timer ends.

Example starter values:
1. Round time: 120 seconds.
2. Target score: 120 points.

### 6.2 Lose Condition

You lose if either happens:
1. Any chest remains jammed for more than 8 seconds.
2. Total on-screen items exceed overflow cap (example: 35 items).

Use both checks for better tension.

### 6.3 Scoring

Simple scoring:
1. Correct chest delivery: +5
2. Manual rescue bonus (item was wrong, then fixed by player): +3
3. Wrong chest jam: -5 instant penalty

Keep math simple and readable.

## 7) Difficulty Curve Without New Mechanics

Use only number tuning over time.

0 to 40 seconds:
1. Slow spawn rate.
2. Low claw error rate.

40 to 80 seconds:
1. Faster spawn rate.
2. Medium claw error rate.

80 to 120 seconds:
1. Fast spawn rate.
2. High claw error rate.
3. Short burst waves every 10 seconds.

No new systems, only speed and error changes.

## 8) Minimal UI (Enough For Jam)

On screen show only:
1. Timer
2. Score
3. Target score
4. Jam meter per chest
5. Overflow count

Player should understand danger in 1 second glance.

## 9) Phaser Build Plan (Practical Implementation Order)

Build in this order only.
Do not skip around.

### Step 1: Graybox Scene (No Final Art)

1. Draw simple rectangles for belts.
2. Draw four chest boxes with labels.
3. Spawn colored square items.

Goal:
- Visual layout exists and updates each frame.

### Step 2: Item Movement

1. Main belt items move top to bottom.
2. Claw zones transfer items to side belts.
3. Side belts move items toward chests.

Goal:
- Full machine flow works with placeholders.

### Step 3: Chest Accept Or Reject

1. Check item type on chest contact.
2. Correct type: remove and score.
3. Wrong type: mark jam and block lane.

Goal:
- Core success and failure behavior works.

### Step 4: Player Drag And Drop

1. Make items draggable.
2. Allow drop onto side belt zones.
3. Reassign lane on drop.

Goal:
- Player can rescue mistakes.

### Step 5: Win/Lose Loop

1. Add timer.
2. Add target score.
3. Add jam timeout and overflow fail.
4. Add restart key/button.

Goal:
- Full playable jam loop complete.

### Step 6: Replace Placeholder Art

1. Swap colored boxes with your real sprites.
2. Add simple claw animation later only if time remains.
3. Keep game feel first, polish second.

Goal:
- Stable game with themed visuals.

## 10) How To Build Now Even Without Belt And Claw Assets

Use placeholders immediately:
1. Belts: dark gray rectangles with moving stripe texture or offset lines.
2. Claws: simple static icon or small triangle marker at each pickup point.
3. Items: colored 16x16 squares (orange condiments, yellow carbs, red protein, green greens).
4. Chests: boxes with text labels.

This is enough to complete gameplay before final art.

## 11) Data Model (Simple)

Use plain objects.

Item fields:
1. id
2. type (condiments, carbs, protein, greens)
3. lane (main, condiments, carbs, protein, greens)
4. x, y
5. speed
6. draggable state
7. rescued flag (true if player corrected it)

Chest fields:
1. typeAccepted
2. jammed (true or false)
3. jamStartTime
4. jamMeter value

Claw fields:
1. targetLane
2. cooldown
3. errorRate
4. pickup zone position

## 12) Final Definition Of Done For Jam Submission

Game is done when all are true:
1. Player can play from start to end without debug tools.
2. Main belt, claws, side belts, and chests all function.
3. Wrong items can be manually corrected.
4. Score, timer, and lose conditions are visible.
5. One full 120-second round is balanced enough to be fun.
6. No crash in browser play.

If this list is true, submit it.
Do not keep adding features.

## 13) Optional Names (Pick One Fast)

1. Belt Rescue
2. MisSort
3. Claw Error
4. Factory Triage
5. Human Override

Pick one and move forward.

## 14) Immediate Next Action

Implement only Steps 1 to 3 first (graybox, movement, chest validation).
Then test if it feels clear.
Only after that add drag-and-drop.

This order prevents scope creep and gives a playable prototype fast.
