// W3C intrinsic Z-X'-Y'' rotations. Quaternions use [x,y,z,w].
export const identity = () => [0, 0, 0, 1];
export const rad = Math.PI / 180;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function multiply(a, b) {
  const [x,y,z,w] = a, [X,Y,Z,W] = b;
  return [w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X, w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z];
}
export const inverse = q => [-q[0], -q[1], -q[2], q[3]];
export const normalize = q => { const n = Math.hypot(...q); return q.map(v => v/n); };
export function axis(x,y,z, degrees) { const h = degrees*rad/2; return [x*Math.sin(h),y*Math.sin(h),z*Math.sin(h),Math.cos(h)]; }
export function fromSensor(alpha, beta, gamma, screen = 0) {
  return normalize(multiply(multiply(multiply(axis(0,0,1,alpha), axis(1,0,0,beta)), axis(0,1,0,gamma)), axis(0,0,1,-screen)));
}
export function distance(a,b) { return 2*Math.acos(clamp(Math.abs(a.reduce((s,v,i) => s+v*b[i],0)),0,1))/rad; }
export function slerp(a,b,t) {
  let d = a.reduce((s,v,i) => s+v*b[i],0);
  if (d < 0) { b=b.map(v=>-v); d=-d; }
  d=clamp(d,0,1);
  if(d>0.9995) return normalize(a.map((v,i)=>v+(b[i]-v)*t));
  const theta=Math.acos(d), s=Math.sin(theta);
  return a.map((v,i)=>(v*Math.sin((1-t)*theta)+b[i]*Math.sin(t*theta))/s);
}
export class PoseFilter {
  constructor(deadband=0.65) { this.deadband=deadband; this.reset(); }
  reset(q=identity(), time=0) { this.value=q.slice(); this.target=q.slice(); this.previous=q.slice(); this.sampleTime=time; this.speed=0; }
  sample(q,time) {
    const dt=clamp((time-this.sampleTime)/1000,1/240,0.1);
    const speed=distance(this.previous,q)/dt;
    this.speed += (speed-this.speed)*(1-Math.exp(-dt/0.06));
    this.previous=q.slice(); this.sampleTime=time;
    // Compare with the held target, so slow intentional motion accumulates.
    if(distance(this.target,q)>this.deadband) this.target=q.slice();
  }
  step(dt) {
    const gap=distance(this.value,this.target);
    if(gap<0.015) { this.value=this.target.slice(); return false; }
    // Large movements bypass the slow cutoff immediately; no debounce timer.
    const hz=clamp(5+this.speed*0.16+gap*1.5,5,45);
    this.value=slerp(this.value,this.target,1-Math.exp(-2*Math.PI*hz*Math.min(dt,0.05)));
    return true;
  }
}
// Device coordinates: right/up/towards viewer. CSS coordinates: right/down/towards viewer.
// Conjugating by Y reflection preserves physical handedness (not a mirrored camera).
export function cssMatrix(q) {
  const [x,y,z,w]=[-q[0],q[1],-q[2],q[3]];
  return `matrix3d(${[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,0,0,0,1].map(v=>+v.toFixed(7)).join(',')})`;
}
export function angles(q) {
  const [x,y,z,w]=q;
  return [Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y))/rad,Math.asin(clamp(2*(w*y-z*x),-1,1))/rad,Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z))/rad];
}
