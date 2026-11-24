import { UNITS, MONSTERS } from '../art/manifest.js';
import { DEPTH } from './Factory.js';

/** Sprite wrapper: picks run/idle anims, faces the move direction, y-sorts. */
export class Unit {
  constructor(scene, art, x, y) {
    this.scene = scene;
    this.art = art;
    this.sprite = scene.add.sprite(x, y, scene.anims.get(art.idle).frames[0].textureKey)
      .setOrigin(0.5, art.originY ?? 0.62);
    if (art.tint) this.sprite.setTint(art.tint);
    this.sprite.play({ key: art.idle, startFrame: Math.floor(Math.random() * 4) });
    this.speed = 150;
    this.busy = false;
    this.sort();
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  sort() { this.sprite.setDepth(DEPTH.world + this.sprite.y); }

  move(vx, vy, dt, runAnim = this.art.run, idleAnim = this.art.idle) {
    if (vx || vy) {
      this.sprite.x += vx * dt; this.sprite.y += vy * dt;
      if (vx < -1) this.sprite.setFlipX(true); else if (vx > 1) this.sprite.setFlipX(false);
      if (!this.busy) this.sprite.play(runAnim, true);
    } else if (!this.busy) {
      this.sprite.play(idleAnim, true);
    }
    this.sort();
  }

  /** Steer toward (tx,ty); true on arrival. */
  goTo(tx, ty, dt, runAnim, idleAnim) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.move(0, 0, dt, runAnim, idleAnim); return true; }
    const s = Math.min(this.speed, d / dt);
    this.move((dx / d) * s, (dy / d) * s, dt, runAnim, idleAnim);
    return false;
  }

  playOnce(anim, cb) {
    this.busy = true;
    this.sprite.play(anim);
    this.sprite.once('animationcomplete', () => { this.busy = false; cb?.(); });
  }

  destroy() { this.sprite.destroy(); }
}

/** Worker (Pawn): node → chop/mine → carry → warehouse door → repeat. */
export class Worker extends Unit {
  constructor(scene, x, y, resource, node, drop) {
    super(scene, UNITS.worker, x, y);
    this.resource = resource; this.node = node; this.drop = drop;
    this.state = 'toNode'; this.t = 0; this.speed = 105;
  }

  update(dt, world) {
    const a = this.art;
    const tool = this.resource === 'gold' ? 'pickaxe' : 'axe';
    if (this.state === 'toNode') {
      const side = this.x < this.node.x ? -1 : 1;
      if (this.goTo(this.node.x + side * 46, this.node.y + 4, dt, a.runWith[tool])) {
        this.sprite.setFlipX(side > 0);
        this.state = 'work'; this.t = 0;
        this.sprite.play(a.work[this.resource]);
      }
    } else if (this.state === 'work') {
      this.t += dt;
      if (this.t > 2.4) { this.state = 'carry'; world.shake(this.node); }
    } else if (this.state === 'carry') {
      if (this.goTo(this.drop.x, this.drop.y, dt, a.runWith[this.resource])) {
        world.addStock(this.resource === 'gold' ? 'gold_ore' : 'wood', 1, this.x, this.y - 40);
        this.state = 'toNode';
      }
    }
  }
}

/** Adventurer: waits at the guild → dispatched on a quest → fights → returns with loot. */
export class Adventurer extends Unit {
  constructor(scene, info, home) {
    super(scene, UNITS[info.kind], home.x, home.y);
    this.info = info; this.home = home;
    this.state = 'idle'; this.speed = 125; this.quest = null;
  }

  dispatch(quest) { this.quest = quest; this.state = 'out'; }

  update(dt, world) {
    if (this.state === 'idle') { this.move(0, 0, dt); return; }
    const q = this.quest;
    if (this.state === 'out') {
      if (this.goTo(q.spot.x - 70, q.spot.y, dt)) { this.state = 'fight'; this.t = 0; this.sprite.setFlipX(false); }
    } else if (this.state === 'fight') {
      this.t += dt;
      this.move(0, 0, dt);
      if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) world.puff(q.spot.x - 30, q.spot.y - 10);
      if (this.t > q.fightTime) this.state = 'back';
    } else if (this.state === 'back') {
      if (this.goTo(this.home.x, this.home.y, dt)) {
        this.state = 'idle';
        world.completeQuest(this, q);
        this.quest = null;
      }
    }
  }
}

export class Monster extends Unit {
  constructor(scene, id, x, y) {
    super(scene, MONSTERS[id], x, y);
    this.id = id;
    this.sprite.setFlipX(true);
  }
}
