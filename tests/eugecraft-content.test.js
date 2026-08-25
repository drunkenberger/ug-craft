const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadDefinitions() {
  const source = [
    read('js/i18n.js'),
    read('js/config.js'),
    read('js/items.js'),
    read('js/maps.js'),
    'globalThis.__defs = { BLOCKS, RECIPES, MOB_DROPS: globalThis.MOB_DROPS, MAPS, I18N };',
  ].join('\n');
  const context = { console, globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.__defs;
}

function testDecorativeBlocks() {
  const { BLOCKS, RECIPES, MAPS, I18N } = loadDefinitions();
  const expected = {
    28: 'painting',
    29: 'lantern',
    30: 'vase',
    31: 'glass',
    32: 'brick',
  };

  for (const [id, key] of Object.entries(expected)) {
    assert.equal(BLOCKS[id].key, key);
    assert.ok(I18N.es[`block_${key}`], `missing Spanish name for ${key}`);
    assert.ok(I18N.en[`block_${key}`], `missing English name for ${key}`);
    assert.ok(
      RECIPES.some((recipe) => recipe.out.id === Number(id)),
      `missing recipe for block ${id}`
    );
    assert.ok(MAPS.creative.hotbar.includes(Number(id)), `creative hotbar missing ${id}`);
  }
}

function testCreeperContent() {
  const mobs = read('js/mobs.js');
  const netplay = read('js/netplay.js');

  assert.match(mobs, /class Creeper extends Creature/);
  assert.match(mobs, /this\.netType = 'creeper'/);
  assert.match(mobs, /explode\(/);
  assert.match(mobs, /creeper:\s*\[/);
  assert.match(mobs, /new Creeper\(this\.scene/);
  assert.match(netplay, /e\.ty === 'creeper'/);
}

function testGameModularization() {
  const game = read('js/game.js');
  const index = read('index.html');

  for (const file of ['game-combat.js', 'game-interactions.js', 'game-lifecycle.js']) {
    assert.ok(fs.existsSync(path.join(root, 'js', file)), `${file} was not created`);
    assert.match(index, new RegExp(`js/${file}`), `${file} is not loaded by index.html`);
  }

  assert.match(game, /Object\.assign\(Game\.prototype,\s*GameCombat,\s*GameInteractions,\s*GameLifecycle\)/);
  assert.doesNotMatch(game, /^\s+targetCreature\(\)/m);
  assert.doesNotMatch(game, /^\s+bindControls\(\)/m);
  assert.doesNotMatch(game, /^\s+update\(dt\)/m);
}

testDecorativeBlocks();
testCreeperContent();
testGameModularization();
console.log('EugeCraft content tests passed');
