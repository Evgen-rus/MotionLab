export class VisualQa {
 constructor(times) {
  this.times=times;
  this.samples=[];
  this.resources=new Map();
 }

 resource(url, message) {
  this.resources.set(`${url}\n${message}`,{url,message});
 }

 frame(time, png, geometry) {
  this.samples.push({time,png,...geometry});
 }

 report(error) {
  const complete=!error && this.samples.length===this.times.length;
  const comparisons=[];
  for(const [index,sample] of this.samples.entries()){
   const earlier=this.samples.findIndex((candidate,i)=>i<index-1 && candidate.time===sample.time && this.samples.slice(i+1,index).some(other=>other.time!==sample.time));
   if(earlier!==-1)comparisons.push({time:sample.time,frames:[earlier+1,index+1],identical:sample.png.equals(this.samples[earlier].png)});
  }
  const issues=this.samples.flatMap(sample=>sample.issues.map(issue=>({time:sample.time,...issue})));
  const inspected=this.samples.reduce((count,sample)=>count+sample.inspected,0);
  const resources=[...this.resources.values()];
  const checks={
   capture:{status:complete ? 'passed' : 'not-run',captured:this.samples.length,expected:this.times.length,...(error ? {error} : {})},
   determinism:{status:status(comparisons.some(c=>!c.identical),complete && comparisons.length),comparisons},
   geometry:{status:status(issues.length,complete && inspected),inspected,issues},
   resources:{status:status(resources.length,complete),issues:resources},
  };
  return {
   status:status(Object.values(checks).some(check=>check.status==='problem'),Object.values(checks).every(check=>check.status==='passed')),
   times:this.times,
   checks,
  };
 }
}

function status(problem, ran) {
 return problem ? 'problem' : ran ? 'passed' : 'not-run';
}

// Runs in the authored scene's browser context after seek and screenshot.
export function inspectGeometry() {
 const visible=element=>element.checkVisibility({opacityProperty:true,visibilityProperty:true});
 const extendsBeyond=(rect,area,x=true,y=true)=>
  (x && (rect.left<area.left-1 || rect.right>area.right+1)) || (y && (rect.top<area.top-1 || rect.bottom>area.bottom+1));
 const elements=[...document.querySelectorAll('[data-qa-safe],[data-qa-disjoint]')];
 const issues=[], groups=new Map();
 let inspected=0;
 for(const [index,element] of elements.entries()){
  if(!visible(element))continue;
  const rect=element.getBoundingClientRect();
  if(!rect.width || !rect.height)continue;
  const id=element.dataset.elementId || element.id || `${element.localName}[${index+1}]`;
  const insetValue=element.getAttribute('data-qa-safe');
  if(insetValue!==null){
   inspected++;
   const inset=insetValue==='' ? Math.min(innerWidth,innerHeight)*.04 : Number(insetValue);
   if(!Number.isFinite(inset) || inset<0 || inset*2>=Math.min(innerWidth,innerHeight)){
    issues.push({type:'invalid-inset',id,inset:insetValue});
    continue;
   }
   const safe={left:inset,top:inset,right:innerWidth-inset,bottom:innerHeight-inset};
   const viewport={left:0,top:0,right:innerWidth,bottom:innerHeight};
   let outsideSafe=extendsBeyond(rect,safe);

   for(let ancestor=element.parentElement;ancestor;ancestor=ancestor.parentElement){
    if(clippedBy(rect,ancestor)){
     issues.push({type:'clipped-element',id});
     break;
    }
   }
   const text=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
   const range=document.createRange();
   let textClipped=false;
   for(let node=text.nextNode();node && (!textClipped || !outsideSafe);node=text.nextNode()){
    if(!node.data.trim() || !visible(node.parentElement))continue;
    range.selectNodeContents(node);
    for(const line of range.getClientRects()){
     if(extendsBeyond(line,safe))outsideSafe=true;
     if(extendsBeyond(line,viewport))textClipped=true;
     for(let ancestor=node.parentElement;ancestor && !textClipped;ancestor=ancestor.parentElement){
      if(clippedBy(line,ancestor))textClipped=true;
     }
    }
   }
   if(outsideSafe)issues.push({type:'outside-safe-area',id});
   if(textClipped)issues.push({type:'clipped-text',id});
  }
  const group=element.dataset.qaDisjoint;
  if(group){
   if(!groups.has(group))groups.set(group,[]);
   groups.get(group).push({id,rect});
  }
 }
 for(const [group,items] of groups){
  for(const [index,a] of items.entries()){
   for(const b of items.slice(index+1)){
    inspected++;
    const width=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left);
    const height=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top);
    if(width>1 && height>1)issues.push({type:'overlap',group,ids:[a.id,b.id]});
   }
  }
 }
 return {inspected,issues};

 function clippedBy(rect,clipper) {
  const style=getComputedStyle(clipper);
  const x=style.overflowX!=='visible',y=style.overflowY!=='visible';
  if(!x && !y)return false;
  const box=clipper.getBoundingClientRect();
  const sx=box.width/clipper.offsetWidth,sy=box.height/clipper.offsetHeight;
  const left=box.left+clipper.clientLeft*sx,top=box.top+clipper.clientTop*sy;
  return extendsBeyond(rect,{left,top,right:left+clipper.clientWidth*sx,bottom:top+clipper.clientHeight*sy},x,y);
 }
}
