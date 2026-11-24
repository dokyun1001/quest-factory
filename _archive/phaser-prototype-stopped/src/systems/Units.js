import { UNITS, TILE } from '../art/manifest.js';

/** Shared sprite wrapper: picks run/idle anims and faces the move direction. */
export class Unit {
  constructor(scene, kind, x, y) {
    this.scene = scene;
    this.art = UNITS[kind];
    this.sprite = scene.add.sprite(x, y, scene.anims.get(this.art.idle).frames[0].textureKey)
      .setOrigin(0.5, this.art.originY).setScale(this.art.scale);
    if (this.art.tint) this.sprite.setTint(this.art.tint);
    this.sprite.play(this.art.idle);
    this.speed = 150;
    this.busyAnim = false;
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }

  /** Moves by (vx,vy) px/s, picks the animation matching the movement. */
  move(vx, vy, dt, runAnim = this.art.run, idleAnim = this.art.idle) {
    if (vx || vy) {
      this.sprite.x += vx * dt;
      this.sprite.y += vy * dt;
      if (vx < -1) this.sprite.setFlipX(true);
      else if (vx > 1) this.sprite.setFlipX(false);
      if (!this.busyAnim) this.sprite.play(runAnim, true);
    } else if (!this.busyAnim) {
      this.sprite.play(idleAnim, true);
    }
    this.sprite.setDepth(1000 + this.sprite.y);
  }

  /** Steer toward (tx,ty). Returns true when arrived. */
  goTo(tx, ty, dt, runAnim, idleAnim) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) { this.move(0, 0, dt, runAnim, idleAnim); return true; }
    const s = Math.min(this.speed, d / dt);
    this.move((dx / d) * s, (dy / d) * s, dt, runAnim, idleAnim);
    return false;
  }

  playOnce(anim, cb) {
    this.busyAnim = true;
    this.sprite.play(anim);
    this.sprite.once('animationcomplete', () => { this.busyAnim = false; cb?.(); });
  }
}

/**
 * Worker (Pawn): resource node -> work -> carry -> deposit at hopper -> repeat.
 * resource: 'gold' | 'wood'
 */
export class Worker extends Unit {
  constructor(scene, x, y, resource, node, hopper) {
    super(scene, 'worker', x, y);
    this.resource = resource; this.node = node; this.hopper = hopper;
    this.state = 'toNode';
    this.workTime = 0;
    this.speed = 110;
  }

  update(dt, world) {
    const a = this.art;
    const tool = this.resource === 'gold' ? 'pickaxe' : 'axe';
    if (this.state === 'toNode') {
      const tx = this.node.x + (this.x < this.node.x ? -44 : 44), ty = this.node.y + 6;
      if (this.goTo(tx, ty, dt, a.runWith[tool], a.idle)) {
        this.sprite.setFlipX(this.x > this.node.x);
        this.state = 'work'; this.workTime = 0;
        this.sprite.play(a.work[this.resource]);
      }
    } else if (this.state === 'work') {
      this.workTime += dt;
      if (this.workTime > 2.4) { this.state = 'toHopper'; world.onHarvest?.(this.node); }
      this.sprite.setDepth(1000 + this.y);
    } else if (this.state === 'toHopper') {
      const h = this.hopper;
      if (!h || !world.factory.list.includes(h)) { this.state = 'toNode'; return; }
      if (this.goTo(h.cx, h.cy + TILE * 0.6, dt, a.runWith[this.resource], a.idle)) {
        world.factory.deposit(h, this.resource === 'gold' ? 'gold_ore' : 'wood', 1);
        world.puff(h.cx, h.cy);
        this.state = 'toNode';
      }
    }
  }
}

/** Adventurer: idles near the guild, takes a quest, travels to the field, returns with rewards. */
export class Adventurer extends Unit {
  constructor(scene, kind, x, y, fieldPoint) {
    super(scene, kind, x, y);
    this.home = { x, y }; this.field = fieldPoint;
    this.state = 'idle'; this.t = Math.random() * 3; this.speed = 120;
  }

  update(dt, world) {
    if (this.state === 'idle') {
      this.move(0, 0, dt);
      this.t -= dt;
      if (this.t <= 0 && world.guild.quests > 0) {
        world.guild.quests--; this.state = 'out';
        world.toast('모험가가 의뢰를 수락했다!');
      }
    } else if (this.state === 'out') {
      if (this.goTo(this.field.x, this.field.y, dt)) { this.state = 'fight'; this.t = 3; }
    } else if (this.state === 'fight') {
      this.move(0, 0, dt); this.t -= dt;
      if (this.t <= 0) this.state = 'back';
    } else if (this.state === 'back') {
      if (this.goTo(this.home.x, this.home.y, dt)) {
        this.state = 'idle'; this.t = 2 + Math.random() * 2;
        world.questDone();
      }
    }
  }
}
