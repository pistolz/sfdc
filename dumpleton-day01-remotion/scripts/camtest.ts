import * as THREE from "three";
import { cameraAt, cameraMatrix, CAM_FOV } from "../src/camera";
import P from "../src/data/proj.json";
const cam = new THREE.PerspectiveCamera(CAM_FOV, 1080/1920, 0.5, 6000);
const anchors: any = { cabin: [0,2,5.736], ghost0: [9,-7,4], sign: [-7,-11.4,1.7] };
let maxe=0;
for (const fr of [0,100,300,390,450,600,800,900,1000,1100,1300,1500,1700,1800,2000,2200,2300,2500]) {
  const t = fr/30;
  const s = cameraAt(t);
  if (fr>=600&&fr<=760 || fr>=1820&&fr<=1980) continue;
  cam.matrixAutoUpdate=false; cam.matrixWorld.copy(cameraMatrix(s)); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const out:string[]=[];
  for (const k of Object.keys(anchors)) {
    const [x,y,z]=anchors[k]; const v=new THREE.Vector3(x,z,-y).project(cam);
    const px=[(v.x*0.5+0.5)*1080,(0.5-v.y*0.5)*1920]; const ref=(P as any).anchors[fr][k];
    if(ref){ const e=Math.hypot(px[0]-ref[0],px[1]-ref[1]); if(Math.abs(ref[0])<3000&&Math.abs(ref[1])<3000) maxe=Math.max(maxe,e); out.push(`${k}:${px[0].toFixed(0)},${px[1].toFixed(0)} ref ${ref[0]},${ref[1]}`);}
  }
  console.log(fr, out.join(' | '));
}
console.log('max err px', maxe);
