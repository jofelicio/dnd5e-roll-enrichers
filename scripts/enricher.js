
import { TOOL_IDS, RULES_IDs } from "./config.js";

const ENRICHER_GROUPS = {
    attacks: { label: "Attacks" },
    awards: { label: "Awards" },
    checks: {
        label: "Checks",
        children: ['abilities', 'passives', 'skills', 'tools']
    },
    damage: { label: "Damage" },
    healing: { label: "Healing" },
    references: {
        label: "References",
        children: ['AOE', 'conditions', 'creatureType', 'rules', 'spellComponents', 'spellSchool']
    },
    saves: { label: "Saving Throws" }
};

// Button only appears on Journal Entries
Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
    if (!(app instanceof JournalSheet)) return; 
    buttons.unshift({
        label: "Enrich It",
        class: "custom-header-button",
        icon: "fas fa-dice-d20",
        onclick: () => showEnrichDialog(app.document)
    });
});

/**
 * Displays a dialog with checkboxes for different enrichments
 * @param {JournalEntry} journal - The journal to modify.
 */
function showEnrichDialog(journal) {
    const formContent = `
        <style>
            .checkbox-subgroup { margin-left: 25px; border-left: 2px solid #666; }
        </style>
        <form id="enrich-form">
            <div class="form-group">
                <input type="checkbox" id="all" name="all">
                <label for="all"><strong>Select All</strong></label>
            </div>
            <hr>
            ${generateCheckboxHTML(ENRICHER_GROUPS)}
        </form>`;
    new Dialog({
        title: "Enrich Journal Rolls",
        content: formContent,
        buttons: {
            apply: {
                label: "Apply Changes",
                callback: async (html) => {
                    const options = collectSelectedOptions(html);
                    await enrichJournalPages(journal, options);
                }
            },
            cancel: { label: "Cancel" }
        },
        default: "apply",
        render: setupCheckboxBehavior
    }).render(true);
}

/**
 * Generates HTML for the checkbox form dynamically
 */
function generateCheckboxHTML(groups) {
    return Object.entries(groups)
        .map(([groupId, group]) => {
            const mainCheckbox = `
                <div class="form-group">
                    <input type="checkbox" id="${groupId}" name="${groupId}">
                    <label for="${groupId}"><strong>${group.label}</strong></label>
                </div>`;

            if (!group.children) return mainCheckbox;

            const childrenCheckboxes = group.children.map(childId => `
                <div class="form-group">
                    <input type="checkbox" id="${childId}" name="${childId}">
                    <label for="${childId}">${childId.charAt(0).toUpperCase() + childId.slice(1)}</label>
                </div>`).join("");

            return `
                <div>${mainCheckbox}
                    <div class="checkbox-subgroup">${childrenCheckboxes}</div>
                </div><hr>`;
        })
        .join("");
}

/**
 * Collects selected checkboxes from the form into an options object.
 */
function collectSelectedOptions(html) {
    const optionMap = {
        abilities: 'enrichAbilities', passives: 'enrichPassives', skills: 'enrichSkills', tools: 'enrichTools',
        AOE: 'enrichAOE', conditions: 'enrichConditions', creatureType: 'enrichCreatureType', rules: 'enrichRules',
        spellComponents: 'enrichSpellComponents', spellSchool: 'enrichSpellSchool',
        attacks: 'enrichAttacks', awards: 'enrichAwards', damage: 'enrichDamage',
        healing: 'enrichHealing', saves: 'enrichSaves'
    };

    return Object.fromEntries(
        Object.entries(optionMap).map(([id, option]) => [option, html.find(`#${id}`)[0]?.checked ?? false])
    );
}

function setupCheckboxBehavior(html) {
    const allCheckbox = html.find("#all").prop("checked",true);
    const allCheckboxes = html.find("input[type='checkbox']").not("#all").prop("checked",true);

    // Handle group behavior
    Object.entries(ENRICHER_GROUPS).forEach(([groupId, group]) => {
        if (!group.children) return;

        const groupCheckbox = html.find(`#${groupId}`);
        const childCheckboxes = html.find(group.children.map(id => `#${id}`).join(', '));

        updateGroupState(groupCheckbox, childCheckboxes);

        groupCheckbox.on("change", function () {
            childCheckboxes.prop("checked", this.checked);
            updateGroupState(groupCheckbox, childCheckboxes);
        });

        childCheckboxes.on("change", function () {
            updateGroupState(groupCheckbox, childCheckboxes);
        });
    });

    // Handle "Select All"
    allCheckbox.on("change", function () {
        allCheckboxes.prop("checked", this.checked);
    });

    allCheckboxes.on("change", function () {
        allCheckbox.prop("checked", allCheckboxes.toArray().every(c => c.checked));
    });
}

/**
 * Updates the visual state of group checkboxes.
 */
function updateGroupState(groupCheckbox, childCheckboxes) {
    const allChecked = childCheckboxes.toArray().every(c => c.checked);
    const someChecked = childCheckboxes.toArray().some(c => c.checked);
    groupCheckbox.prop({ checked: allChecked, indeterminate: someChecked && !allChecked });
}

// Optimized enrichment handler
const enrichmentHandlers = {
    enrichSkills: enrichSkillChecks,
    enrichAbilities: enrichAbilityChecks,
    enrichAttacks: enrichAttackRolls,
    enrichAwards: enrichAwards,
    enrichSaves: enrichSavingThrows,
    enrichDamage: enrichDamageRolls,
    enrichHealing: enrichHealingRolls,
    enrichTools: enrichToolChecks,
    enrichPassives: enrichPassiveChecks,
    enrichAOE: enrichAOE,
    enrichConditions: enrichConditions,
    enrichCreatureType: enrichCreatureType,
    enrichRules: enrichRules,
    enrichSpellComponents: enrichSpellComponents,
    enrichSpellSchool: enrichSpellSchool
};

/**
 * Applies selected enrichments to the journal pages.
 */
async function enrichJournalPages(journal, options) {
    const updates = journal.pages.contents
        .filter(page => page.type === "text")
        .map(page => {
            let content = page.text.content || "";
            let modified = false;

            const sortedEnrichers = Object.entries(enrichmentHandlers)
                .sort(([a], [b]) => a.localeCompare(b));

            content = sortedEnrichers.reduce((newContent, [option, handler]) => {
                if (options[option]) {
                    const updatedContent = handler(newContent);
                    if (updatedContent !== newContent) modified = true;
                    return updatedContent;
                }
                return newContent;
            }, content);

            return modified ? { _id: page.id, "text.content": content } : null;
        })
        .filter(update => update !== null);

    if (updates.length > 0) {
        await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
        ui.notifications.info(`Updated ${updates.length} page(s) with enriched rolls.`);
    } else {
        ui.notifications.info("No changes were needed.");
    }
}

/**
 * Enriches skill checks, supporting these formats:
 * - "DC 15 Wisdom (Perception) check"
 * - "DC 12 Dexterity (Stealth or Acrobatics) check" 
 */
function enrichSkillChecks(content) {
    return content.replace(
        /DC\s+(\d+)\s+(\w+)\s*\((.*?)\)\s+check/gi,
        (match, dc, ability, skills) => {
            const dcPart = `${dc}`;
            const abilityEntry = Object.values(CONFIG.DND5E.abilities).find(a => a.fullKey.toLowerCase() === ability.toLowerCase());

            if (!abilityEntry) return match;

            const replacements = skills
                .split(/\s*\bor\b\s*/i)
                .map(skill => normalizeText(skill))
                .map(skill => Object.values(CONFIG.DND5E.skills).find(s => s.fullKey.toLowerCase() === skill))
                .filter(Boolean)
                .map(skillEntry => `[[/skill ${abilityEntry.fullKey} ${skillEntry.fullKey} ${dcPart}]]`);

            return replacements.length > 0 ? `${replacements.join(" or ")} check` : match;
        }
    );
}

/**
 * Enriches ability checks (e.g., "DC 15 Strength check")
 */
function enrichAbilityChecks(content) {
    return content.replace(
        /DC\s+(\d+)\s+(\w+)\s+check/gi,
        (match, dc, ability) => {
            const abilityEntry = Object.values(CONFIG.DND5E.abilities).find(a => a.fullKey.toLowerCase() === ability.toLowerCase());
            return abilityEntry ? `[[/check ${abilityEntry.fullKey} ${dc}]] check` : match;
        }
    );
}

/**
 * Enriches passive checks, supporting these formats for skills and tools:
 * - "passive Wisdom (Perception) score of 20 (or higher)"
 * - "passive perception score of 20 (or higher)"
 */
function enrichPassiveChecks(content) {
    // Handles "passive ability (skill) score of X or higher"
    let newContent = content.replace(
        /passive\s+([\w\s']+?)\s*\((.*?)\)\s+score\s+of\s+(\d+)(?:\s+or higher)?/gi,
        (match, ability, skillOrTool, dc) => {
            const abilityEntry = Object.values(CONFIG.DND5E.abilities).find(
                a => a.fullKey.toLowerCase() === ability.toLowerCase()
            );
            const normalizedSkillOrTool = normalizeText(skillOrTool);

            if (!abilityEntry) return match;

            const skillEntry = Object.values(CONFIG.DND5E.skills).find(
                s => normalizeText(s.fullKey) === normalizedSkillOrTool
            );
            if (skillEntry) return `[[/skill ${abilityEntry.fullKey} ${skillEntry.fullKey} ${dc} passive format=long]]`;

            const toolEntry = Object.entries(TOOL_IDS).find(
                ([name]) => normalizeText(name) === normalizedSkillOrTool
            );
            if (toolEntry) return `[[/tool ${abilityEntry.fullKey} ${toolEntry[1]} ${dc} passive format=long]]`;

            return match;
        }
    );

    // Handles "passive skill score of X or higher"
    newContent = newContent.replace(
        /passive\s+([\w\s']+?)\s+score\s+of\s+(\d+)(?:\s+or higher)?/gi,
        (match, skill, dc) => {
            const normalizedSkill = normalizeText(skill);
            const skillEntry = Object.values(CONFIG.DND5E.skills).find(
                s => normalizeText(s.fullKey) === normalizedSkill
            );

            return skillEntry
                ? `[[/skill ${skillEntry.fullKey} ${dc} passive format=long]]`
                : match;
        }
    );

    return newContent;
}


/**
 * Enriches tool checks (e.g., "DC 15 Dexterity (Thieves' Tools) check"). 
 * To add new tool checks, these need to be added to config.js, making sure you use the same id as you defined for your custom tool.
 */
function enrichToolChecks(content) {
    return content.replace(
        /DC\s+(\d+)\s+(\w+)\s+\((.*?)\)\s+check/gi,
        (match, dc, ability, tool) => {
            const abilityEntry = Object.values(CONFIG.DND5E.abilities).find(a => a.fullKey.toLowerCase() === ability.toLowerCase());
            const toolEntry = Object.entries(TOOL_IDS).find(([name]) => normalizeText(name) === normalizeText(tool));

            return (abilityEntry && toolEntry) ? `[[/tool ${abilityEntry.fullKey} ${toolEntry[1]} ${dc}]] check` : match;
        }
    );
}

/**
 * Enriches saving throws (e.g., "DC 15 Strength saving throw")
 */
function enrichSavingThrows(content) {
    return content.replace(
        /DC\s+(\d+)\s+(\w+)\s+saving throw/gi,
        (match, dc, ability) => {
            const abilityEntry = Object.values(CONFIG.DND5E.abilities).find(a => a.fullKey.toLowerCase() === ability.toLowerCase());
            return abilityEntry ? `[[/save ${abilityEntry.fullKey} ${dc}]] saving throw` : match;
        }
    );
}

/**
 * Enriches damage rolls, supporting these formats:
 * - "5 (1d6+2) fire damage"
 * - "1d6 + 3 piercing damage"
 * - "5d6 damage" 
 * - "1d6+3 piercing damage"
 */
function enrichDamageRolls(content) {
    return content.replace(
        /(?:(\d+)\s*\(\s*(\d+d\d+\s*(?:[+-]\s*\d+)?)\s*\)|(\d+d\d+\s*(?:[+-]\s*\d+)?))\s*(\w+)?\s*damage/gi,
        (match, avg, diceParens, diceNormal, damageType) => {
            const dice = (diceParens || diceNormal).replace(/\s+/g, ""); // Remove spaces within dice expressions

            if (!damageType || !CONFIG.DND5E.damageTypes[damageType.toLowerCase()]) return match;

            return avg
                ? `[[/damage ${dice} ${damageType} average=true]] damage`
                : `[[/damage ${dice} ${damageType}]] damage`;
        }
    );
}

/**
 * Enriches healing rolls, supporting these formats:
 * - "2d8 + 5 hit points/temporary hit points"
 * - "2d8+5 hitpoints/temporary hit points"
 */
function enrichHealingRolls(content) {
    return content.replace(
        /(\d+d\d+\s*(?:[+-]\s*\d+)?)\s+(hit points|temporary hit points)/gi,
        (match, dice, healingType) => {
            const type = healingType.toLowerCase().includes("temporary") ? "temphp" : "healing";
            return `[[/damage ${dice.replace(/\s+/g, "")} ${type}]]`; // Remove spaces directly
        }
    );
}

/**
 * Enriches attack rolls (e.g., "+6 to hit" or "+ 6 to hit"). Missing DnD v4 implementation.
 */
function enrichAttackRolls(content) {
    return content.replace(/\+\s*(\d+)\s*to\s+hit/gi, (match, bonus) => `[[/r 1d20+${bonus}]] to hit`);
}


/**
 * Enriches awards (e.g., "50 gp", "250ep each", "100 xp")
 */
function enrichAwards(content) {
    const currencyTypes = Object.keys(CONFIG.DND5E.currencies).join("|") + "|xp";
    return content.replace(
        new RegExp(`(?<!\\[\\[/award\\s*)\\b(\\d+)\\s*(${currencyTypes})(\\s+each)?\\b(?!\\]\\])`, "gi"),
        (match, amount, type, each) => each ? `[[/award ${amount}${type} each]]` : `[[/award ${amount}${type}]]`
    );
}

/**
 * Helper function to enrich references
 * @param {string} content - The journal entry content
 * @param {Object} dataset - The dataset from CONFIG.DND5E or another config source
 * @returns {string} - The enriched content
 */
function enrichReferences(content, dataset) {
    // Extract only entries that have a "reference"
    const entries = Object.values(dataset)
        .filter(entry => entry.reference)
        .map(entry => entry.label);

    if (entries.length === 0) return content;

    const pattern = entries.map(e => e.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');

    // Improved regex with strict negative lookahead
    const regex = new RegExp(
        `\\b(${pattern})\\b(?![^()]*\\))`, // Exclude matches already followed by (...)
        'gi'
    );

    // Create case-insensitive lookup map
    const entryMap = Object.fromEntries(
        Object.values(dataset)
            .filter(entry => entry.reference)
            .map(entry => [entry.label.toLowerCase(), entry.label])
    );

    return content.replace(regex, (match) => {
        const originalCaseLabel = entryMap[match.toLowerCase()];

        // Check if already replaced in this match
        console.log(content);
        if (new RegExp(`${originalCaseLabel}\\s*\\(See\\s+&amp;Reference\\[`).test(content)) {
            console.log("found match");
            return match;
        }

        return `${originalCaseLabel} (See &Reference[${originalCaseLabel.toLowerCase()}])`;
    });
}


function enrichConditions(content) {
    return enrichReferences(content, CONFIG.DND5E.conditionTypes);
}

function enrichCreatureType(content) {
    return enrichReferences(content, CONFIG.DND5E.creatureTypes);
}

function enrichAOE(content) {
    return enrichReferences(content, CONFIG.DND5E.areaTargetTypes);
}

function enrichSpellSchool(content) {
    return enrichReferences(content, CONFIG.DND5E.spellSchools);
}

function enrichSpellComponents(content) {
    return enrichReferences(content, { ...CONFIG.DND5E.spellTags, ...CONFIG.DND5E.spellComponents });
}

/**
 * Uses RULES_IDs instead of CONFIG.DND5E.
 */
function enrichRules(content) {
    return enrichReferences(content, Object.fromEntries(Object.keys(RULES_IDs).map(key => [key, { label: key, reference: true }])));
}

/**
 * Helper function to removes spaces & apostrophes
 * @param {string} text - The text to normalize
 * @returns {string} - Normalized text
 */
function normalizeText(text) {
    return text.replace(/[\u2019\u2018\u0027]/g, "").replace(/\s+/g, "").toLowerCase();
}


    
