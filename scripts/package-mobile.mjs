import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {zipSync,strToU8} from 'fflate';
let html=readFileSync('dist-mobile/index.html','utf8');let scripts=0,styles=0;
html=html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,path)=>{scripts++;return '<script type="module">'+readFileSync(join('dist-mobile',path.replace(/^\//,'')),'utf8').replaceAll('</script','<\\/script')+'</script>';});
html=html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,(_,path)=>{styles++;return '<style>'+readFileSync(join('dist-mobile',path.replace(/^\//,'')),'utf8')+'</style>';});
if(scripts!==1||styles!==1)throw Error('Unexpected build resources');
html=html.replace('<title>APEX II — 极境飞驰 · Pacific Grand Tour</title>','<title>APEX MOBILE / 极境飞驰 · 重力赛车</title>');
const instructions=`APEX MOBILE / 极境飞驰 · 手机版\n\n推荐横屏。点击“开启重力转向”，允许手机传感器权限，握稳手机等待校准，再点“开始驾驶”。向左右倾斜转向，按住油门加速。可同时按住氮气与油门，刹车或漂移。可勾选自动油门。触屏左右按钮始终可用。屏幕旋转后重新校准。\n\n重要：手机重力操作需要 HTTPS 网页。直接从文件管理器打开 HTML，部分手机不能读取传感器，仍可使用触屏按钮。iPhone 请用 Safari，Android 请用 Chrome 或支持 WebGL 2 与传感器的浏览器。微信等内置浏览器可能不提供权限，请在系统浏览器打开。\n\n已准备好 GitHub Pages 网页。仓库主人首次设置：打开 https://github.com/luoyonggang/ha/settings/pages ，在 Build and deployment / Source 选择 Deploy from a branch，Branch 选 main，文件夹选 /docs，Save。等待 GitHub 部署成功后访问 https://luoyonggang.github.io/ha/ 。如果部署尚未成功，该地址还不能游玩。\n\n在线版首次完整加载后可以通过浏览器“添加到主屏幕”，之后离线缓存可用。缓存是否成功取决于浏览器与可用存储。\n\n控制：倾斜手机 / 左右触屏按钮转向；油门、刹车、漂移、氮气；镜头切换、重置、校准、暂停。\n这是支持手机的网页游戏。传感器权限与响应需要真实手机确认；电脑版键盘仍可使用。\n模型作者和许可见 THIRD_PARTY_NOTICES.md。\n`;
mkdirSync('downloads',{recursive:true});mkdirSync('docs',{recursive:true});
writeFileSync('downloads/APEX-Mobile.html',html);writeFileSync('docs/index.html',html);
const files={'APEX手机赛车.html':strToU8(html),'手机版使用说明.txt':strToU8(instructions),'THIRD_PARTY_NOTICES.md':strToU8(readFileSync('THIRD_PARTY_NOTICES.md','utf8')),'THREE-LICENSE.txt':strToU8(readFileSync('src/assets/THREE-LICENSE.txt','utf8'))};
for(const name of ['manifest.webmanifest','icon.svg','sw.js']){copyFileSync(join('public',name),join('docs',name));files[name]=new Uint8Array(readFileSync(join('public',name)));}
writeFileSync('docs/.nojekyll','');
writeFileSync('downloads/APEX-Mobile.zip',zipSync(files,{level:6}));
console.log(`Mobile HTML ${(Buffer.byteLength(html)/1024/1024).toFixed(1)} MB; ZIP ${(readFileSync('downloads/APEX-Mobile.zip').length/1024/1024).toFixed(1)} MB. Prepared docs/ for HTTPS hosting.`);
