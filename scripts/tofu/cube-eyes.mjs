// Pond Button's single-mark eyes, with a softer peach cheek wash.
import * as T from 'three';
const paper=.915, ink=.925;
// A fan is enough to print a mark on the flat panel. Keeping the boundary
// as an artist-defined loop gives seeds, brush tips and pooled ink their shape.
function stamp(x, y, z, contour, samples = 28) {
  const pos=[x,y,z], index=[];
  for(let i=0;i<samples;i++) {
    const angle=2*Math.PI*i/samples;
    const [dx,dy]=contour(Math.cos(angle),Math.sin(angle));
    pos.push(x+dx,y+dy,z);
    index.push(0,1+i,1+(i+1)%samples);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// Draw a quadratic brush stroke tapering to both ends. Ribbons also serve
// as closed eyes: their curved centres need a strip rather than a fan.
function stroke(start, bend, end, width, z = paper, steps = 12) {
  const pos=[], index=[];
  for(let i=0;i<=steps;i++) {
    const t=i/steps, u=1-t;
    const x=u*u*start[0]+2*u*t*bend[0]+t*t*end[0];
    const y=u*u*start[1]+2*u*t*bend[1]+t*t*end[1];
    const dx=u*(bend[0]-start[0])+t*(end[0]-bend[0]);
    const dy=u*(bend[1]-start[1])+t*(end[1]-bend[1]);
    const radius=width*(.055+.945*Math.sin(Math.PI*t)**.62)/Math.hypot(dx,dy);
    pos.push(x-dy*radius,y+dx*radius,z,x+dy*radius,y-dx*radius,z);
    const k=2*i;
    if(i) index.push(k-2,k-1,k,k,k-1,k+1);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}


export function addEyes({part},_profile,body) {
  const spec={gap:.442,y:.248,w:.206,h:.226,tilt:.05};
  const pigment='#6b2516',samples=32;
  const draw=(name,geometry,color,options={})=>part(name,geometry,{
    body,color,surface:'print',doubleSided:true,...options,
  });
  for(const side of [-1,1]) {
    const x=side*spec.gap,y=spec.y+side*.028,w=spec.w,h=spec.h;
    const crease=p=>{
      const u=T.MathUtils.clamp((p.x-x)/w,-1,1);
      return y+.24*h*(1-u*u)+spec.tilt*side*(p.x-x);
    };
    draw('Printed eye',stamp(x,y,ink,(c,s)=>{
      const u=side*c*(1+.08*s),v=s-.07*c*c;
      return [side*w*u,h*v+spec.tilt*w*u];
    },samples),pigment,{
      expression(p,ch) {
        const dx=Math.max(.046,w*.40),dy=Math.max(.034,h*.28);
        if(ch==='gazeLeft')p.x-=dx;
        if(ch==='gazeRight')p.x+=dx;
        if(ch==='gazeUp')p.y+=dy;
        if(ch==='gazeDown')p.y-=dy;
        return p;
      },
      deform(p,pose) {
        if(pose==='blink')p.y=crease(p)+(p.y-crease(p))*.13;
        return p;
      },
    });
    draw('Cheek wash',stamp(side*.520,-.033,paper,(c,s)=>[
      .150*c*(1+.065*s),.125*s,
    ],samples),'#efd4cb');
    const points=[[.338,y+h+.001],[.444,y+h+.051],[.528,y+h+.010]]
      .map(([xx,yy])=>[side*xx,yy]);
    draw('Frog brow',stroke(...points,.022,.887),pigment,{
      expression(p,ch) {
        if(ch==='browAccent'){
          p.y+=(side<0?.114:.079)-side*(p.x-x)*.16;
          p.z+=.040;
        }
        return p;
      },
    });
  }
}
