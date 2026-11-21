# Odyssey

A cheerful 2D top-down action-adventure for phones and desktops. You play as a young hero with a sword who has to win back three sacred relics from the sorcerer **Malvoren** and rescue **Elder Rowan** of Willowbrook Village.

The game is plain HTML5, CSS and JavaScript on a Canvas. It has no build step, no backend and no downloaded assets. All the pixel art, sound effects and music are generated in code.

## Playing

| Action        | Phone              | Keyboard           |
|---------------|--------------------|--------------------|
| Move (8 dirs) | Left thumb stick   | Arrow keys / WASD  |
| Attack / Talk | **Attack** button  | J, Z or Space      |
| Jump          | **Jump** button    | K or X             |
| Roll (dodge)  | **Roll** button    | L, C or Shift      |
| Spin attack   | **Spin** button    | I or V             |
| Pause         | ❚❚ button          | Esc, P or Enter    |
| Mute          | 🔊 button          | M                  |

- **Attack** also talks to people, reads signs, opens chests and drinks from the fountain. On phones the button's label changes to show what it will do.
- **Jump** carries you over pits, fences and bushes. **Roll** makes you invincible for a moment.
- Walk into a stone block to push it. Walk into a locked door while you have a key to open it.
- The game saves automatically when you enter each screen and when you pick up an item. If you faint, you wake up with full hearts where you entered the current screen.

### The quest (light spoilers)

1. **Willowbrook Village**: talk to Lina and the other villagers for hints.
2. **Forest Shrine** (west, then north): get the *Leaping Boots*, which let you jump gaps two tiles wide. Boss: King Slime.
3. **River Grotto** (east past the market, across the wide gap): get the *Power Glove*, which smashes heavy boulders. Boss: Nightwing.
4. **Peak Tower** (north up the mountain, past the boulders): get the *Sun Sword*, whose swings fire a beam of light. Boss: Bone Lord.
5. **Castle Malvoren** (north from the Crossroads, then east): once you hold all three relics, the seal breaks. Hit Malvoren's magic orbs back at him!

Wynn's shop in the market sells a Red Potion (10 coins) and a Heart Container (40 coins).

## Publishing on GitHub Pages

1. Push this repository to GitHub. `index.html` has to be at the root of the repository, and it already is.
2. On GitHub, open the repository and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose your branch (for example `main`) and the **/ (root)** folder, then click **Save**.
5. Wait a minute or two. The game will be live at `https://<your-username>.github.io/<repository-name>/`.

Every path in the game is relative, so it works from a project sub-path like this with no changes. The empty `.nojekyll` file tells GitHub Pages to serve the files exactly as they are.

### Add it to a phone's home screen (fullscreen)

- **iPhone / iPad (Safari):** open the game's URL, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the game's URL, tap the **⋮** menu, then **Add to Home screen** or **Install app**.

When you launch it from the home-screen icon, it runs fullscreen with no browser bars. It works in both landscape and portrait.

### Running it locally

You can open `index.html` directly in a browser. You can also serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Code layout

```
index.html            Page shell: canvas, menus, dialog box, touch controls
manifest.webmanifest  Home-screen / fullscreen app settings
css/style.css         Layout, menus, dialog box and touch-control styling
icons/                App icons (made from the game's own sprites)
js/maps.js            World data: every room's tile map, NPCs, signs, dialogue, items
js/audio.js           Web Audio sound effects and the chiptune music sequencer
js/input.js           Keyboard + virtual joystick + touch buttons (with haptics)
js/art.js             Procedural tile painting and pixel-map sprites
js/entities.js        Hero, enemies, bosses, NPCs, pickups, projectiles, push blocks
js/game.js            Main loop, rooms and screen transitions, puzzles, HUD, menus, saving
```

### Editing the world

Every room is a 16 × 11 grid of characters in `js/maps.js`. The legend is at the top of that file. For example, `T` is a tree, `p` is a pit, `b` is a push block and `1` is a slime. To add a room, add a new `'x,y'` key next to an existing one. Walking off the edge of a screen leads to the room next to it on the grid. Each NPC's dialogue is a small function in `DIALOGUE`, so their hints can change as the quest moves forward.

The save is stored in `localStorage` under the key `odyssey-save-v1`. To reset it, start a **New Game** from the title screen.
