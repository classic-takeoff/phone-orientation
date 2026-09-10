// Swing (挥动) detection from angular velocity.
//
// DeviceOrientationEvent reports angles, not motion. To recognise a swing and
// its direction you need angular velocity (degrees/second) — the rate at which
// the phone is rotating. It comes from the gyroscope (DeviceMotionEvent
// .rotationRate) or, as a fallback, by differentiating consecutive orientation
// quaternions. A swing is fast rotation, so we threshold its speed; the
// direction is the rotation axis. Equivalently the blade tip moves along
// ω × blade, so the tip velocity is the slash direction a game should read.
import { multiply, inverse, clamp } from './orientation.mjs';

// Angular velocity in the device frame, deg/s, around the device axes
// [x, y, z] = [left-right, top, out-of-screen]. q0 is the previous
// orientation quaternion, q1 the current one, dt the elapsed seconds.
export function angularVelocity(q0, q1, dt) {
  if (!(dt > 0)) return [0, 0, 0];
  let dq = multiply(q1, inverse(q0));   // rotation carrying q0 onto q1
  if (dq[3] < 0) dq = dq.map(v => -v);  // shortest-path sign, avoid 2π jumps
  const [x, y, z, w] = dq;
  const half = Math.hypot(x, y, z);
  if (half < 1e-7) return [0, 0, 0];
  const angle = 2 * Math.acos(clamp(w, -1, 1)); // radians along the short arc
  const k = (angle / half) * (180 / Math.PI) / dt;
  return [x * k, y * k, z * k];
}

// W3C rotationRate reports alpha/beta/gamma around Z/X/Y; reorder to [x,y,z].
export function omegaFromRate(r) {
  return [r?.beta ?? 0, r?.gamma ?? 0, r?.alpha ?? 0];
}

// The blade extends from the phone's top = device +Y.
export const BLADE = [0, 1, 0];

// Blade-tip direction, ω × blade. Only the components of ω perpendicular to
// the blade move the tip; twisting about the blade itself (roll) does not.
// The result lives in the device X–Z plane.
export function tipVelocity(omega) {
  const [wx, , wz] = omega;
  return [-wz, 0, wx].map(v => v + 0); // ω × [0,1,0]; +0 normalises −0
}

// Tip direction as a compass angle in the device X–Z plane:
// 0° = +X (phone's right), 90° = +Z (toward the user), ±180° = −X (left).
export function tipAngleDeg(omega) {
  const [wx, , wz] = omega;
  return Math.atan2(wx, -wz) * 180 / Math.PI;
}

const LABELS = ['右', '右前', '前', '左前', '左', '左后', '后', '右后'];
export function directionLabel(angleDeg) {
  return LABELS[((Math.round(angleDeg / 45) % 8) + 8) % 8];
}

// Hysteresis state machine. A swing arms once the tip speed exceeds
// `threshold`; it reports exactly one attack (at the peak) once the speed
// falls back below `release`, then re-arms only after `refractoryMs`. Slow
// drift never fires, and one continuous swing fires only once.
export class SwingDetector {
  constructor({ threshold = 160, release = 90, refractoryMs = 300, minDurationMs = 30 } = {}) {
    this.threshold = threshold;
    this.release = release;
    this.refractoryMs = refractoryMs;
    this.minDurationMs = minDurationMs;
    this.reset();
  }
  reset() {
    this.armed = false;
    this.readyAt = 0;
    this.startTime = 0;
    this.peakSpeed = 0;
    this.peakOmega = [0, 0, 0];
    this.speed = 0;
  }
  // `omega` is [x,y,z] deg/s in the device frame; `now` is a millisecond
  // timestamp. Returns an attack object once per swing, otherwise null:
  // { speed, omega, angleDeg, label, durationMs, at }.
  sample(omega, now = 0) {
    const speed = Math.hypot(omega[0], omega[2]); // |ω × blade| = tip speed
    this.speed = speed;
    if (!this.armed) {
      if (speed >= this.threshold && now >= this.readyAt) {
        this.armed = true;
        this.startTime = now;
        this.peakSpeed = speed;
        this.peakOmega = omega.slice();
      }
      return null;
    }
    if (speed > this.peakSpeed) {
      this.peakSpeed = speed;
      this.peakOmega = omega.slice();
    }
    if (speed < this.release) {
      this.armed = false;
      this.readyAt = now + this.refractoryMs;
      if (this.peakSpeed >= this.threshold && now - this.startTime >= this.minDurationMs) {
        const angleDeg = tipAngleDeg(this.peakOmega);
        return {
          speed: this.peakSpeed,
          omega: this.peakOmega.slice(),
          angleDeg,
          label: directionLabel(angleDeg),
          durationMs: now - this.startTime,
          at: now,
        };
      }
    }
    return null;
  }
}
