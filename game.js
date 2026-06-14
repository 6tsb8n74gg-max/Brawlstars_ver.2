const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const overlay=document.getElementById('overlay'),startBtn=document.getElementById('startBtn');
const teamsEl=document.getElementById('teams'),powerEl=document.getElementById('power'),ultBtn=document.getElementById('ultBtn');
const moveStick=document.getElementById('moveStick'),aimStick=document.getElementById('aimStick');
let W=innerWidth,H=innerHeight,DPR=devicePixelRatio||1;function resize(){W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0)}addEventListener('resize',resize);resize();
const MAP={w:4200,h:3000},TWO=Math.PI*2;let state='menu',player,bots=[],walls=[],boxes=[],bullets=[],cubes=[],gas,cam={x:0,y:0},last=0,msg='';
const rnd=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rectHit=(c,r)=>{let nx=clamp(c.x,r.x,r.x+r.w),ny=clamp(c.y,r.y,r.y+r.h);return Math.hypot(c.x-nx,c.y-ny)<c.r};
const rayRect=(x1,y1,x2,y2,r)=>{let dx=x2-x1,dy=y2-y1,t0=0,t1=1;for(const [p,q] of [[-dx,x1-r.x],[dx,r.x+r.w-x1],[-dy,y1-r.y],[dy,r.y+r.h-y1]]){if(p===0){if(q<0)return false}else{let t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}}return true};
const blocked=(a,b)=>walls.some(w=>rayRect(a.x,a.y,b.x,b.y,w));
const wallNear=(x,y,r=46)=>walls.some(w=>rectHit({x,y,r},w));
const freeSpot=(r=30)=>{for(let t=0;t<2000;t++){let p={x:rnd(260,MAP.w-260),y:rnd(260,MAP.h-260),r};if(!walls.some(w=>rectHit(p,w))&&!boxes.some(b=>dist(p,b)<80)&&(!player||dist(p,player)>650))return p}return{x:300,y:300,r}};
const PLAYER_SPEED=340, BOT_SPEED=315;
function makeBrawler(x,y,me=false){return{x,y,r:24,me,hp:420,maxHp:420,power:0,ammo:3,ammoT:0,ult:0,aim:0,dead:false,lastAction:0,lastHit:0,speed:me?PLAYER_SPEED:BOT_SPEED,aiT:0,target:null,shootT:0,stuckT:0,lastX:x,lastY:y,detour:0,brain:Math.random()*6.28,moveX:0,moveY:0,decisionT:0,goal:null,color:me?'#8e45d6':'#e84f4f'}}
function reset(){
 state='play';overlay.classList.remove('show');msg='';walls=[];boxes=[];bullets=[];cubes=[];gas={r:2500,t:0};
 input.move.x=0;input.move.y=0;input.aim.x=1;input.aim.y=0;
 // 플레이어를 먼저 중앙 안전구역에 생성해서 시작하자마자 빈 화면/벽끼임이 생기지 않게 함
 player=makeBrawler(MAP.w/2,MAP.h/2,true);
 const safe=(x,y,rad=460)=>Math.hypot(x-player.x,y-player.y)>rad;
 // 벽은 플레이어 주변 700px 안에는 절대 생성하지 않음
 for(let i=0;i<36;i++){
  let tries=0,w;
  do{w={x:rnd(220,MAP.w-520),y:rnd(200,MAP.h-360),w:rnd(130,360),h:rnd(85,240)};tries++}
  while(tries<200 && !safe(w.x+w.w/2,w.y+w.h/2,720));
  if(safe(w.x+w.w/2,w.y+w.h/2,720))walls.push(w);
 }
 // 상자도 시작 지점 근처에는 배치 금지
 for(let i=0;i<28;i++){let p=freeSpot(28);let tries=0;while(tries++<300 && dist(p,player)<520)p=freeSpot(28);boxes.push({x:p.x,y:p.y,r:30,hp:220})}
 // 혹시라도 겹치면 강제로 중앙으로 복구
 player.x=MAP.w/2;player.y=MAP.h/2;
 bots=[];
 const spawnAngles=[0,0.7,1.4,2.1,2.8,3.5,4.2,4.9,5.6];
 for(let i=0;i<9;i++){
  let p={x:MAP.w/2+Math.cos(spawnAngles[i])*rnd(950,1450),y:MAP.h/2+Math.sin(spawnAngles[i])*rnd(720,1150),r:24};
  p.x=clamp(p.x,260,MAP.w-260);p.y=clamp(p.y,260,MAP.h-260);
  let tries=0;while(tries++<400&&(walls.some(w=>rectHit(p,w))||boxes.some(b=>dist(p,b)<75)||dist(p,player)<900))p=freeSpot(24);
  bots.push(makeBrawler(p.x,p.y,false));
 }
 teamsEl.textContent='남은 팀: 10';powerEl.textContent='파워큐브: 0';
 last=performance.now();
}
function addPower(e){e.power++;e.maxHp=420+e.power*70;e.hp=Math.min(e.maxHp,e.hp+70);e.speed=e.me?PLAYER_SPEED:BOT_SPEED}
function damageFor(e,ult=false){return (ult?115:74)+e.power*(ult?14:9)}
function canMove(e,nx,ny){let oldx=e.x,oldy=e.y;e.x=nx;e.y=ny;let bad=walls.some(w=>rectHit(e,w));e.x=oldx;e.y=oldy;return !bad}
function move(e,dx,dy,dt,faceMove=true){dt=Math.min(dt,.022);let len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len}let ox=e.x,oy=e.y;let nx=clamp(e.x+dx*e.speed*dt,e.r,MAP.w-e.r),ny=e.y;if(canMove(e,nx,ny))e.x=nx;ny=clamp(e.y+dy*e.speed*dt,e.r,MAP.h-e.r);if(canMove(e,e.x,ny))e.y=ny;if(faceMove&&len>.1&&Math.hypot(e.x-ox,e.y-oy)>0.5)e.aim=Math.atan2(dy,dx)}
function shoot(e,ang=e.aim,ult=false){if(e.dead)return;if(!ult){if(e.ammo<1)return;e.ammo--;e.ammoT=0}else{if(e.ult<5)return;e.ult=0}e.lastAction=performance.now()/1000;let n=ult?9:5,spread=ult?.62:.46;for(let i=0;i<n;i++){let a=ang-spread/2+spread*(i/(n-1));bullets.push({x:e.x+Math.cos(a)*30,y:e.y+Math.sin(a)*30,vx:Math.cos(a)*(ult?770:690),vy:Math.sin(a)*(ult?770:690),r:ult?7:5,life:ult?.48:.36,own:e,dmg:damageFor(e,ult),ult})}}
function hitBrawler(target,b){if(target.dead||target===b.own)return;target.hp-=b.dmg;target.lastHit=performance.now()/1000;if(b.own&&!b.ult)b.own.ult=Math.min(5,b.own.ult+1);if(target.hp<=0){target.dead=true;cubes.push({x:target.x,y:target.y,r:16,n:Math.max(1,target.power)})}}
function update(dt){if(state!=='play')return;let now=performance.now()/1000;
 // ammo + hp regen
 [player,...bots].forEach(e=>{if(e.dead)return;e.ammoT+=dt;if(e.ammo<3&&e.ammoT>=1){e.ammo++;e.ammoT=0}if(now-e.lastHit>3.5&&now-e.lastAction>2.5&&e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+45*dt)});
 move(player,input.move.x,input.move.y,dt,false);
 // AI 3.0: 흔들림 제거형 - 조준과 이동을 분리하고, 목표/이동방향을 오래 유지
 bots.forEach(b=>{if(b.dead)return;
  let enemies=[player,...bots].filter(e=>!e.dead&&e!==b);
  enemies.sort((a,c)=>dist(b,a)-dist(b,c));
  let visible=enemies.filter(e=>dist(b,e)<1300&&!blocked(b,e));
  let cube=[...cubes].sort((a,c)=>dist(b,a)-dist(b,c))[0];
  let box=[...boxes].sort((a,c)=>dist(b,a)-dist(b,c))[0];
  let target=null,mode='roam';
  if(visible[0]){target=visible[0];mode='fight'}
  else if(enemies[0]&&dist(b,enemies[0])<1150){target=enemies[0];mode='hunt'}
  else if(cube){target=cube;mode='cube'}
  else if(box){target=box;mode='box'}
  else target={x:MAP.w/2,y:MAP.h/2};
  let dx=target.x-b.x,dy=target.y-b.y,d=Math.hypot(dx,dy)||1,baseAng=Math.atan2(dy,dx);
  // 독가스 밖/가장자리에서는 최우선으로 안전지대 안쪽으로 이동
  let gasDist=Math.hypot(b.x-MAP.w/2,b.y-MAP.h/2);
  let gasDanger=gasDist>gas.r-260;
  if(gasDanger){target={x:MAP.w/2,y:MAP.h/2};mode='safe';dx=target.x-b.x;dy=target.y-b.y;d=Math.hypot(dx,dy)||1;baseAng=Math.atan2(dy,dx)}

  // 조준은 이동 방향과 완전히 분리. 그래서 캐릭터가 좌우로 덜덜 떨지 않음
  let da=Math.atan2(Math.sin(baseAng-b.aim),Math.cos(baseAng-b.aim));
  b.aim+=clamp(da,-3.2*dt,3.2*dt);

  // 목표 거리 유지: 가까우면 뒤로, 적당하면 멈춤, 멀면 직선 추적. 불필요한 좌우 회피 제거
  b.decisionT-=dt;
  if(b.decisionT<=0){
   b.decisionT=.55+Math.random()*.20;
   let desiredX=0,desiredY=0;
   if(mode==='fight'){
    if(d>610){desiredX=dx/d;desiredY=dy/d}       // 멀면 접근
    else if(d<330){desiredX=-dx/d;desiredY=-dy/d} // 너무 가까우면 후퇴
    else {desiredX=0;desiredY=0}                  // 적정 거리면 멈춰서 조준/사격
   }else{
    desiredX=dx/d;desiredY=dy/d;
   }

   // 벽이나 가스 때문에 직선 이동이 막히는 경우에만 우회 방향 선택
   let nx=b.x+desiredX*150,ny=b.y+desiredY*150;
   if((desiredX||desiredY)&&(wallNear(nx,ny,62)||Math.hypot(nx-MAP.w/2,ny-MAP.h/2)>gas.r-160)){
    let best={score:-1e9,x:desiredX,y:desiredY};
    for(let k=0;k<18;k++){
     let side=(k%2?1:-1)*Math.ceil(k/2);
     let a=Math.atan2(desiredY,desiredX)+side*.32+b.detour;
     let vx=Math.cos(a),vy=Math.sin(a),tx=b.x+vx*160,ty=b.y+vy*160;
     let score=-Math.hypot(target.x-tx,target.y-ty)+260*(vx*b.moveX+vy*b.moveY);
     if(wallNear(tx,ty,62))score-=1800;
     if(Math.hypot(tx-MAP.w/2,ty-MAP.h/2)>gas.r-160)score-=1800;
     if(score>best.score)best={score,x:vx,y:vy};
    }
    desiredX=best.x;desiredY=best.y;
   }
   b.goal={x:desiredX,y:desiredY};
  }

  // 큰 관성 적용: 방향을 확 꺾지 않게 해서 떨림 방지
  if(b.goal){
   b.moveX=b.moveX*.94+b.goal.x*.06;
   b.moveY=b.moveY*.94+b.goal.y*.06;
   let ml=Math.hypot(b.moveX,b.moveY);
   if(ml<.08){b.moveX=0;b.moveY=0}else{b.moveX/=ml;b.moveY/=ml}
  }

  if(Math.hypot(b.x-b.lastX,b.y-b.lastY)<3&&Math.hypot(b.moveX,b.moveY)>.2)b.stuckT+=dt;else b.stuckT=0;
  if(b.stuckT>.9){b.detour+=(Math.random()<.5?-1:1)*1.05;b.decisionT=0;b.stuckT=0}
  b.lastX=b.x;b.lastY=b.y;
  move(b,b.moveX,b.moveY,dt,false);

  // 공격은 멈춰서 조준 후 발사. 벽 앞 난사 금지
  b.shootT-=dt;let clear=target&&!blocked(b,target);let aimOk=Math.abs(Math.atan2(Math.sin(baseAng-b.aim),Math.cos(baseAng-b.aim)))<.38;
  if(b.shootT<=0){
   if((mode==='fight'||mode==='hunt')&&d<680){
    if(clear&&aimOk){shoot(b,b.aim,false);b.shootT=.85+Math.random()*.30}
    else if(!clear&&b.ult>=5&&d<760){shoot(b,baseAng,true);b.shootT=1.45}
   }else if(mode==='box'&&d<440&&!blocked(b,target)&&aimOk){shoot(b,b.aim,false);b.shootT=1.0}
  }
 });
 // bullets
 for(let i=bullets.length-1;i>=0;i--){let bu=bullets[i];bu.life-=dt;bu.x+=bu.vx*dt;bu.y+=bu.vy*dt;let remove=bu.life<=0||bu.x<0||bu.y<0||bu.x>MAP.w||bu.y>MAP.h;
  for(let wi=walls.length-1;wi>=0&&!remove;wi--){let w=walls[wi];if(bu.x>w.x&&bu.x<w.x+w.w&&bu.y>w.y&&bu.y<w.y+w.h){if(bu.ult)walls.splice(wi,1);remove=true}}
  for(let bi=boxes.length-1;bi>=0&&!remove;bi--){let bx=boxes[bi];if(Math.hypot(bu.x-bx.x,bu.y-bx.y)<bx.r+bu.r){bx.hp-=bu.dmg;if(bu.own&&!bu.ult)bu.own.ult=Math.min(5,bu.own.ult+1);if(bx.hp<=0){boxes.splice(bi,1);cubes.push({x:bx.x,y:bx.y,r:16,n:1})}remove=true}}
  [player,...bots].forEach(e=>{if(!remove&&Math.hypot(bu.x-e.x,bu.y-e.y)<e.r+bu.r){hitBrawler(e,bu);remove=true}});if(remove)bullets.splice(i,1)}
 // cubes pickup
 [player,...bots].forEach(e=>{if(e.dead)return;for(let i=cubes.length-1;i>=0;i--){if(Math.hypot(e.x-cubes[i].x,e.y-cubes[i].y)<e.r+28){for(let k=0;k<cubes[i].n;k++)addPower(e);cubes.splice(i,1)}}});
 // gas shrink + damage
 gas.t+=dt;gas.r=Math.max(520,2500-gas.t*18);
 // 독가스는 플레이어에게만 데미지를 주고, AI는 죽지 않게 안전지대 쪽으로 밀어 넣음
 if(!player.dead&&Math.hypot(player.x-MAP.w/2,player.y-MAP.h/2)>gas.r){player.hp-=95*dt;player.lastHit=now;if(player.hp<=0)player.dead=true}
 bots.forEach(b=>{if(b.dead)return;let gd=Math.hypot(b.x-MAP.w/2,b.y-MAP.h/2);if(gd>gas.r-40){let ax=(MAP.w/2-b.x)/(gd||1),ay=(MAP.h/2-b.y)/(gd||1);move(b,ax,ay,dt*1.8,false);b.hp=Math.max(1,b.hp)}});
 let alive=[player,...bots].filter(e=>!e.dead);teamsEl.textContent='남은 팀: '+alive.length;powerEl.textContent='파워큐브: '+player.power;ultBtn.classList.toggle('ready',player.ult>=5);if(player.dead)end('패배...');else if(alive.length===1&&alive[0]===player)end('승리!')}
function end(t){state='end';msg=t;overlay.querySelector('h1').innerHTML=t;overlay.querySelector('p').innerHTML='파워큐브 '+player.power+'개 획득';startBtn.textContent='다시 플레이';overlay.classList.add('show')}
function draw(){ctx.clearRect(0,0,W,H);if(!player||state==='menu'){ctx.fillStyle='#69bf45';ctx.fillRect(0,0,W,H);return}cam.x=clamp(player.x-W/2,0,Math.max(0,MAP.w-W));cam.y=clamp(player.y-H/2,0,Math.max(0,MAP.h-H));ctx.save();ctx.translate(-cam.x,-cam.y);
 // ground
 for(let x=0;x<MAP.w;x+=90)for(let y=0;y<MAP.h;y+=90){ctx.fillStyle=((x+y)/90)%2?'#66bd45':'#72c94d';ctx.fillRect(x,y,90,90)}
 // gas
 ctx.save();ctx.fillStyle='rgba(120,40,180,.42)';ctx.fillRect(0,0,MAP.w,MAP.h);ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(MAP.w/2,MAP.h/2,gas.r,0,TWO);ctx.fill();ctx.restore();ctx.strokeStyle='#9dff62';ctx.lineWidth=10;ctx.beginPath();ctx.arc(MAP.w/2,MAP.h/2,gas.r,0,TWO);ctx.stroke();
 walls.forEach(w=>{ctx.fillStyle='#a85d2b';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#c77a3d';ctx.fillRect(w.x,w.y,w.w,12)});
 boxes.forEach(b=>{ctx.fillStyle='#815022';ctx.fillRect(b.x-31,b.y-31,62,62);ctx.fillStyle='#df9a2e';ctx.fillRect(b.x-23,b.y-23,46,46)});
 cubes.forEach(c=>{ctx.fillStyle='#9c3cff';ctx.fillRect(c.x-15,c.y-15,30,30);ctx.fillStyle='#e4c4ff';ctx.fillRect(c.x-5,c.y-5,10,10)});
 [player,...bots].forEach(drawBrawler);bullets.forEach(b=>{ctx.fillStyle=b.ult?'#ffe45c':'#ffd7a3';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TWO);ctx.fill()});ctx.restore()}
function drawBrawler(e){if(e.dead)return;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.aim);ctx.fillStyle='#321842';ctx.fillRect(8,-8,36,16);ctx.restore();ctx.fillStyle='#111';ctx.beginPath();ctx.arc(e.x,e.y,e.r+4,0,TWO);ctx.fill();ctx.fillStyle=e.color;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,TWO);ctx.fill();if(e.me){ctx.fillStyle='#7b32d9';ctx.beginPath();ctx.arc(e.x-5,e.y-8,20,0,TWO);ctx.fill();ctx.fillStyle='#ffd44a';ctx.fillRect(e.x-18,e.y+7,36,10)}else{ctx.fillStyle='#ffd0a0';ctx.fillRect(e.x-12,e.y-8,24,14)}
 // hp bar
 let bw=70,bh=8,px=e.x-bw/2,py=e.y-48;ctx.fillStyle='#111';ctx.fillRect(px,py,bw,bh);ctx.fillStyle=e.hp/e.maxHp>.45?'#37e36d':'#ff4e5a';ctx.fillRect(px,py,bw*(e.hp/e.maxHp),bh);
 // ammo under hp
 for(let i=0;i<3;i++){ctx.fillStyle=i<e.ammo?'#ffd74f':'#222';ctx.fillRect(px+i*24,py+12,20,6)}
 // ult / power
 ctx.fillStyle='#fff';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText('◆'+e.power,e.x,py-5);ctx.fillStyle='#36a4ff';ctx.fillRect(px,py+22,bw*(e.ult/5),5)}
function loop(t){let dt=Math.min(.022,(t-last)/1000||.016);last=t;update(dt);draw();requestAnimationFrame(loop)}
const input={move:{x:0,y:0},aim:{x:1,y:0}};
function stickBind(el,obj,onEnd){
 let id=null,knob=el.querySelector('.knob');
 const center=()=>{let r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}};
 function set(x,y){let c=center(),dx=x-c.x,dy=y-c.y,m=Math.hypot(dx,dy),max=42;if(m>max){dx=dx/m*max;dy=dy/m*max}knob.style.left=32+dx+'px';knob.style.top=32+dy+'px';obj.x=dx/max;obj.y=dy/max;return Math.hypot(obj.x,obj.y)}
 function resetStick(){obj.x=0;obj.y=0;knob.style.left='32px';knob.style.top='32px';id=null}
 el.addEventListener('pointerdown',e=>{id=e.pointerId;el.setPointerCapture(id);set(e.clientX,e.clientY);e.preventDefault()},{passive:false});
 el.addEventListener('pointermove',e=>{if(e.pointerId===id){set(e.clientX,e.clientY);e.preventDefault()}},{passive:false});
 el.addEventListener('pointerup',e=>{if(e.pointerId===id){if(onEnd)onEnd({...obj});resetStick();e.preventDefault()}},{passive:false});
 el.addEventListener('pointercancel',e=>{if(e.pointerId===id)resetStick()},{passive:false});
}
stickBind(moveStick,input.move);
stickBind(aimStick,input.aim,(v)=>{let m=Math.hypot(v.x,v.y);if(m>.25){player.aim=Math.atan2(v.y,v.x);shoot(player,player.aim,false)}});
function fireUlt(e){if(e){e.preventDefault();e.stopPropagation()}if(state==='play'&&player&&!player.dead)shoot(player,player.aim,true)}
ultBtn.addEventListener('pointerdown',fireUlt,{passive:false});
ultBtn.addEventListener('touchstart',fireUlt,{passive:false});
ultBtn.onclick=fireUlt;
startBtn.onclick=()=>{overlay.querySelector('h1').innerHTML='MOBILE<br>SHOTDOWN';overlay.querySelector('p').innerHTML='왼쪽 조이스틱: 이동<br>오른쪽 조이스틱: 조준/공격<br>궁극기 버튼: 벽 파괴 산탄';startBtn.textContent='게임 시작';reset()};
document.addEventListener('gesturestart',e=>e.preventDefault());last=performance.now();requestAnimationFrame(loop);
