/**
 * The whole 3D layer: environment, the floating head (photo cutout with depth relief),
 * clouds, and the record crate (playlist picker). React owns the HUD; this owns the canvas.
 *
 * Talks to React through window CustomEvents:
 *   "pp-ask"    detail: question text (head clicked)
 *   "pp-play"   detail: record index (record clicked)
 * and through the returned api: setRecord(i), dispose().
 */
import * as THREE from "three";

const A = import.meta.env.BASE_URL + "assets/";
/** Cutout images + their depth maps (made with tools/make_cutout.py). w/h = pixel size of the image. */
export const ASSETS = {
  head: { img: A + "head.webp", depth: A + "head-depth.png", w: 815, h: 1000 }
};

export function createScene({ canvas, tip, playlists, headAsk }) {

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000,0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0,0,10); scene.add(camera);

  /* ---------- environment for the glossy records ---------- */
  (function(){
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50,48,24), new THREE.ShaderMaterial({side:THREE.BackSide,
      vertexShader:`varying vec3 v; void main(){ v=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 v; void main(){ float h=v.y; vec3 c = h>0. ? mix(vec3(1.2),vec3(.08,.2,.28),pow(h,.6)) : mix(vec3(1.2),vec3(.05),clamp(-h*5.,0.,1.)); gl_FragColor=vec4(c,1.);}`})));
    const box=(c,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); env.add(m);};
    box(new THREE.Color(9,9,8),12,18,14,10,6); box(new THREE.Color(2.2,.5,.15),-26,0,10,14,8); box(new THREE.Color(3,3,3),0,4,-28,30,3);
    const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(env,.03).texture; pm.dispose();
  })();
  scene.add(new THREE.HemisphereLight(0xeef8ff,0x5a4636,.7));
  const sun=new THREE.DirectionalLight(0xfff1dc,2.0); sun.position.set(4,7,6); scene.add(sun);

  /* ---------- photo cutouts with real depth relief (Depth Anything V2) ---------- */
  const loader = new THREE.TextureLoader();
  function tex(src, color){ const t=loader.load(src); if(color) t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; return t; }
  const T = {};
  for (const k of Object.keys(ASSETS)) T[k] = {map:tex(ASSETS[k].img,true), depth:tex(ASSETS[k].depth,false), aspect:ASSETS[k].w/ASSETS[k].h};

  const CUT_VS = `uniform sampler2D uDepth; uniform float uAmp; varying vec2 vUv;
    void main(){ vUv=uv; float d=texture2D(uDepth,uv).r; vec3 p=position; p.z += (d-.5)*uAmp;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
  const CUT_FS = `uniform sampler2D uMap; uniform float uTime, uFade, uGlow, uSheen; varying vec2 vUv;
    void main(){ vec4 c=texture2D(uMap,vUv); if(c.a<.12) discard;
      float lum=dot(c.rgb,vec3(.299,.587,.114));
      float sweep=fract(uTime*.07)*3.2-1.; float band=smoothstep(.08,0.,abs((vUv.x*.8+vUv.y*.6)-sweep));
      c.rgb += band*pow(lum,2.6)*uSheen*vec3(1.,.95,.85);
      c.rgb *= 1.+uGlow*.12;
      gl_FragColor=vec4(c.rgb,c.a*uFade);
      #include <colorspace_fragment>
    }`;
  const MASK={};
  for (const k of Object.keys(ASSETS)){ const im=new Image(); im.onload=()=>{ const W=96,H=Math.round(96/T[k].aspect);
    const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d"); x.drawImage(im,0,0,W,H);
    const d=x.getImageData(0,0,W,H).data, a=new Uint8Array(W*H); for(let i=0;i<W*H;i++) a[i]=d[i*4+3]; MASK[k]={a,W,H}; }; im.src=ASSETS[k].img; }
  function opaqueAt(key,uv){ const m=MASK[key]; if(!m) return true;
    const x=Math.min(m.W-1,Math.max(0,Math.floor(uv.x*m.W))), y=Math.min(m.H-1,Math.max(0,Math.floor((1-uv.y)*m.H))); return m.a[y*m.W+x]>90; }

  function cutout(key, height, amp, sheen=0){
    const t=T[key], w=height*t.aspect;
    const geo=new THREE.PlaneGeometry(w,height,Math.round(160*t.aspect),160);
    const u={uMap:{value:t.map},uDepth:{value:t.depth},uAmp:{value:amp},uTime:{value:0},uFade:{value:0},uGlow:{value:0},uSheen:{value:sheen}};
    const mesh=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,vertexShader:CUT_VS,fragmentShader:CUT_FS,transparent:true,depthWrite:true,toneMapped:false}));
    // hover/click test against a 2-triangle plane + a small alpha mask, not the 19k-vertex relief mesh
    const hit=new THREE.Mesh(new THREE.PlaneGeometry(w,height),new THREE.MeshBasicMaterial({visible:false}));
    const g=new THREE.Group(); g.add(mesh); g.add(hit); g.userData.u=u; g.userData.mesh=mesh; g.userData.hit=hit; g.userData.key=key;
    return g;
  }

  const head = cutout("head", 3.8, 1.25, .9);
  scene.add(head);

  // clicking the head asks the assistant a question (content.js: assistant.headAsk)
  head.userData.hover=0;

  /* ---------- clouds ---------- */
  function cloudTexture(seed){
    const c=document.createElement("canvas"); c.width=512; c.height=256; const x=c.getContext("2d");
    let s=seed; const r=()=>((s=(s*9301+49297)%233280)/233280);
    for(let i=0;i<46;i++){ const px=60+r()*392, py=150-r()*90*Math.sin((px/512)*Math.PI), rad=30+r()*60;
      const gr=x.createRadialGradient(px,py,0,px,py,rad); gr.addColorStop(0,"rgba(255,255,255,.95)"); gr.addColorStop(.6,"rgba(255,255,255,.55)"); gr.addColorStop(1,"rgba(255,255,255,0)");
      x.fillStyle=gr; x.beginPath(); x.arc(px,py,rad,0,7); x.fill(); }
    x.globalCompositeOperation="source-atop";
    const sh=x.createLinearGradient(0,60,0,240); sh.addColorStop(0,"rgba(255,255,255,0)"); sh.addColorStop(1,"rgba(120,150,165,.55)");
    x.fillStyle=sh; x.fillRect(0,0,512,256);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
  }
  const cloudTex=[cloudTexture(3),cloudTexture(11),cloudTexture(29)], clouds=[];
  for(let i=0;i<50;i++){ const back=i>=34;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex[i%3],transparent:true,depthWrite:false,opacity:back?.55:.95,toneMapped:false}));
    const w=back?6+Math.random()*6:5+Math.random()*7; sp.scale.set(w,w*.5,1);
    sp.position.set(-15+Math.random()*30, back?1+Math.random()*4:-3.2-Math.random()*2.6, back?-17-Math.random()*8:-6+Math.random()*9);
    sp.userData.v=.08+Math.random()*.18; scene.add(sp); clouds.push(sp); }

  /* ---------- the record crate: pick a playlist in 3D ---------- */
  const LIST = playlists;
  function recordTexture(p){
    const c=document.createElement("canvas"); c.width=c.height=512; const x=c.getContext("2d"), m=256;
    x.fillStyle="#0c0f10"; x.beginPath(); x.arc(m,m,256,0,7); x.fill();
    for(let r=250;r>92;r-=2.2){ x.strokeStyle=`rgba(255,255,255,${.025+.03*Math.random()})`; x.lineWidth=1; x.beginPath(); x.arc(m,m,r,0,7); x.stroke(); }
    [[250,.0],[176,.1],[132,.08]].forEach(([r])=>{ x.strokeStyle="rgba(0,0,0,.8)"; x.lineWidth=3; x.beginPath(); x.arc(m,m,r,0,7); x.stroke(); });
    x.fillStyle=p.color; x.beginPath(); x.arc(m,m,90,0,7); x.fill();
    x.fillStyle=p.ink; x.textAlign="center"; x.font="800 30px 'Bricolage Grotesque', Arial, sans-serif";
    const words=p.name.toUpperCase().split(" "); const lines=words.length>2?[words.slice(0,2).join(" "),words.slice(2).join(" ")]:[p.name.toUpperCase()];
    lines.forEach((l,i)=>x.fillText(l,m,m-14+i*30-(lines.length-1)*12));
    x.font="500 13px 'JetBrains Mono', monospace"; x.fillText("33⅓ · PULIDEVAN",m,m+52);
    x.fillStyle="#0c0f10"; x.beginPath(); x.arc(m,m,7,0,7); x.fill();
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
  }
  const crate=new THREE.Group(); camera.add(crate);
  const edgeMat=new THREE.MeshPhysicalMaterial({color:0x0a0c0d,roughness:.3,clearcoat:1});
  const recGeo=new THREE.CylinderGeometry(.36,.36,.018,96);
  const records=[], slots=[];
  async function buildRecords(){
    try{ await document.fonts.ready; }catch(e){}
    LIST.forEach((p,i)=>{
      const face=new THREE.MeshPhysicalMaterial({map:recordTexture(p),roughness:.28,metalness:.15,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.2});
      const disc=new THREE.Mesh(recGeo,[edgeMat,face,face]);
      const holder=new THREE.Group(); holder.add(disc);
      const n=LIST.length, x=(i-(n-1)/2)*.3;
      holder.position.set(x,0,-i*.02); holder.userData={i,disc,x,lift:0,spin:Math.random()*6,name:p.name};
      crate.add(holder); records.push(holder);
      // fixed hit zone per slot, so a lifted record doesn't slide out from under the cursor
      const end=(i===0?-1:i===n-1?1:0), sw=.3+(end?.22:0);
      const slot=new THREE.Mesh(new THREE.PlaneGeometry(sw,1.25),new THREE.MeshBasicMaterial({visible:false}));
      slot.position.set(x+end*.11,.24,.35); slot.userData.rec=holder; crate.add(slot); slots.push(slot);
    });
  }
  buildRecords();
  let selected=-1;

  /* ---------- interaction ---------- */
  const mouse={x:0,y:0}, smooth={x:0,y:0}, ndc=new THREE.Vector2(9,9);
  addEventListener("pointermove",e=>{ mouse.x=e.clientX/innerWidth*2-1; mouse.y=-(e.clientY/innerHeight*2-1); ndc.set(mouse.x,mouse.y); pickDirty=true;
    tip.style.transform=`translate(${e.clientX+14}px,${e.clientY+14}px)`; });
  const ray=new THREE.Raycaster(); let hitHead=false, hitRec=null, pickDirty=true;
  canvas.addEventListener("pointerdown",e=>{ ndc.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight*2-1)); pick();
    if(hitRec) window.dispatchEvent(new CustomEvent("pp-play",{detail:hitRec.userData.i}));
    else if(hitHead) window.dispatchEvent(new CustomEvent("pp-ask",{detail:headAsk})); });
  function pick(){
    ray.setFromCamera(ndc,camera);
    const rh=ray.intersectObjects(slots,false); hitRec = rh.length? rh[0].object.userData.rec:null;
    hitHead=false;
    if(!hitRec&&headAsk){ const hh=ray.intersectObject(head.userData.hit,false); hitHead=hh.length>0&&opaqueAt("head",hh[0].uv); }
  }

  const look=new THREE.Vector3(), lookTo=new THREE.Vector3(), camTo=new THREE.Vector3();
  function baseZ(){ const a=innerWidth/innerHeight; return a<1?10+(1-a)*19:10; }
  function poses(){ const narrow=innerWidth<=820, z=baseZ(), ny=narrow?-1.9:0; camTo.set(0,ny,z); lookTo.set(0,ny,0); }
  function resize(){ renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); }
  addEventListener("resize",resize); resize();

  let deckRect=null, frameN=0, crateShow=0, lastMx='', lastMy='', lastTip='', ftAvg=16, dpr=Math.min(devicePixelRatio,1.75);
  function placeCrate(){
    const el=document.querySelector(".deck"); if(!el) return; deckRect=el.getBoundingClientRect();
    if(!deckRect.width||innerWidth<=820){ crate.userData.s=0; return; }   // small screens: deck is a mute pill, no crate
    const D=6, hh=D*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), u=2*hh/innerHeight;
    const off=innerWidth<=820?48:62; const cx=(deckRect.left+deckRect.width/2-innerWidth/2)*u, cy=-(deckRect.top-off-innerHeight/2)*u;
    crate.position.set(cx,cy,-D); crate.userData.s=Math.min(1,(deckRect.width/340))*Math.min(1.1,Math.max(.75,innerHeight/900))*(innerWidth<=820?.72:1);
  }

  const clock=new THREE.Clock(), root=document.documentElement, t0=performance.now();
  function frame(){
    const dt=Math.min(clock.getDelta(),.1), E=q=>1-Math.pow(1-q,dt*60), t=clock.elapsedTime, k=reduce?.25:1;
    const intro=Math.min(1,(performance.now()-t0)/2400), ease=1-Math.pow(1-intro,3);
    smooth.x+=(mouse.x-smooth.x)*E(.05); smooth.y+=(mouse.y-smooth.y)*E(.05);
    const mx=smooth.x.toFixed(3), my=smooth.y.toFixed(3); if(mx!==lastMx||my!==lastMy){ root.style.setProperty("--mx",mx); root.style.setProperty("--my",my); lastMx=mx; lastMy=my; }
    if(frameN++%20===0) placeCrate();
    if(pickDirty||frameN%8===0){ pick(); pickDirty=false; }

    // head: rigid card with real relief; turns within the range a single photo can hold
    const hu=head.userData.u; hu.uTime.value=t; hu.uFade.value=Math.min(1,intro*1.6);
    head.position.y=.2+(1-ease)*-2.6+Math.sin(t*.8)*.07*k;
    head.rotation.y+=((smooth.x*.3+Math.sin(t*.3)*.05*k)-head.rotation.y)*E(.07);
    head.rotation.x+=((-smooth.y*.16)-head.rotation.x)*E(.07);
    head.rotation.z=Math.sin(t*.5)*.015*k;
    const hh=head.userData; hh.hover+=((hitHead?1:0)-hh.hover)*E(.1); hu.uGlow.value=hh.hover;

    // crate
    crateShow+=(1-crateShow)*E(.08);
    const cs=(crate.userData.s??1)*Math.max(.001,crateShow)*Math.min(1,Math.max(0,(intro-.4)*2));
    crate.scale.setScalar(Math.max(.001,cs));
    records.forEach(r=>{ const u=r.userData, hov=hitRec===r, sel=selected===u.i;
      u.lift+=(((hov?.42:0)+(sel?.26:0))-u.lift)*E(.12);
      r.position.y=u.lift+Math.sin(t*1.1+u.i)*.015*k;
      r.position.z=-u.i*.02+(hov||sel?.25:0);
      const ry=(hov||sel)? -.05 : -.95;
      r.rotation.y+=(ry-r.rotation.y)*E(.12); r.rotation.x=.08;
      u.spin+=dt*(sel?2.2:.15); u.disc.rotation.set(Math.PI/2,u.spin,0);
    });
    const tipT = hitRec ? `▶ ${hitRec.userData.name}` : hitHead ? `${headAsk} ↗` : "";
    if(tipT!==lastTip){ tip.textContent=tipT; tip.style.opacity=tipT?1:0; lastTip=tipT; }
    // adaptive resolution: drop pixel ratio on slow machines instead of stuttering
    ftAvg=ftAvg*.95+dt*1000*.05;
    if(frameN>120&&frameN%60===0&&ftAvg>26&&dpr>1){ dpr=Math.max(1,dpr-.25); renderer.setPixelRatio(dpr); resize(); }
    canvas.style.cursor=(hitRec||hitHead)?"pointer":"default";

    clouds.forEach(c=>{ c.position.x+=c.userData.v*dt*k; if(c.position.x>16) c.position.x=-16; });
    poses(); camTo.x+=smooth.x*.3; camTo.y+=smooth.y*.18;
    camera.position.lerp(camTo,E(.045)); look.lerp(lookTo,E(.05)); camera.lookAt(look);
    renderer.render(scene,camera);
    raf=requestAnimationFrame(frame);
  }
  let raf=requestAnimationFrame(frame);

  const onResize = resize;
  return {
    setRecord(i) { selected = i; },
    dispose() { cancelAnimationFrame(raf); removeEventListener("resize", onResize); renderer.dispose(); }
  };
}
