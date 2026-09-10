import {test} from 'node:test';
import assert from 'node:assert/strict';
import {axis, fromSensor} from '../src/orientation.mjs';
import {angularVelocity, omegaFromRate, tipVelocity, tipAngleDeg, directionLabel, SwingDetector} from '../src/swing.mjs';

const close=(a,b,tol=1e-6)=>Math.abs(a-b)<tol;

test('angular velocity of a 90° x-rotation over 0.5s is 180°/s',()=>{
  const w=angularVelocity([0,0,0,1], axis(1,0,0,90), 0.5);
  assert.ok(close(w[0],180,1e-3));assert.ok(close(w[1],0,1e-3));assert.ok(close(w[2],0,1e-3));
});
test('angular velocity takes the shortest arc across 359°→1°',()=>{
  const w=angularVelocity(fromSensor(359,0,0), fromSensor(1,0,0), 0.1);
  assert.ok(close(Math.hypot(...w),20,1e-3));
  assert.ok(Math.abs(w[2])>19); // rotation about the z axis, not a 358° spin
});
test('rotationRate maps beta/gamma/alpha onto x/y/z',()=>{
  assert.deepEqual(omegaFromRate({alpha:1,beta:2,gamma:3}),[2,3,1]);
  assert.deepEqual(omegaFromRate(null),[0,0,0]);
});
test('tip velocity is ω × blade and yields the slash direction',()=>{
  assert.deepEqual(tipVelocity([0,0,-100]),[100,0,0]); // roll → tip right
  assert.deepEqual(tipVelocity([100,0,0]),[0,0,100]);  // pitch → tip forward
  assert.deepEqual(tipVelocity([0,300,0]),[0,0,0]);    // twist about blade: no tip motion
});
test('tip angle and labels cover all 8 directions',()=>{
  assert.ok(close(tipAngleDeg([0,0,-100]),0));    assert.equal(directionLabel(0),'右');
  assert.ok(close(tipAngleDeg([100,0,0]),90));    assert.equal(directionLabel(90),'前');
  assert.ok(close(tipAngleDeg([0,0,100]),180));   assert.equal(directionLabel(180),'左');
  assert.ok(close(tipAngleDeg([-100,0,0]),-90));  assert.equal(directionLabel(-90),'后');
  assert.equal(directionLabel(45),'右前');assert.equal(directionLabel(135),'左前');
  assert.equal(directionLabel(-135),'左后');assert.equal(directionLabel(-45),'右后');
});
test('slow drift below the threshold never fires',()=>{
  const d=new SwingDetector({threshold:160,release:90});
  for(let i=1;i<=200;i++)assert.equal(d.sample([45,0,0],i*16),null);
});
test('one swing fires exactly once with peak speed and direction',()=>{
  const d=new SwingDetector({threshold:160,release:90,refractoryMs:300});
  let now=0,out=null;
  for(const s of [0,80,150,200,260,300,260,180,120,60]){now+=20;out=d.sample([s,0,0],now);}
  assert.ok(out);
  assert.equal(out.speed,300);
  assert.equal(out.label,'前');
  assert.equal(out.durationMs,120);
});
test('refractory period blocks an immediate second swing',()=>{
  const d=new SwingDetector({threshold:160,release:90,refractoryMs:300});
  let now=0,count=0;
  const swing=()=>{for(const s of [0,200,300,200,50]){now+=16;if(d.sample([s,0,0],now))count++;}};
  swing();swing();
  assert.equal(count,1);
});
test('a sustained swing above threshold is a single pending attack',()=>{
  const d=new SwingDetector({threshold:160,release:90});
  let now=0,count=0;
  for(let i=0;i<60;i++){now+=16;if(d.sample([200,0,0],now))count++;}
  assert.equal(count,0); // still above threshold, not yet reported
  for(let i=0;i<10;i++){now+=16;if(d.sample([0,0,0],now))count++;}
  assert.equal(count,1); // reported once on release
});
test('twisting about the blade axis is not a swing',()=>{
  const d=new SwingDetector({threshold:160,release:90});
  for(let i=1;i<=50;i++)assert.equal(d.sample([0,300,0],i*16),null);
});
