# DnD5e Roll Enricher

### Description
This module adds a button in the journal entry headers that automatically detects and enriches (https://github.com/foundryvtt/dnd5e/wiki/Enrichers) dice rolls, skill checks, saving throws, and references in FoundryVTT **DnD5e** journals. Useful for GMs wanting to enhance their notes.

### 🎲 Features
Detects and enriches:
- Skill/Ability/Tool Checks: `"DC 15 Wisdom (Perception) check"` → `[[/skill wisdom perception 15]]`
- Passive Checks: `"passive perception score of 20 or higher"` → `[[/skill perception 20 passive format=long]]`
- Attack Rolls: `"+8 to hit"` → `[[/r 1d20+8]]` **Note**: Will actually add the attack enricher when updating to 5e v4
- Saving Throws: `"DC 14 Dexterity saving throw"` → `[[/save dexterity 14]]`
- Damage Rolls: `"5 (1d6+2) fire damage"` → `[[/damage 1d6+2 fire average=true]]`
- Healing Rolls: `"2d8+5 hit points"` → `[[/damage 2d8+5 healing]]`
- References: `"Difficult Terrain"` → `"Difficult Terrain (See &Reference[difficult terrain])"`

### 🛠️ Installation
1. Open FoundryVTT, go to **Add-on Modules**.
2. Click `Install Module`.
3. Paste the manifest URL:
   https://github.com/jfelicio/dnd5e-roll-enrichers/releases/latest/download/module.json
5. Click Install & Enable the module in **Game Settings**.

### 📝To Do
- Add official support for DnD 5e v4, adding better functionality for attack enrichers
