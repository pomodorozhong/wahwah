// Bake the artist's deformation fields into standard VRM expression targets.
// Batch small marks by material and by active poses, so an ink dot does not
// require a separate draw call or six empty morph targets.
import * as T from 'three';

export const poses = ['aa', 'ih', 'ou', 'ee', 'oh', 'blink'];
export const bodyChannels = ['drive', 'follow'];
export const actingChannels = ['gazeLeft', 'gazeRight', 'gazeUp', 'gazeDown', 'browAccent'];
// A standard VRM player can open the jaw using these vowel bindings. The
// playground uses their weighted sum as a rotation about the actual hinge.
export const jawWeights = { aa:1, ih:.50, ee:.16, ou:.39, oh:.76 };
const ink = new T.Color('#211e25');
const finishes = {
  porcelain: {roughness:.34}, clay: {roughness:.91}, mineral: {roughness:.37, metalness:.13},
  satin: {roughness:.79}, lacquer: {roughness:.20}, wax: {roughness:.56},
  pewter: {roughness:.35, metalness:.40},
};

function addTriangleIndices(batch, geometry, offset, reverse) {
  const indices = geometry.index;
  const length = indices?.count ?? geometry.attributes.position.count;
  for (let i = 0; i < length; i += 3) {
    for (const k of reverse ? [0, 2, 1] : [0, 1, 2]) {
      batch.indices.push(offset + (indices ? indices.getX(i + k) : i + k));
    }
  }
}

// Share extrusion directions at split UVs and hard edges to keep the ink closed.
function hullDirections(position, normal) {
  const smoothing = new Map();
  const directions = [];
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)]
      .map(n => Math.round(n * 1e5)).join(',');
    const direction = smoothing.get(key) ?? new T.Vector3();
    direction.add(new T.Vector3().fromBufferAttribute(normal, i));
    smoothing.set(key, direction);
    directions.push(direction);
  }
  for (const v of smoothing.values()) v.normalize();
  return directions;
}

// Let highlights travel with a moving glazed or upholstered surface. Compute
// the change from the same topology in both poses, preserving the sculpt's
// authored normals at rest (including hard edges and sewn seams).
function deformedNormals(geometry, targets) {
  const surface = new T.BufferGeometry();
  surface.setIndex(geometry.index);
  const rest = geometry.attributes.position;
  surface.setAttribute('position', rest.clone());
  surface.computeVertexNormals();
  const restNormals = surface.attributes.normal.array.slice();
  return targets.map(target => {
    const positions = surface.attributes.position.array;
    for (let i=0; i<positions.length; i++) positions[i] = rest.array[i] + target.array[i];
    surface.computeVertexNormals();
    const normals = surface.attributes.normal.array;
    const deltas = Float32Array.from(normals, (n,i) => n-restNormals[i]);
    return new T.BufferAttribute(deltas, 3);
  });
}

export function buildMeshes(design, defaultSurface) {
  const batches = new Map();
  function part(name, geometry, { color='#fff7e8', shade, outline=0, hullOnly=false, deform, body, expression, joint='', doubleSided=false, surface=defaultSurface }={}) {
    const position = geometry.attributes.position;
    if (!position?.count) throw Error('Empty part: '+name);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const normal = geometry.attributes.normal;
    const deltas = {};
    const fields = [[deform, poses], [body, bodyChannels], [expression, actingChannels]];
    if (joint === 'jaw') {
      const pivot = new T.Vector3(...design.jaw.pivot);
      const axis = new T.Vector3(1,0,0);
      fields.push([p => p.sub(pivot).applyAxisAngle(axis,design.jaw.angle).add(pivot), ['hingeOpen']]);
    }
    for (const [field, channels] of fields) {
      if (!field) continue;
      for (const pose of channels) {
        const data = new Float32Array(position.count * 3);
        let active = false;
        for (let i = 0; i < position.count; i++) {
          const rest = new T.Vector3().fromBufferAttribute(position, i);
          const v = field(rest.clone(), pose).sub(rest);
          if (!Number.isFinite(v.lengthSq())) throw Error(name+' has invalid '+pose+' geometry');
          if (v.lengthSq() > 1e-12) active = true;
          v.toArray(data, i*3);
        }
        if (active) deltas[pose] = data;
      }
    }
    const directions = outline ? hullDirections(position, normal) : null;
    for (const shell of directions ? (hullOnly ? [true] : [false,true]) : [false]) {
      const method = shell ? 'ink' : surface;
      const sided = !shell && doubleSided;
      const key = [joint,method,sided,...Object.keys(deltas)].join('/');
      if (!batches.has(key)) batches.set(key,{
        name, joint, method, sided, positions:[], normals:[], colors:[], indices:[],
        targets:Object.fromEntries(Object.keys(deltas).map(p=>[p,[]])),
      });
      const batch = batches.get(key), offset = batch.positions.length/3;
      const base = new T.Color(color);
      for (let i = 0; i < position.count; i++) {
        const p = new T.Vector3().fromBufferAttribute(position,i);
        const n = new T.Vector3().fromBufferAttribute(normal,i);
        const pigment = shell ? ink : shade ? new T.Color(shade(p.clone(),n.clone())) : base;
        if (shell) { p.addScaledVector(directions[i],outline); n.negate(); }
        batch.positions.push(p.x,p.y,p.z);
        batch.normals.push(n.x,n.y,n.z);
        batch.colors.push(...pigment.toArray().map(c=>Math.round(255*T.MathUtils.clamp(c,0,1))));
      }
      addTriangleIndices(batch,geometry,offset,shell);
      for (const [pose, data] of Object.entries(deltas)) for (const d of data) batch.targets[pose].push(d);
    }
  }
  design.build({part});
  return Array.from(batches.values(), b=>{
    const geom = new T.BufferGeometry();
    geom.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));
    geom.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));
    geom.setAttribute('color',new T.Uint8BufferAttribute(b.colors,3,true));
    geom.setIndex(b.indices);
    const options = {vertexColors:true,side:b.sided ? T.DoubleSide : T.FrontSide};
    const material = finishes[b.method]
      ? new T.MeshStandardMaterial({...options,...finishes[b.method]})
      : new T.MeshBasicMaterial(options);
    material.name=b.method;
    geom.morphTargetsRelative=true;
    const names=Object.keys(b.targets);
    if(names.length) geom.morphAttributes.position=names.map(p=>{
      const target=new T.Float32BufferAttribute(b.targets[p],3); target.name=p; return target;
    });
    if (names.length && finishes[b.method]) {
      geom.morphAttributes.normal = deformedNormals(geom, geom.morphAttributes.position);
    }
    const mesh=new T.Mesh(geom,material);
    if (b.joint) mesh.userData.studyJoint=b.joint;
    mesh.name=b.name+' / '+b.method;
    return mesh;
  });
}
