# Tiled Beginner Guide For This Phaser Jam Project

This guide is for first-time Tiled users.

You will do only level design here.
You are not switching away from Phaser.
Phaser is still your game engine.

Tiled is only a map editor so you can build levels fast.

## What You Will Have At The End

By the end of this guide, you will have:

1. A level file made in Tiled.
2. A clear folder structure inside this project.
3. Correct layer names and object names for easy Phaser coding.
4. One or more exported JSON level files ready to load in Phaser.

After that, you come back and we wire gameplay logic.

## Part 1: Install Tiled

1. Go to the Tiled website: https://www.mapeditor.org/
2. Download the Windows installer.
3. Install with default options.
4. Open Tiled once to make sure it starts.

Tip:
If Tiled asks about updates or plugins, you can skip for now.
Keep setup simple for game jam speed.

## Part 2: Prepare Your Project Folders

Inside this project, create these folders:

1. assets/maps
2. assets/tilesets
3. assets/sprites

Put files like this:

1. Your world tile sheet image into assets/tilesets
2. Your player sprite image into assets/sprites
3. Tiled map files will be saved in assets/maps

Important:
Use simple lowercase names with underscores.
Example names:

1. terrain_16.png
2. player_16.png
3. level_01.tmj
4. level_01.json

## Part 3: Prepare Your Tile Sheet Image

Your player is 16x16. Keep level tiles 16x16 too.

A tile sheet is one image that contains many 16x16 blocks.
For example:

1. Ground tile
2. Wall tile
3. Platform tile
4. Hazard tile
5. Decorative tile

Rules:

1. Every tile cell should be exactly 16 by 16 pixels.
2. Keep no extra empty border around the image if possible.
3. Keep spacing between tiles at 0 for now.

If you only have a few tiles, that is fine.
You can expand later.

## Part 4: Create Your First Map In Tiled

1. Open Tiled.
2. Click File -> New.
3. In the map setup window:
4. Choose the plain square grid option (the normal first option).
5. Set Tile Width to 16.
6. Set Tile Height to 16.
7. Set Map Width to 200.
8. Set Map Height to 40.
9. Turn Infinite map OFF for now.
10. Click OK.

Why these values:

1. 16 matches your player and tiles.
2. 200x40 is enough for a platformer test stage.
3. Infinite map OFF keeps things simpler while learning.

## Part 5: Add Your Tiles To Tiled

1. In Tiled top menu, click Map -> New Tileset.
2. Choose Based on Tileset Image.
3. Name it terrain_16.
4. Tile Width: 16.
5. Tile Height: 16.
6. Margin: 0.
7. Spacing: 0.
8. Browse to assets/tilesets/terrain_16.png.
9. Click OK.

You should now see your tiles in the tiles panel.

## Part 6: Create Layers With Exact Names

Create these layers in this exact order:

1. Background (tile layer)
2. Ground (tile layer)
3. Decor (tile layer)
4. Objects (object layer)

How to add layers:

1. In the Layers panel, click Add Layer.
2. Choose Tile Layer for Background, Ground, Decor.
3. Choose Object Layer for Objects.
4. Rename each layer exactly as listed.

Why exact names matter:
When we code in Phaser, we will load layers by name.
If names do not match, code will fail or skip layers.

## Part 7: Draw The Level Layout

Select Ground layer and paint playable terrain.

Start with this simple layout:

1. A long floor near bottom of map.
2. A few gaps to jump over.
3. A few raised platforms.
4. A clear start area on the left.
5. A clear end area on the right.

Then select Decor layer for visual tiles only.
Do not place collision tiles on Decor.

Background layer is for non-collision visuals.

### Easy Design Rule For First Level

1. Keep jumps short at first.
2. Avoid very tight jumps.
3. Make one safe path from start to finish.
4. Add challenge only after movement feels good.

## Part 8: Place Gameplay Markers In Objects Layer

Now place special markers that Phaser will read.

1. Select Objects layer.
2. Use Insert Point tool (or add small rectangle object).
3. Place one object where player starts.
4. Place one object where level ends.

Set object names exactly:

1. player_spawn
2. exit

How to set name:

1. Click object.
2. Open Properties panel.
3. Set Name field.

Keep exactly one player_spawn in each level.
You should have at least one exit object.

Optional object markers you can add now:

1. enemy_spawn
2. checkpoint
3. pickup

If you add optional markers, keep names consistent in every level.

## Part 9: Save And Export Correctly

Use both save formats:

1. Editable project file for future map edits.
2. JSON export for Phaser runtime.

Steps:

1. File -> Save As -> assets/maps/level_01.tmj
2. File -> Export As -> JSON -> assets/maps/level_01.json

Why both:

1. tmj keeps your editable Tiled project data.
2. json is the file Phaser will load.

Important:
After every map change, export JSON again.
If you forget, Phaser loads old map data.

## Part 10: Make More Levels Fast

To create level 2 quickly:

1. File -> Save As -> level_02.tmj
2. Edit layout.
3. Move player_spawn and exit as needed.
4. Export to level_02.json

Repeat for level_03 and beyond.

## Part 11: Collision Strategy For Beginner Setup

For now, keep collision simple:

1. Place all solid tiles only in Ground layer.
2. Keep Background and Decor non-solid.

Later in Phaser code, we can set Ground layer to collide.
This is the fastest beginner setup.

## Part 12: Camera And Level Size Notes

Good beginner map size:

1. Width: 120 to 300 tiles.
2. Height: 20 to 50 tiles.

Bigger map means camera scrolling.
That is normal and easy in Phaser.

## Part 13: Common Mistakes And Fixes

Mistake: Player spawns at 0,0 or wrong place.
Fix: Ensure Objects layer has one object named player_spawn.

Mistake: Level appears but no collision.
Fix: Ensure solid tiles are in Ground layer, not Decor.

Mistake: Changes do not appear in game.
Fix: Re-export JSON after each edit.

Mistake: Phaser cannot find layer.
Fix: Layer names must match exactly: Background, Ground, Decor, Objects.

Mistake: Tiles look offset or wrong size.
Fix: Confirm tile size is 16x16 in both map and tileset settings.

## Part 14: Quick Quality Checklist Before You Return Here

Check all items:

1. You installed Tiled.
2. You created assets/maps, assets/tilesets, assets/sprites.
3. You imported terrain_16.png as a tileset.
4. Map uses 16x16 tile size.
5. You created layer names exactly:
6. Background
7. Ground
8. Decor
9. Objects
10. You placed one object named player_spawn.
11. You placed at least one object named exit.
12. You saved level_01.tmj.
13. You exported level_01.json.

If all true, you are ready to come back for Phaser logic.

## Part 15: What To Tell Me When You Come Back

When you return, send this info:

1. The map JSON filename (example: level_01.json).
2. The tileset image filename (example: terrain_16.png).
3. Confirm layer names exactly.
4. Confirm object names exactly.
5. Tell me if you want keyboard only or keyboard plus controller.

Then I will wire your Phaser code to:

1. Load map JSON.
2. Render layers.
3. Enable Ground collision.
4. Spawn player at player_spawn.
5. Detect exit and move to next level.

You are doing it right for a jam.
This is the fastest clean workflow with Phaser.
