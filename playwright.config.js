import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';
export default defineConfig({
  testDir:'./tests/browser',workers:1,timeout:120000,
  use:{viewport:{width:1280,height:800},headless:true,
    launchOptions:{executablePath:process.env.APEX_CHROMIUM_PATH || (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),
      args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']},
  },
  webServer:{command:'npm run dev -- --port 5173',url:'http://localhost:5173',reuseExistingServer:!process.env.CI},
});
