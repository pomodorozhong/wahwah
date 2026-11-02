// The front (+Z) is a continuous skin around a small, modelled mouth opening.
// Scale, pose positions and hinge pivot are in the same sculpture units.
import * as T from 'three';

const H = .90, V = (x, y, z) => new T.Vector3(x, y, z);
const { lerp, smoothstep } = T.MathUtils;
// Neutral white skin with cool gray sides. The expanded inverted hull is
// 2.4 times the original study's thickness, including all speaking poses.
const skin = {surface:'print', outline:.034, shade(p,n) {
  const height=(p.y+H)/(2*H);
  const front=new T.Color('#f2f3f1').lerp(new T.Color('#ffffff'),height);
  const side=new T.Color('#aab6be').lerp(new T.Color('#d4dce0'),smoothstep(height,.03,.95));
  return front.lerp(side,1-smoothstep(n.z+.38*n.y,-.05,.97))
    .lerp(new T.Color('#ffffff'),smoothstep(n.y,.35,.96));
}};

// Bases are right-handed and the first face is always the one with the mouth.
const bases = [
  [[1,0,0],[0,1,0],[0,0,1]], [[-1,0,0],[0,1,0],[0,0,-1]],
  [[0,0,-1],[0,1,0],[1,0,0]], [[0,0,1],[0,1,0],[-1,0,0]],
  [[1,0,0],[0,0,-1],[0,1,0]], [[1,0,0],[0,0,1],[0,-1,0]],
];
const local=(basis,x,y,z)=>V(...basis.map((_,i)=>basis[0][i]*x+basis[1][i]*y+basis[2][i]*z));
const key=p=>[p.x,p.y,p.z].map(Math.fround).join('/');
function geometry(points,faces,normals) {
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(points,3));
  g.setIndex(faces);
  if(normals) g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  else g.computeVertexNormals();
  return g;
}

// Cut a polyhedron from planes: six flat panels, twelve planar edge bevels,
// eight snipped corners. No smooth normals or printed triangles on these cuts.
function cutShell(part,skin,body) {
  const [bevel,corner]=[.035,.225];
  const e=H-bevel, c=H-corner;
  const rim=[[e,-c],[e,c],[c,e],[-c,e],[-e,c],[-e,-c],[-c,-e],[c,-e]];
  const points=[],faces=[],normals=[],outlinePoints=[];
  function polygon(vertices){
    // Sort each convex polygon CCW around its outward normal.
    const center=vertices.reduce((v,p)=>v.add(p),V(0,0,0)).divideScalar(vertices.length);
    const n=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    if(n.dot(center)<0)n.negate();
    const u=vertices[0].clone().sub(center).normalize(),v=n.clone().cross(u);
    vertices.sort((p,q)=>Math.atan2(p.clone().sub(center).dot(v),p.clone().sub(center).dot(u))-Math.atan2(q.clone().sub(center).dot(v),q.clone().sub(center).dot(u)));
    const i=points.length/3;
    for(const p of vertices){
      points.push(...p.toArray());normals.push(...n.toArray());
      // Use the convex block for the inverted hull. A hull on the shallow
      // indented panels can peek through the skin as an unwanted ink seam.
      const hull=p.clone();
      if(Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))<H-.001){
        const axis=['x','y','z'].sort((a,b)=>Math.abs(p[b])-Math.abs(p[a]))[0];
        hull[axis]=Math.sign(p[axis])*H;
      }
      outlinePoints.push(...hull.toArray());
    }
    for(let j=1;j<vertices.length-1;j++)faces.push(i,i+j,i+j+1);
  }
  // Midpoints keep the body deformation continuous across adjacent panels.
  const perimeter=rim.flatMap(([x,y],i)=>{
    const [xx,yy]=rim[(i+1)%8];
    return [[x,y],...((i%2===0)?[[(x+xx)/2,(y+yy)/2]]:[])];
  });
  for(const [f,basis] of bases.entries()){
    if(f===0)continue;
    const ctr=local(basis,0,0,H);
    for(let i=0;i<perimeter.length;i++){
      const p=perimeter[i],q=perimeter[(i+1)%perimeter.length];
      polygon([ctr,local(basis,...p,H),local(basis,...q,H)]);
    }
  }
  for(let along=0;along<3;along++)for(const s of [-1,1])for(const t of [-1,1]){
    const a=(along+1)%3,b=(along+2)%3;
    const at=(v,x,y)=>{const p=[0,0,0];p[along]=v;p[a]=s*x;p[b]=t*y;return V(...p);};
    for(const [v,w] of [[-c,0],[0,c]]) polygon([at(v,H,e),at(v,e,H),at(w,e,H),at(w,H,e)]);
  }
  for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
    const permutations=[[H,e,c],[H,c,e],[c,H,e],[e,H,c],[e,c,H],[c,e,H]];
    polygon(permutations.map(([x,y,z])=>V(sx*x,sy*y,sz*z)));
  }
  part('Hand-cut tofu block',geometry(points,faces,normals),{...skin,outline:0,body});
  if(skin.outline)part('Continuous ink silhouette',geometry(outlinePoints,faces),{...skin,body,hullOnly:true});
  return perimeter;
}

// Each drawing has four key silhouettes. Dimensions are half-width (as a
// fraction of the face's mouth width), rise above the pen line and drop
// below it. IH and OH are in-betweens of those drawings.
const drawings = {
  yawn: {rest:[.20,.017,.023], aa:[1.02,.133,.492], ee:[1.18,.022,.103], ou:[.55,.091,.208], ink:'#632c36', tongue:'#efa49a'},
};
const vowelBlend = {
  aa:['aa','aa',0], ee:['ee','ee',0], ou:['ou','ou',0],
  ih:['aa','ee',.63], oh:['aa','ou',.57],
};
const mouthShapes = Object.fromEntries(Object.entries(drawings).map(([face,d]) => [
  face, {...d,...Object.fromEntries(Object.entries(vowelBlend).map(([pose,[a,b,t]]) =>
    [pose,d[a].map((value,i)=>lerp(value,d[b][i],t))]))},
]));

// The small rest dot opens into the softly squared yawn silhouette.
function strokeY(_p,x,pose) {
  return (pose?.033:.008)*x*x;
}

function mouthPoint(p,x,y,pose) {
  const shape=mouthShapes[p.face];
  const [width,up,down]=shape[pose]??shape.rest;
  const lip=y>=0?up:down;
  // Flatten the top and bottom of the yawn slightly.
  const power=.76;
  let height=lip*Math.sign(y)*Math.abs(y)**power;
  // Keep a continuous lower curve through the open vowel.
  const line=strokeY(p,x,pose);
  return V(p.width*width*x,p.mouthY+line+height,H);
}

const lip=(p,a,pose)=>mouthPoint(p,Math.cos(a),Math.sin(a),pose);

// A disk or annulus defined by corresponding vertex rings. Pose evaluation
// uses its authored coordinates rather than inferring lip weights from height.
function rings(part,name,angles,levels,at,options,{disk=false,flat=false,pigment}={}) {
  const points=[],faces=[],parameters=new Map(),normals=flat?[]:undefined,n=angles.length;
  for(const t of levels) for(const a of angles){
    const p=at(t,a,undefined);
    points.push(...p.toArray());parameters.set(key(p),[t,a]);
    if(flat) normals.push(0,0,1);
  }
  for(let j=1;j<levels.length;j++)for(let i=0;i<n;i++){
    const a=(j-1)*n+i,b=(j-1)*n+(i+1)%n,c=a+n,d=b+n;
    faces.push(a,c,d, a,d,b);
  }
  if(disk) {
    const i=points.length/3,center=at(0,0,undefined);
    points.push(...center.toArray());parameters.set(key(center),[0,0]);
    if(flat)normals.push(0,0,1);
    for(let j=0;j<n;j++)faces.push(i,j,(j+1)%n);
  }
  part(name,geometry(points,faces,normals),{...options,
    ...(pigment?{shade:p=>pigment(...parameters.get(key(p)))}:{}),deform(p,pose){
    if(!vowelBlend[pose]) return p;
    return at(...parameters.get(key(p)),pose);
  }});
}

export function cubeJaw(p) {
  if(p.mouth!=='hinge')return;
  const angle=p.face==='yawn'?.55:.46;
  const shape=mouthShapes[p.face];
  const lever=(shape.aa[2]-shape.rest[2])/Math.sin(angle);
  return {pivot:[0,p.mouthY,H-lever],angle};
}

export function addCube({part},p,body){
  const boundary=cutShell(part,skin,body);
  const boundaryAt=new Map(boundary.map(xy=>[Math.atan2(xy[1],xy[0]),V(...xy,H)]));
  const outerAngles=[...boundaryAt.keys()].sort((a,b)=>a-b);
  // The oval has more samples than the panel boundary. Extra edge vertices
  // are collinear at rest; use the same interpolated boundary displacement as
  // the bevel (also under body morphs), to avoid cracks when the cube bends.
  const angles=[],edgeInfo=new Map();
  outerAngles.forEach((a,i)=>{
    const next=outerAngles[(i+1)%outerAngles.length],end=next<=a?next+2*Math.PI:next;
    const from=boundaryAt.get(a),to=boundaryAt.get(next);
    const steps=Math.max(1,Math.ceil((end-a)/.17));
    for(let k=0;k<steps;k++){
      const t=k/steps,point=from.clone().lerp(to,t);
      const angle=Math.atan2(point.y,point.x);
      angles.push(angle);edgeInfo.set(angle,{point,from,to,t});
    }
  });
  const bodyAtEdge=new Map();
  for(const {point,from,to,t} of edgeInfo.values())bodyAtEdge.set(key(point),{from,to,t});
  const panelBody=(q,ch)=>{
    const edge=bodyAtEdge.get(key(q));
    return edge?body(edge.from.clone(),ch).lerp(body(edge.to.clone(),ch),edge.t):body(q,ch);
  };
  const skinAt=(r,a,pose)=>{
    // Redistribute the whole panel along each ray. Even the largest yawn
    // then leaves its skin rings in order, with no fold over the chin.
    return lip(p,a,pose).lerp(edgeInfo.get(a).point,r);
  };
  rings(part,'Face around the mouth',angles,[0,.13,.38,.70,1],skinAt,{...skin,body:panelBody},{flat:true});

  const art=mouthShapes[p.face],hinge=p.mouth==='hinge';
  const insideAt=(r,a,pose)=>{
    // Draw within the mouth's own bent coordinate system. A triangle fan
    // across world space would bridge the two hollows of a closed W smile.
    const deep=p.face==='yawn';
    const t=hinge&&!deep?Math.min(1,r/.38):r;
    const q=mouthPoint(p,t*Math.cos(a),t*Math.sin(a),pose);
    q.z=deep ? H-.32*Math.min(1,(1-r)/.45) : H-(hinge?.112:.003)*(1-r);
    return q;
  };
  const ink=new T.Color(art.ink),fill=new T.Color(art.fill??art.ink),tongue=new T.Color(art.tongue);
  rings(part,'Painted mouth interior',angles,hinge&&p.face!=='yawn'?[.38,.73,1]:[.30,.52,.75,.87,1],insideAt,
    {body,surface:'print'}, {disk:true,flat:true,pigment:(r,a)=>{
      if(hinge)return ink;
      const x=r*Math.cos(a),y=r*Math.sin(a);
      const tongueTop=(p.face==='ripple'?-.63:-.46)-.46*(x+.13)**2;
      return fill.clone().lerp(tongue,1-smoothstep(y,tongueTop-.13,tongueTop+.045))
        .lerp(ink,smoothstep(r,.81,.95));
    }});

  if(!hinge)return;

  // This shelf swings down from a real pivot. Its front edge follows
  // the curved lower stroke. The warm inner lip turns towards the camera
  // as the speaker opens up, while the top of the muzzle stays put.
  const yawn=p.face==='yawn',halfJaw=yawn?1.9:1.35;
  const points=[],indices=[],uv=new Map(),columns=22;
  function jawPoint(x,depth,sink,pose) {
    // Parameterize by the illustrated lip, including its rest curvature.
    // The hinge supplies the drop; the vowel morph gathers the corners.
    const t=T.MathUtils.clamp(x,-1,1);
    const shape=art[pose]??art.rest;
    const lower=art.rest[2]*Math.sqrt(1-t*t);
    const belly=yawn?Math.max(0,1-.42*x*x):1-t*t;
    const y=p.mouthY+strokeY(p,t,pose)-lower-.009-sink;
    const crown=Math.sin(Math.PI*depth)*belly;
    return V(x*p.width*shape[0],y+(yawn?.092:.030)*crown,H-.011-depth*(yawn?.16*(.4+.6*belly):.10));
  }
  // On the tall yawn, the front of the tongue continues behind the lower
  // edge of the mouth so the pink silhouette stays attached in side view.
  const rows=yawn?[[0,.15],[0,0],[.4,0],[1,0]]:[[0,0],[.4,0],[1,0]];
  for(const [row,[depth,sink]] of rows.entries())for(let i=0;i<=columns;i++){
    const x=(2*i/columns-1)*halfJaw,q=jawPoint(x,depth,sink);
    points.push(...q.toArray());uv.set(key(q),[x,depth,sink]);
    if(i&&row){const k=points.length/3-1;indices.push(k-columns-2,k-columns-1,k,k-columns-2,k,k-1);}
  }
  part('Pivoting lower ink lip',geometry(points,indices),{joint:'jaw',body,doubleSided:true,surface:'print',
    shade(q){const [x,depth,sink]=uv.get(key(q));return ink.clone().lerp(tongue,yawn?.95-sink:(1-Math.min(1,x*x))*(.52+.48*depth));},
    deform(q,pose){return vowelBlend[pose]?jawPoint(...uv.get(key(q)),pose):q;}});
}
