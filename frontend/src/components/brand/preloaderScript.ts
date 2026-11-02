import { BRAND, MARK_BAR_RADIUS, MARK_BARS, MARK_COIN, MARK_VIEWBOX, WORDMARK } from "@/lib/brand";

/**
 * The website's launch animation, the app's Preloader (mobile/src/components/brand) in plain
 * CSS and JS. It runs from the <head>, before React, so it never waits for hydration:
 *
 * - Only on the first visit (a localStorage flag), never with reduced motion.
 * - Before the body is painted, html[data-preload] covers the page in indigo (brand.css).
 *   On DOMContentLoaded the overlay is added at the end of <body> (React 19 skips nodes it
 *   did not render there) and the CSS keyframes raise the bars, drop the coin, show the name.
 * - At 1750 ms it leaves once the page has loaded (window "load"); until then the bars wave.
 *   Leaving: the other pieces fade, a div on the tall bar's frame (getBoundingClientRect)
 *   stretches to the top and bottom, then the sides, in the page's background colour, and
 *   the page fades in underneath.
 * - Whatever happens, everything is gone 3.5 s after the script started.
 *
 * The page itself is in the HTML underneath the whole time, for search engines and readers.
 */
const bars = MARK_BARS.map(
  (bar, i) =>
    `<rect class="ib-pre__bar ib-pre__b${i + 1}" x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${MARK_BAR_RADIUS}" fill="${BRAND.white}"/>`,
);
const coin = `<circle class="ib-pre__coin" cx="${MARK_COIN.cx}" cy="${MARK_COIN.cy}" r="${MARK_COIN.r}" fill="${BRAND.coral}"/>`;
const viewBox = `${MARK_VIEWBOX.x} ${MARK_VIEWBOX.y} ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`;

const MARKUP =
  `<svg class="ib-pre__mark" viewBox="${viewBox}"><g class="ib-pre__fade">${bars[0]}${bars[1]}${coin}</g>${bars[2].replace("ib-pre__bar ", "ib-pre__bar ib-pre__tall ")}</svg>` +
  `<div class="ib-pre__name"><svg viewBox="${WORDMARK.viewBox}"><path d="${WORDMARK.d}" fill="${BRAND.white}"/></svg></div>`;

export const PRELOADER_SCRIPT = `(function(){
try{
if(localStorage.getItem("ib-preloaded"))return;
if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
localStorage.setItem("ib-preloaded","1");
}catch(e){return;}
var d=document.documentElement,el,tall,done=false,loaded=false,waving=false;
var EASE="cubic-bezier(0.7,0,0.3,1)";
d.setAttribute("data-preload","");
function end(){if(done)return;done=true;if(el)el.remove();d.removeAttribute("data-preload");}
setTimeout(function(){
if(done)return;
d.removeAttribute("data-preload");
if(!el)return end();
el.style.transition="opacity 200ms";el.style.opacity="0";setTimeout(end,200);
},3500);
window.addEventListener("load",function(){loaded=true;if(waving)settle();});
function settle(){
waving=false;
tall.addEventListener("animationiteration",function(){el.classList.remove("ib-pre--wave");leave();},{once:true});
}
function leave(){
if(done)return;
el.classList.add("ib-pre--leave");
setTimeout(function(){
if(done)return;
var r=tall.getBoundingClientRect(),s=document.createElement("div");
s.className="ib-pre__stretch";
s.style.cssText="left:"+r.left+"px;top:"+r.top+"px;width:"+r.width+"px;height:"+r.height+"px;border-radius:"+r.width/2+"px";
el.appendChild(s);tall.style.visibility="hidden";
void s.offsetWidth;
s.style.transition="top 420ms "+EASE+",height 420ms "+EASE+",background-color 420ms "+EASE;
s.style.top="0";s.style.height=window.innerHeight+"px";
s.style.backgroundColor=getComputedStyle(document.body).backgroundColor;
setTimeout(function(){
if(done)return;
s.style.transition="left 420ms "+EASE+",width 420ms "+EASE+",border-radius 420ms "+EASE;
s.style.left="0";s.style.width=window.innerWidth+"px";s.style.borderRadius="0";
setTimeout(function(){
if(done)return;
d.classList.add("ib-reveal");end();
setTimeout(function(){d.classList.remove("ib-reveal");},450);
},420);
},420);
},200);
}
document.addEventListener("DOMContentLoaded",function(){
if(done)return;
el=document.createElement("div");el.className="ib-pre";el.setAttribute("aria-hidden","true");
el.innerHTML=${JSON.stringify(MARKUP)};
document.body.appendChild(el);
tall=el.querySelector(".ib-pre__tall");
setTimeout(function(){
if(loaded||document.readyState==="complete")return leave();
waving=true;el.classList.add("ib-pre--wave");
},1750);
});
})();`;
