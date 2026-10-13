import {test,expect} from '@playwright/test';
test.use({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
test('hosted phone edition caches its shell and starts driving offline',async({page,context})=>{
 await page.goto('http://localhost:8000/');
 await page.waitForFunction(()=>document.getElementById('loading').classList.contains('hidden'),{},{timeout:90000});
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{},{timeout:30000});
 const cached=await page.evaluate(async()=>{const cache=await caches.open('apex-mobile-v3');return Boolean(await cache.match(new URL('./index.html',location.href).href));});expect(cached).toBe(true);
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('loading').classList.contains('hidden'),{},{timeout:90000});await page.check('#auto-throttle');await page.click('#start');
 await page.waitForFunction(()=>Number(document.getElementById('speed').textContent)>20,{},{timeout:30000});
 await expect(page.locator('#mobile-controller')).toBeVisible();
});
