const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const overlay=document.getElementById('overlay'),startBtn=document.getElementById('startBtn');
const teamsEl=document.getElementById('teams'),powerEl=document.getElementById('power'),ultBtn=document.getElementById('ultBtn');
const moveStick=document.getElementById('moveStick'),aimStick=document.getElementById('aimStick');
let W=innerWidth,H=innerHeight,DPR=devicePixelRatio||1;function resize(){W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}addEventListener('resize',resize);resize();
const MAP={w:4200,h:3000},TWO=Math.PI*2;let state='menu',player,bots=[],walls=[],boxes=[],bullets=[],cubes=[],gas,cam={x:0,y:0},last=0,msg='';
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rectHit=(c,r)=>{let nx=clamp(c.x,r.x,r.x+r.w),ny=clamp(c.y,r.y,r.y+r.h);return Math.hypot(c.x-nx,c.y-ny)<c.r};
const freeSpot=(r=30)=>{for(let t=0;t<2000;t++){let p={x:rnd(260,MAP.w-260),y:rnd(260,MAP.h-260),r};if(!walls.some(w=>rectHit(p,w))&&!boxes.some(b=>dist(p,b)<80)&&(!player||dist(p,player)>650))return p}return{x:300,y:300,r}};
function makeBrawler(x,y,me=false){return{x,y,r:24,me,hp:420,maxHp:420,power:0,ammo:3,ammoT:0,ult:0,aim:0,dead:false,lastAction:0,lastHit:0,speed:me?235:205,aiT:0,target:null,shootT:0,color:me?'#8e45d6':'#e84f4f'}}
function reset(){state='play';overlay.classList.remove('show');msg='';walls=[];boxes=[];bullets=[];cubes=[];gas={r:2500,t:0};
 // walls
 for(let i=0;i<34;i++){let w={x:rnd(200,MAP.w-520),y:rnd(180,MAP.h-360),w:rnd(120,360),h:rnd(80,240)};if(Math.hypot(w.x-MAP.w/2,w.y-MAP.h/2)>260)walls.push(w)}
 // boxes first, then spawn away from walls/boxes
 for(let i=0;i<24;i++){let p=freeSpot(28);boxes.push({x:p.x,y:p.y,r:30,hp:220})}
 player=makeBrawler(MAP.w/2,MAP.h/2,true);
 while(walls.some(w=>rectHit(player,w))||boxes.some(b=>dist(player,b)<70)){let p=freeSpot(24);player.x=p.x;player.y=p.y}
 bots=[];for(let i=0;i<9;i++){let p=freeSpot(24);while(dist(p,player)<900)p=freeSpot(24);bots.push(makeBrawler(p.x,p.y,false))}
 last=performance.now();requestAnimationFrame(loop)}
function addPower(e){e.power++;e.maxHp=420+e.power*70;e.hp=Math.min(e.maxHp,e.hp+70);e.speed=(e.me?235:205)+Math.min(35,e.power*3)}
function damageFor(e,ult=false){return (ult?115:74)+e.power*(ult?14:9)}
function canMove(e,nx,ny){let oldx=e.x,oldy=e.y;e.x=nx;e.y=ny;let bad=walls.some(w=>rectHit(e,w));e.x=oldx;e.y=oldy;return !bad}
function move(e,dx,dy,dt){let len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len}let nx=clamp(e.x+dx*e.speed*dt,e.r,MAP.w-e.r),ny=e.y;if(canMove(e,nx,ny))e.x=nx;ny=clamp(e.y+dy*e.speed*dt,e.r,MAP.h-e.r);if(canMove(e,e.x,ny))e.y=ny;if(len>.1)e.aim=Math.atan2(dy,dx)}
function shoot(e,ang=e.aim,ult=false){if(e.dead)return;if(!ult){if(e.ammo<1)return;e.ammo--;e.ammoT=0}else{if(e.ult<5)return;e.ult=0}e.lastAction=performance.now()/1000;let n=ult?9:5,spread=ult?.62:.46;for(let i=0;i<n;i++){let a=ang-spread/2+spread*(i/(n-1));bullets.push({x:e.x+Math.cos(a)*30,y:e.y+Math.sin(a)*30,vx:Math.cos(a)*(ult?770:690),vy:Math.sin(a)*(ult?770:690),r:ult?7:5,life:ult?.48:.36,own:e,dmg:damageFor(e,ult),ult})}}
function hitBrawler(target,b){if(target.dead||target===b.own)return;target.hp-=b.dmg;target.lastHit=performance.now()/1000;if(b.own&&!b.ult)b.own.ult=Math.min(5,b.own.ult+1);if(target.hp<=0){target.dead=true;cubes.push({x:target.x,y:target.y,r:16,n:Math.max(1,target.power)})}}
function update(dt){if(state!=='play')return;let now=performance.now()/1000;
 // ammo + hp regen
 [player,...bots].forEach(e=>{if(e.dead)return;e.ammoT+=dt;if(e.ammo<3&&e.ammoT>=1){e.ammo++;e.ammoT=0}if(now-e.lastHit>3.5&&now-e.lastAction>2.5&&e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+45*dt)});
 move(player,input.move.x,input.move.y,dt);
 // AI: closest enemy, then box/cube, path-like movement
 bots.forEach(b=>{if(b.dead)return;b.aiT-=dt;let enemies=[player,...bots].filter(e=>!e.dead&&e!==b);let near=enemies.sort((a,c)=>dist(b,a)-dist(b,c))[0];let cube=cubes.sort((a,c)=>dist(b,a)-dist(b,c))[0];let box=boxes.sort((a,c)=>dist(b,a)-dist(b,c))[0];let target=null,mode='';if(near&&dist(b,near)<850){target=near;mode='fight'}else if(cube){target=cube;mode='cube'}else if(box){target=box;mode='box'}else target={x:MAP.w/2,y:MAP.h/2};
 let dx=target.x-b.x,dy=target.y-b.y,d=Math.hypot(dx,dy)||1;b.aim=Math.atan2(dy,dx);
 let strafe= mode==='fight' && d<300 ? Math.sin(now*2+b.x)*.55 : 0;let mx=dx/d + (-dy/d)*strafe, my=dy/d + (dx/d)*strafe;if(mode==='fight'&&d<230){mx*=-.45;my*=-.45}move(b,mx,my,dt);
 b.shootT-=dt;if(b.shootT<=0){if(mode==='fight'&&d<560){shoot(b,b.aim,false);b.shootT=.75}else if(mode==='box'&&d<460){shoot(b,b.aim,false);b.shootT=1.0}}
 });
 // bullets
 for(let i=bullets.length-1;i>=0;i--){let bu=bullets[i];bu.life-=dt;bu.x+=bu.vx*dt;bu.y+=bu.vy*dt;let remove=bu.life<=0||bu.x<0||bu.y<0||bu.x>MAP.w||bu.y>MAP.h;
  for(let wi=walls.length-1;wi>=0&&!remove;wi--){let w=walls[wi];if(bu.x>w.x&&bu.x<w.x+w.w&&bu.y>w.y&&bu.y<w.y+w.h){if(bu.ult)walls.splice(wi,1);remove=true}}
  for(let bi=boxes.length-1;bi>=0&&!remove;bi--){let bx=boxes[bi];if(Math.hypot(bu.x-bx.x,bu.y-bx.y)<bx.r+bu.r){bx.hp-=bu.dmg;if(bu.own&&!bu.ult)bu.own.ult=Math.min(5,bu.own.ult+1);if(bx.hp<=0){boxes.splice(bi,1);cubes.push({x:bx.x,y:bx.y,r:16,n:1})}remove=true}}
  [player,...bots].forEach(e=>{if(!remove&&Math.hypot(bu.x-e.x,bu.y-e.y)<e.r+bu.r){hitBrawler(e,bu);remove=true}});if(remove)bullets.splice(i,1)}
 // cubes pickup
 [player,...bots].forEach(e=>{if(e.dead)return;for(let i=cubes.length-1;i>=0;i--){if(Math.hypot(e.x-cubes[i].x,e.y-cubes[i].y)<e.r+28){for(let k=0;k<cubes[i].n;k++)addPower(e);cubes.splice(i,1)}}});
 // gas shrink + damage
 gas.t+=dt;gas.r=Math.max(520,2500-gas.t*18);[player,...bots].forEach(e=>{if(!e.dead&&Math.hypot(e.x-MAP.w/2,e.y-MAP.h/2)>gas.r){e.hp-=95*dt;e.lastHit=now;if(e.hp<=0)e.dead=true}});
 let alive=[player,...bots].filter(e=>!e.dead);teamsEl.textContent='남은 팀: '+alive.length;powerEl.textContent='파워큐브: '+player.power;ultBtn.classList.toggle('ready',player.ult>=5);if(player.dead)end('패배...');else if(alive.length===1&&alive[0]===player)end('승리!')}
function end(t){state='end';msg=t;overlay.querySelector('h1').innerHTML=t;overlay.querySelector('p').innerHTML='파워큐브 '+player.power+'개 획득';startBtn.textContent='다시 플레이';overlay.classList.add('show')}
function draw(){cam.x=clamp(player.x-W/2,0,MAP.w-W);cam.y=clamp(player.y-H/2,0,MAP.h-H);ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(-cam.x,-cam.y);
 // ground
 for(let x=0;x<MAP.w;x+=90)for(let y=0;y<MAP.h;y+=90){ctx.fillStyle=((x+y)/90)%2?'#66bd45':'#72c94d';ctx.fillRect(x,y,90,90)}
 // gas
 ctx.save();ctx.fillStyle='rgba(120,40,180,.42)';ctx.fillRect(0,0,MAP.w,MAP.h);ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(MAP.w/2,MAP.h/2,gas.r,0,TWO);ctx.fill();ctx.restore();ctx.strokeStyle='#9dff62';ctx.lineWidth=10;ctx.beginPath();ctx.arc(MAP.w/2,MAP.h/2,gas.r,0,TWO);ctx.stroke();
 walls.forEach(w=>{ctx.fillStyle='#a85d2b';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#c77a3d';ctx.fillRect(w.x,w.y,w.w,12)});
 boxes.forEach(b=>{ctx.fillStyle='#815022';ctx.fillRect(b.x-31,b.y-31,62,62);ctx.fillStyle='#df9a2e';ctx.fillRect(b.x-23,b.y-23,46,46)});
 cubes.forEach(c=>{ctx.fillStyle='#9c3cff';ctx.fillRect(c.x-15,c.y-15,30,30);ctx.fillStyle='#e4c4ff';ctx.fillRect(c.x-5,c.y-5,10,10)});
 [player,...bots].forEach(drawBrawler);bullets.forEach(b=>{ctx.fillStyle=b.ult?'#ffe45c':'#ffd7a3';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TWO);ctx.fill()});ctx.restore()}
function drawBrawler(e){if(e.dead)return;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.aim);ctx.fillStyle='#321842';ctx.fillRect(8,-8,36,16);ctx.restore();ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,TWO);ctx.fill();if(e.me){ctx.fillStyle='#7b32d9';ctx.beginPath();ctx.arc(e.x-5,e.y-8,20,0,TWO);ctx.fill();ctx.fillStyle='#ffd44a';ctx.fillRect(e.x-18,e.y+7,36,10)}else{ctx.fillStyle='#ffd0a0';ctx.fillRect(e.x-12,e.y-8,24,14)}
 // hp bar
 let bw=70,bh=8,px=e.x-bw/2,py=e.y-48;ctx.fillStyle='#111';ctx.fillRect(px,py,bw,bh);ctx.fillStyle=e.hp/e.maxHp>.45?'#37e36d':'#ff4e5a';ctx.fillRect(px,py,bw*(e.hp/e.maxHp),bh);
 // ammo under hp
 for(let i=0;i<3;i++){ctx.fillStyle=i<e.ammo?'#ffd74f':'#222';ctx.fillRect(px+i*24,py+12,20,6)}
 // ult / power
 ctx.fillStyle='#fff';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText('◆'+e.power,e.x,py-5);ctx.fillStyle='#36a4ff';ctx.fillRect(px,py+22,bw*(e.ult/5),5)}
function loop(t){let dt=Math.min(.033,(t-last)/1000||.016);last=t;update(dt);draw();requestAnimationFrame(loop)}
const input={move:{x:0,y:0},aim:{x:1,y:0}};function stickBind(el,obj,onEnd){let id=null,knob=el.querySelector('.knob'),rect=()=>el.getBoundingClientRect();function set(x,y){let r=rect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=x-cx,dy=y-cy,m=Math.hypot(dx,dy),max=42;if(m>max){dx=dx/m*max;dy=dy/m*max}knob.style.left=32+dx+'px';knob.style.top=32+dy+'px';obj.x=dx/max;obj.y=dy/max;return Math.hypot(obj.x,obj.y)}el.addEventListener('touchstart',e=>{let q=e.changedTouches[0];id=q.identifier;set(q.clientX,q.clientY);e.preventDefault()});el.addEventListener('touchmove',e=>{for(const q of e.changedTouches)if(q.identifier===id)set(q.clientX,q.clientY);e.preventDefault()});el.addEventListener('touchend',e=>{for(const q of e.changedTouches)if(q.identifier===id){if(onEnd)onEnd(obj);obj.x=0;obj.y=0;knob.style.left='32px';knob.style.top='32px';id=null}})}
stickBind(moveStick,input.move);stickBind(aimStick,input.aim,(v)=>{let m=Math.hypot(v.x,v.y);if(m>.25){player.aim=Math.atan2(v.y,v.x);shoot(player,player.aim,false)}});ultBtn.onclick=()=>shoot(player,player.aim,true);startBtn.onclick=()=>{overlay.querySelector('h1').innerHTML='MOBILE<br>SHOTDOWN';overlay.querySelector('p').innerHTML='왼쪽 조이스틱: 이동<br>오른쪽 조이스틱: 조준/공격<br>궁극기 버튼: 벽 파괴 산탄';startBtn.textContent='게임 시작';reset()};
document.addEventListener('gesturestart',e=>e.preventDefault());draw();
