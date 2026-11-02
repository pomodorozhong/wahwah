// Selected candidate 12: clipped corners, Pond Button's painted face,
// Mochi Yawn's hinged mouth, and Brush Ink's body field and timing.
import { addCube, cubeJaw } from './cube-shell.mjs';
import { addEyes } from './cube-eyes.mjs';
import { brushInkBody, brushInkTiming } from './cube-motion.mjs';
const profile = {id:'12-corner-cut', name:'Tofu cube', face:'yawn',
  mouth:'hinge', width:.19, smile:.012, mouthY:-.14};
export const cubeStudies = [{...profile, surface:'print', jaw:cubeJaw(profile), motion:brushInkTiming,
  build(api) {
    addCube(api,profile,brushInkBody);
    addEyes(api,profile,brushInkBody);
  },
}];
