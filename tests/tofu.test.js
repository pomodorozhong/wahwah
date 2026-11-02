import { expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { cubeStudies as designs } from '../scripts/tofu/cubes.mjs';
import { actingChannels, jawWeights } from '../scripts/tofu/mesh.mjs';
import { StudyMotion } from '../src/host/studyMotion';
import { NEUTRAL } from '../src/puppet/controls';

it.each(designs)('$name keeps its cube silhouette at rest', design => {
  const bounds = new Box3();
  const corners = [];
  for (const x of [-.9,.9]) for (const y of [-.9,.9]) for (const z of [-.9,.9]) {
    corners.push({point:new Vector3(x,y,z), distance:Infinity});
  }
  let triangles = 0;
  const vertex = new Vector3();
  design.build({part(_name, geometry) {
    const positions = geometry.getAttribute('position');
    triangles += (geometry.index?.count ?? positions.count) / 3;
    for (let i=0; i<positions.count; i++) {
      vertex.fromBufferAttribute(positions,i);
      bounds.expandByPoint(vertex);
      for (const corner of corners) corner.distance = Math.min(corner.distance, vertex.distanceTo(corner.point));
    }
  }});
  // Small bevels and flush facial art are intentional. Ears, a projecting
  // muzzle, a tail, or a sphere with the same bounding box fail this check.
  expect(bounds.getSize(new Vector3()).toArray()).toEqual([
    expect.closeTo(1.8,2), expect.closeTo(1.8,2), expect.closeTo(1.85,1),
  ]);
  expect(Math.max(...corners.map(c => c.distance))).toBeLessThan(.25);
  expect(triangles).toBeLessThan(2000);
});

it('uses the Brush Ink shoulder roll and timing on every face', () => {
  // The rear right shoulder drops on attack and comes forward on release.
  // These endpoints and time constants are from the original study 05.
  for (const design of designs) {
    expect(design.motion).toMatchObject({attack:.067, release:.14, follow:.19});
    let checkedShell = false;
    design.build({part(name, _geometry, {body}) {
      if (!name.endsWith('tofu block')) return;
      checkedShell = true;
      const shoulder = new Vector3(.9,.9,-.9);
      expect(body(shoulder,'drive').distanceTo(new Vector3(1.055,.746,-1.005))).toBeLessThan(1e-6);
      expect(body(shoulder,'follow').distanceTo(new Vector3(.847,.9,-.789))).toBeLessThan(1e-6);
      const foot = new Vector3(.9,-.9,-.9);
      for (const channel of ['drive','follow']) expect(body(foot,channel)).toEqual(foot);
    }});
    expect(checkedShell).toBe(true);
  }
});

it.each(designs)('$name moves different body regions and articulates vowels separately', design => {
  const rearDisplacements = new Box3();
  let strongestLead = 0, strongestFollow = 0;
  const vowels = new Map(['aa','ee','ou'].map(pose => [pose, 0]));
  const rest = new Vector3();
  design.build({ part(_name, geometry, { body, deform, joint } = {}) {
    const vertices = geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      rest.fromBufferAttribute(vertices, i);
      if (rest.z < 0) {
        const lead = body ? body(rest.clone(), 'drive').sub(rest) : new Vector3();
        const follow = body ? body(rest.clone(), 'follow').sub(rest) : new Vector3();
        strongestLead = Math.max(strongestLead, lead.length());
        strongestFollow = Math.max(strongestFollow, follow.length());
        rearDisplacements.expandByPoint(lead);
      }
      if ((deform || joint === 'jaw') && rest.z > .15) {
        for (const [pose, previous] of vowels) {
          const posed = deform ? deform(rest.clone(), pose) : rest.clone();
          if (joint === 'jaw') {
            const pivot = new Vector3(...design.jaw.pivot);
            posed.sub(pivot).applyAxisAngle(new Vector3(1,0,0), design.jaw.angle*jawWeights[pose]).add(pivot);
          }
          vowels.set(pose, Math.max(previous, posed.distanceTo(rest)));
        }
      }
    }
  } });
  expect(strongestLead).toBeGreaterThan(.12);
  expect(strongestFollow).toBeGreaterThan(.07);
  expect(rearDisplacements.getSize(new Vector3()).length()).toBeGreaterThan(.16);
  for (const movement of vowels.values()) expect(movement).toBeGreaterThan(.03);
});

it.each(designs)('$name can aim the eyes while holding the brows, and lift the brows while holding the eyes', design => {
  const travel = Object.fromEntries(actingChannels.map(c => [c, 0]));
  design.build({part(_name, geometry, {expression} = {}) {
    if (!expression) return;
    const positions = geometry.attributes.position;
    for (let i=0; i<positions.count; i++) {
      const rest = new Vector3().fromBufferAttribute(positions,i);
      const delta = channel => expression(rest.clone(),channel).distanceTo(rest);
      const brow = delta('browAccent');
      for (const gaze of ['gazeLeft','gazeRight','gazeUp','gazeDown']) {
        const gazeMove = delta(gaze);
        if (brow < .001) travel[gaze] = Math.max(travel[gaze], gazeMove);
        if (gazeMove < .001) travel.browAccent = Math.max(travel.browAccent,brow);
      }
    }
  }});
  for (const distance of Object.values(travel)) expect(distance).toBeGreaterThan(.025);
});

it('shifts focus across the phrase and releases a brow accent during a sustained vowel', () => {
  const motion = new StudyMotion({attack:.04, release:.11, follow:.15, acting:'curious'});
  const speak = frames => { for (let i=0; i<frames; i++) motion.update({...NEUTRAL,jawOpen:.8}, 1/60); };
  speak(11);
  expect(motion.gazeX).toBeGreaterThan(.7);
  expect(motion.brow).toBeGreaterThan(.8);
  speak(65);
  expect(motion.gazeX).toBeLessThan(-.25);
  expect(motion.brow).toBeLessThan(.06);
  for (let i=0; i<90; i++) motion.update(NEUTRAL,1/60);
  expect(Math.abs(motion.gazeX)).toBeLessThan(.01);
});

it('lets a trailing body part finish its stroke after the mouth closes', () => {
  const motion = new StudyMotion({attack:.03, release:.06, follow:.18});
  for (let i=0; i<8; i++) motion.update({...NEUTRAL, jawOpen:1}, 1/60);
  expect(motion.drive).toBeGreaterThan(motion.follow + .3);
  for (let i=0; i<10; i++) motion.update(NEUTRAL, 1/60);
  expect(motion.follow).toBeGreaterThan(motion.drive + .1);
  for (let i=0; i<100; i++) motion.update(NEUTRAL, 1/60);
  expect(motion.follow).toBeLessThan(.001);
});
