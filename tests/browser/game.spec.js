import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const ready=async p=>p.waitForFunction(()=>document.getElementById('loading').classList.contains('hidden'),{},{timeout:90000});

test('detailed model, paint, driving, nitro, four cameras, reset and pause',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await ready(page);
 const model=await page.evaluate(async()=>{const d=globalThis.__APEX_DEV__;let triangles=0;d.vehicle.model.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});return{triangles,wheels:d.vehicle.wheels.length};});
 expect(model.triangles).toBeGreaterThan(300000);expect(model.wheels).toBe(4);
 await page.click('[data-color="#236696"]');await expect(page.locator('#color-name')).toHaveText('ATLANTIC BLUE');
 const color=await page.evaluate(async()=>{const d=globalThis.__APEX_DEV__;return d.vehicle.paint.color.getHexString();});expect(color).toBe('236696');
 await page.click('#quality');await page.click('#start');await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>Number(document.getElementById('speed').textContent)>50,{},{timeout:60000});
 await page.keyboard.down('ShiftLeft');await page.waitForFunction(()=>parseFloat(document.getElementById('nitro').style.width)<97,{},{timeout:30000});
 await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
 for(const label of ['COCKPIT','HOOD CAM','WIDE CAM','CHASE CAM']){await page.keyboard.press('KeyC');await expect(page.locator('#camera-label')).toHaveText(label);}
 await page.keyboard.press('KeyR');await expect(page.locator('#speed')).toHaveText('0');
 await page.keyboard.press('Escape');await expect(page.locator('#menu')).toBeVisible();await page.click('#start');await expect(page.locator('#hud')).toBeVisible();
 await page.click('#sound');await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');
 await page.click('#help-button');await expect(page.locator('#help')).toBeVisible();await page.click('#close-help');await expect(page.locator('#help')).toBeHidden();
 expect(errors).toEqual([]);
});

test('race countdown and actual third lap crossing produce a result',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await ready(page);await page.click('#quality');await page.click('[data-mode="race"]');await page.click('#start');
 await expect(page.locator('#countdown')).toBeVisible();await expect(page.locator('#speed')).toHaveText('0');
 await expect(page.locator('#countdown')).toBeHidden({timeout:30000});
 // Place the car at a checkpoint just before completing lap 3, then actually drive across it.
 await page.evaluate(async()=>{
  const d=globalThis.__APEX_DEV__;const {curve}=d;
  const p=curve.getPointAt(.996),t=curve.getTangentAt(.996);d.driver.position.copy(p);d.driver.motion.copy(t).multiplyScalar(30);d.driver.yaw=Math.atan2(-t.x,-t.z);
  d.driver.completedLaps=2;d.driver.lap=3;d.driver.lapTravel=.996;d.driver.lastProgress=.996;d.driver.lapTime=70;d.driver.bestLap=68;d.driver.elapsed=210;
 });
 await page.keyboard.down('KeyW');await expect(page.locator('#result')).toBeVisible({timeout:30000});await page.keyboard.up('KeyW');
 await expect(page.locator('#result-detail')).toContainText('三圈竞速');await expect(page.locator('#result-best')).toHaveText('01:08.000');
 await page.click('#return-menu');await expect(page.locator('#menu')).toBeVisible();await expect(page.locator('#result')).toBeHidden();expect(errors).toEqual([]);
});

test('single HTML loads and drives with network access disabled',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await context.setOffline(true);
 await page.setContent(readFileSync('downloads/APEX-Racing.html','utf8'),{waitUntil:'domcontentloaded',timeout:60000});await ready(page);
 await page.click('#quality');await page.click('#start');await page.keyboard.down('KeyW');
 await page.waitForFunction(()=>Number(document.getElementById('speed').textContent)>25,{},{timeout:60000});await page.keyboard.up('KeyW');
 await expect(page.locator('#hud')).toBeVisible();expect(errors).toEqual([]);
});
