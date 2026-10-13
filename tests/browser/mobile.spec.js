import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ready=async page=>page.waitForFunction(()=>document.getElementById('loading').classList.contains('hidden'),{},{timeout:90000});
test.use({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
async function mockSensor(page,permission='granted'){
 await page.addInitScript(value=>{
   Object.defineProperty(DeviceOrientationEvent,'requestPermission',{value:async()=>value,configurable:true});
   Object.defineProperty(screen.orientation,'angle',{get:()=>window.__angle??0,configurable:true});
   window.__sample={beta:0,gamma:0};
   setInterval(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{...window.__sample})),50);
 },permission);
}
async function center(locator){const b=await locator.boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};}
const finger=(id,p)=>({id,x:p.x,y:p.y,radiusX:8,radiusY:8,force:1});

test('phone tilt and simultaneous touch gas/nitro drive the car; pause releases all fingers',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mockSensor(page);
 await page.goto('http://localhost:5173');await ready(page);
 await expect(page.locator('body')).toHaveClass(/mobile/);await expect(page.locator('#quality')).toContainText('流畅');
 const model=await page.evaluate(()=>{let triangles=0;__APEX_DEV__.vehicle.model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});const normals=__APEX_DEV__.vehicle.model.getObjectByName('body').geometry.attributes.normal;let valid=0;for(let i=0;i<normals.count;i++)if(normals.getX(i)**2+normals.getY(i)**2+normals.getZ(i)**2>.5)valid++;return {triangles,normalFraction:valid/normals.count};});
 expect(model.triangles).toBeGreaterThan(100000);expect(model.triangles).toBeLessThan(200000);expect(model.normalFraction).toBeGreaterThan(.95);
 await page.click('#motion-toggle');await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#motion-status')).toContainText('重力已开启');
 await page.click('#start');const cdp=await context.newCDPSession(page),gas=await center(page.locator('[data-drive="throttle"]')),boost=await center(page.locator('[data-drive="boost"]'));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(1,gas)]});
 await page.waitForFunction(()=>Number(document.getElementById('speed').textContent)>25,{},{timeout:30000});
 await page.evaluate(()=>window.__sample.gamma=20);await page.waitForFunction(()=>__APEX_DEV__.driver.steering<-.4,{},{timeout:15000});
 await page.click('#calibrate-mobile');await page.waitForFunction(()=>Math.abs(__APEX_DEV__.tilt.smoothed)<.03,{},{timeout:15000});
 // Start the boost phase on the track: the preceding full-lock steering can reach a barrier on slow software renderers.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.click('#reset-mobile');await expect(page.locator('#speed')).toHaveText('0');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(1,gas),finger(2,boost)]});
 await page.waitForFunction(()=>__APEX_DEV__.driver.boosting,{},{timeout:15000});
 await page.click('#pause-mobile');await expect(page.locator('#menu')).toBeVisible();expect(await page.evaluate(()=>__APEX_DEV__.touch.actions.size)).toBe(0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect(errors).toEqual([]);
});

test('denied gravity permission still permits multi-touch left steering and gas',async({page,context})=>{
 await mockSensor(page,'denied');await page.goto('http://localhost:5173');await ready(page);
 await page.click('#motion-toggle');await expect(page.locator('#motion-status')).toContainText('未允许');await expect(page.locator('#motion-toggle')).toHaveAttribute('aria-pressed','false');
 await page.click('#start');const cdp=await context.newCDPSession(page),gas=await center(page.locator('[data-drive="throttle"]')),left=await center(page.locator('[data-drive="left"]'));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(1,gas),finger(2,left)]});
 await page.waitForFunction(()=>__APEX_DEV__.driver.speed>3&&__APEX_DEV__.driver.steering>.5,{},{timeout:30000});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.locator('[data-drive="left"]')).toHaveAttribute('aria-pressed','false');await expect(page.locator('[data-drive="throttle"]')).toHaveAttribute('aria-pressed','false');
});

test('portrait auto throttle stops accelerating under brake and mobile archive runs offline',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await context.setOffline(true);
 await page.setContent(readFileSync('downloads/APEX-Mobile.html','utf8'),{waitUntil:'domcontentloaded'});await ready(page);
 await expect(page.locator('#mobile-settings')).toBeVisible();await page.check('#auto-throttle');await page.click('#start');
 await page.waitForFunction(()=>Number(document.getElementById('speed').textContent)>25,{},{timeout:30000});
 await expect(page.locator('#rotate-hint')).toBeVisible();const speed=Number(await page.locator('#speed').textContent());
 const cdp=await context.newCDPSession(page),brake=await center(page.locator('[data-drive="brake"]'));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(1,brake)]});
 await page.waitForFunction(s=>Number(document.getElementById('speed').textContent)<s-8,speed,{timeout:15000});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.click('#pause-mobile');await expect(page.locator('#menu')).toBeVisible();
});
