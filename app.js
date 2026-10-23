'use strict';
const $=id=>document.getElementById(id);
const qs=new URLSearchParams(location.hash.slice(1));
const state={example:Math.max(0,ROLLOUTS.findIndex(x=>x.problem_id===qs.get('example'))),round:Math.max(0,Number(qs.get('round')||1)-1),direction:Math.max(0,Number(qs.get('direction')||1)-1),tab:['core_result','found','rationale'].includes(qs.get('tab'))?qs.get('tab'):'core_result',show:qs.get('show')!=='0',font:null};
function normalize(text){let s=String(text||'');if(s.includes('\\\\(')||s.includes('\\\\['))s=s.replaceAll('\\\\','\\');return s.replace(/\\u([0-9a-fA-F]{4})/g,(_,x)=>String.fromCharCode(parseInt(x,16))).replace(/\\n(?=\s|[A-Z•]|$)/g,'\n');}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markdown(s){
  const math=[];let t=normalize(s);
  for(const [re,display] of [[/\$\$([\s\S]+?)\$\$/g,true],[/\\\[([\s\S]+?)\\\]/g,true],[/\\\(([\s\S]+?)\\\)/g,false],[/(?<![\\$])\$(?!\$)([^\n$]+?)\$(?!\$)/g,false]]){
    t=t.replace(re,(_,tex)=>{const id=math.length;try{math.push(katex.renderToString(tex,{displayMode:display,throwOnError:false,trust:false,output:'html'}));}catch{math.push('<code class="rawtex">'+escape(tex)+'</code>');}return 'ZZMATHPLACEHOLDER'+id+'ZZ';});
  }
  const template=document.createElement('template');template.innerHTML=marked.parse(t,{breaks:true});
  const allowed=new Set(['P','BR','STRONG','EM','UL','OL','LI','H1','H2','H3','H4','H5','H6','PRE','CODE','BLOCKQUOTE','HR','TABLE','THEAD','TBODY','TR','TH','TD','A','SUP','SUB','DEL']);
  for(const el of [...template.content.querySelectorAll('*')]){
    if(!allowed.has(el.tagName)){el.replaceWith(document.createTextNode(el.textContent||''));continue;}
    const href=el.tagName==='A'?el.getAttribute('href'):null;
    for(const a of [...el.attributes])el.removeAttribute(a.name);
    if(href&&/^https?:\/\//i.test(href)){el.setAttribute('href',href);el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
  }
  return template.innerHTML.replace(/ZZMATHPLACEHOLDER(\d+)ZZ/g,(_,i)=>math[+i]||'');
}
function data(){return ROLLOUTS[state.example];}
function layer(){return data().layers[state.round];}
function active(){return layer().explorations[state.direction];}
function clamp(){state.round=Math.min(Number.isFinite(state.round)?Math.floor(state.round):0,data().layers.length-1);state.direction=Math.min(Number.isFinite(state.direction)?Math.floor(state.direction):0,layer().explorations.length-1);}
function save(){const h=new URLSearchParams({example:data().problem_id,round:state.round+1,direction:state.direction+1,tab:state.tab,show:state.show?'1':'0'});if(typeof history.replaceState==='function')history.replaceState(null,'','#'+h);}
function render(){
  clamp();const d=data();$('example').value=state.example;$('problemTitle').textContent=d.title.replaceAll('$','');$('problemSummary').textContent=d.demo_summary;
  $('rounds').replaceChildren(...d.layers.map((l,i)=>{const b=document.createElement('button');b.textContent=l.layer;b.className=i===state.round?'active':'';b.setAttribute('aria-label','Round '+l.layer+', '+l.explorations.length+' directions');b.setAttribute('aria-pressed',String(i===state.round));b.onclick=()=>{state.round=i;state.direction=0;render();};return b;}));
  $('directionCount').textContent=layer().explorations.length+' directions';
  $('directions').replaceChildren(...layer().explorations.map((ex,i)=>{const b=document.createElement('button');b.className='direction'+(i===state.direction?' active':'');b.setAttribute('aria-pressed',String(i===state.direction));b.setAttribute('aria-label','Direction '+ex.label);b.innerHTML='<div class="direction-head"><span>Direction '+escape(ex.label)+'</span><span class="hint">'+(i===state.direction?'Selected':'View execution ↗')+'</span></div><div class="prose">'+markdown(ex.direction||'No proposed direction was recorded.')+'</div>';b.onclick=()=>{state.direction=i;render();};return b;}));
  $('activeDirection').textContent='Direction '+active().label;
  for(const b of document.querySelectorAll('[data-tab]')){const selected=b.dataset.tab===state.tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
  $('output').setAttribute('aria-labelledby','tab-'+state.tab);$('output').innerHTML=markdown(active()[state.tab]||'This field was not included in the recorded rollout.');$('output').scrollTop=0;
  $('executionContent').hidden=!state.show;$('hiddenExecution').hidden=state.show;$('reveal').textContent=state.show?'Hide execution':'Show execution';$('reveal').setAttribute('aria-expanded',String(state.show));
  $('prev').disabled=state.round===0&&state.direction===0;$('next').textContent=state.direction<layer().explorations.length-1?'Next direction →':state.round<data().layers.length-1?'Next round →':'Final answer ↗';
  $('announcement').textContent='Round '+layer().layer+', direction '+active().label;save();
}
function move(delta){
  if(delta>0){if(state.direction<layer().explorations.length-1)state.direction++;else if(state.round<data().layers.length-1){state.round++;state.direction=0;}else{return finalAnswer();}}
  else if(state.direction>0)state.direction--;else if(state.round>0){state.round--;state.direction=layer().explorations.length-1;}
  render();
}
function openDialog(label,title,body){$('dialogLabel').textContent=label;$('dialogTitle').textContent=title;$('dialogBody').innerHTML=body;$('dialog').showModal();$('dialog').scrollTop=0;}
function finalAnswer(){const d=data();let html=markdown(d.final_answer||'No final answer was recorded.');if(d.judge&&d.judge.score!=null){html+='<details class="judge"><summary>Recorded judge assessment: '+escape(d.judge.score)+' / '+escape(d.judge.max_score||'?')+'</summary><div class="prose">'+markdown(d.judge.explanation||d.judge.reasoning||'No explanation was included.')+'</div></details>';}openDialog('SYNTHESIS · RECORDED MODEL OUTPUT',d.title.replaceAll('$',''),html);}
ROLLOUTS.forEach((d,i)=>{const o=document.createElement('option');o.value=i;o.textContent=d.demo_name;$('example').append(o);});
$('example').onchange=e=>{state.example=+e.target.value;state.round=0;state.direction=0;render();};
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('finalButton').onclick=finalAnswer;
$('showQuestion').onclick=()=>openDialog('PROBLEM · '+data().problem_id,data().title.replaceAll('$',''),markdown(data().problem));
$('closeDialog').onclick=()=>$('dialog').close();$('dialog').onclick=e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}};
for(const id of ['reveal','revealBig'])$(id).onclick=()=>{state.show=!state.show;render();};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{state.tab=b.dataset.tab;render();};
document.querySelector('.tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const tabs=['core_result','found','rationale'];state.tab=tabs[(tabs.indexOf(state.tab)+(e.key==='ArrowRight'?1:2))%3];render();$('tab-'+state.tab).focus();};
function resize(delta){state.font=Math.max(12,Math.min(30,(state.font||parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reading')))+delta));document.documentElement.style.setProperty('--reading',state.font+'px');}
$('fontSmaller').onclick=()=>resize(-2);$('fontLarger').onclick=()=>resize(2);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else $('announcement').textContent='Use your browser full-screen command.';}catch{$('announcement').textContent='Use your browser full-screen command.';}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
document.addEventListener('keydown',e=>{if($('dialog').open||['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(e.target.id==='output')return;e.preventDefault();state.round=Math.max(0,Math.min(data().layers.length-1,state.round+(e.key==='ArrowDown'?1:-1)));state.direction=0;render();}if(e.key.toLowerCase()==='e'){state.show=!state.show;render();}});
render();
