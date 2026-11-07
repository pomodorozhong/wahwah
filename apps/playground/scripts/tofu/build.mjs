// Run from the repository root with npm run build:tofu.
// Each output is self-contained; three-vrm is only required by the playground.
import { mkdir, writeFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { actingChannels, bodyChannels, buildMeshes, jawWeights, poses } from './mesh.mjs';
import { cubeStudies } from './cubes.mjs';

const output = new URL('../../public/tofu/',import.meta.url);
const metre = .14;


// GLTFExporter needs this one browser API to pack its buffers into a GLB.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend();
  }
};

function rig(scene) {
  const bones = {};
  const add=(name,parent,x,y,z=0)=>{
    const bone = new T.Bone();
    bone.name=name;
    bone.position.set(x,y,z);
    (bones[parent] ?? scene).add(bone);
    bones[name]=bone;
  };
  // The avatar is a head puppet. An unmeshed humanoid chain keeps standard
  // tracking/retargeting usable, with the whole sculpture fixed to the head.
  add('hips',null,0,.82);
  add('spine','hips',0,.23);
  add('chest','spine',0,.15);
  add('neck','chest',0,.12);
  add('head','neck',0,.08);
  for (const [side,sign] of [['left',1],['right',-1]]) {
    add(side+'UpperLeg','hips',sign*.08,-.04);
    add(side+'LowerLeg',side+'UpperLeg',0,-.38);
    add(side+'Foot',side+'LowerLeg',0,-.38);
    add(side+'UpperArm','chest',sign*.16,.08);
    add(side+'LowerArm',side+'UpperArm',sign*.26,0);
    add(side+'Hand',side+'LowerArm',sign*.24,0);
  }
  return bones;
}

// Bound simultaneous expressions, not just one shape at a time. The two
// body weights and blink are independent. The five vowel weights sum to ≤1.
// Mesh coordinates are in sculpture units until the head's transform below.
function performanceBounds(pieces) {
  const bounds = new T.Box3();
  for (const mesh of pieces) {
    const rest = mesh.geometry.attributes.position;
    const targets = mesh.geometry.morphAttributes.position ?? [];
    const channels = Object.entries(mesh.morphTargetDictionary ?? {});
    for (let i=0; i<rest.count; i++) {
      for (const [axis, get] of [['x','getX'], ['y','getY'], ['z','getZ']]) {
        let minimum = rest[get](i), maximum = minimum;
        let vowelMin = 0, vowelMax = 0;
        for (const [channel,index] of channels) {
          const delta = targets[index][get](i);
          if (channel === 'blink' || !poses.includes(channel)) {
            minimum += Math.min(0,delta);
            maximum += Math.max(0,delta);
          } else {
            vowelMin = Math.min(vowelMin,delta);
            vowelMax = Math.max(vowelMax,delta);
          }
        }
        bounds.min[axis] = Math.min(bounds.min[axis],minimum + vowelMin);
        bounds.max[axis] = Math.max(bounds.max[axis],maximum + vowelMax);
      }
    }
  }
  return bounds;
}

async function build(design) {
  const scene=new T.Scene();
  scene.userData.tofuMotion={...design.motion, glanceSide:parseInt(design.id,10)%2 ? 1 : -1};
  const bones=rig(scene), model=new T.Group();
  model.name=design.name;
  model.scale.setScalar(metre);
  bones.head.add(model);
  const pieces = buildMeshes(design, design.surface);
  model.add(...pieces);
  if (design.jaw) {
    const hinge = new T.Group();
    hinge.name = 'DialogueJaw';
    hinge.position.fromArray(design.jaw.pivot);
    hinge.userData.maxOpenAngle = design.jaw.angle;
    model.add(hinge);
    for (const piece of pieces.filter(p => p.userData.studyJoint === 'jaw')) {
      piece.position.sub(hinge.position);
      hinge.add(piece);
    }
    if (!hinge.children.length) throw Error(design.name+' has an empty jaw joint.');
  }
  model.updateWorldMatrix(true,false);
  const bounds = performanceBounds(pieces).applyMatrix4(model.matrixWorld);
  scene.userData.tofuFrame = {min:bounds.min.toArray(), max:bounds.max.toArray()};
  const exporter=new GLTFExporter();
  exporter.register(writer=>({
    afterParse() {
      const node=object=>writer.nodeMap.get(object);
      const humanBones=Object.fromEntries(Object.entries(bones).map(([name,bone])=>[name,{node:node(bone)}]));
      const preset={}, custom={};
      for(const pose of [...poses, ...bodyChannels, ...actingChannels]) {
        const binds=pieces.filter(m=>m.morphTargetDictionary?.[pose]!==undefined)
          .map(m=>({node:node(m),index:m.morphTargetDictionary[pose],weight:1}));
        if (design.jaw && pose in jawWeights) {
          for (const mesh of pieces.filter(p => p.userData.studyJoint === 'jaw')) {
            binds.push({node:node(mesh),index:mesh.morphTargetDictionary.hingeOpen,weight:jawWeights[pose]});
          }
        }
        const expressions = poses.includes(pose) ? preset : custom;
        if(binds.length) expressions[pose]={morphTargetBinds:binds};
        else if(pose!=='blink') throw Error(design.name+' lacks a '+pose+' pose');
      }
      writer.json.extensions={...writer.json.extensions,VRMC_vrm:{
        specVersion:'1.0',
        meta:{name:design.name,authors:['wahwah'],version:'1.0',licenseUrl:'https://vrm.dev/licenses/1.0/'},
        humanoid:{humanBones}, expressions:{preset,custom},
      }};
      writer.extensionsUsed.VRMC_vrm=true;
    },
  }));
  const bytes=await exporter.parseAsync(scene,{binary:true});
  await writeFile(new URL('corner-cut.vrm',output), Buffer.from(bytes));
  console.log(design.id,Math.round(bytes.byteLength/1024)+' KiB');
}

await mkdir(output,{recursive:true});
for (const study of cubeStudies) await build(study);
