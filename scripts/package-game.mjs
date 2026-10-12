import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {zipSync,strToU8} from 'fflate';
let html=readFileSync('dist/index.html','utf8');
let scripts=0,styles=0;
html=html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,path)=>{
 scripts++;const js=readFileSync(join('dist',path.replace(/^\//,'')),'utf8');
 return '<script type="module">'+js.replaceAll('</script','<\\/script')+'</script>';
});
html=html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,(_,path)=>{
 styles++;return '<style>'+readFileSync(join('dist',path.replace(/^\//,'')),'utf8')+'</style>';
});
if(scripts!==1||styles!==1||/<script[^>]*src=|<link[^>]*rel="stylesheet"/.test(html))throw new Error('Unexpected external build resources; refusing to package an incomplete game.');
const instructions=`APEX II / 极境飞驰 · 写实升级版\n\n1. 解压压缩包。\n2. 使用电脑 Chrome 或 Edge 打开 APEX赛车.html。\n3. 点击“开始驾驶”；可选择自由驾驶或三圈竞速。\n\nWASD / 方向键：驾驶\n空格：手刹漂移\nShift：氮气（松开自动补充）\nC：追车、车内、引擎盖、高位镜头\nQ：按住后视\nR：重置本次驾驶\nEsc：暂停\n\n右上角可开启引擎声音、全屏和驾驶指南。右下角可切换流畅画质。\n游戏包含全部模型与光照资源，不需要安装 Node.js 或保持联网。\n需要支持 WebGL 2 的电脑浏览器并开启硬件加速；高画质建议独立显卡。\n首次载入需要几秒钟，速度因电脑而异。\n这是独立 3D 赛车演示，驾驶物理为街机模拟，不是商业游戏复刻。\n\n车辆模型及环境资产作者、来源和授权说明请见 THIRD_PARTY_NOTICES.md。\n源码：https://github.com/luoyonggang/ha\n`;
mkdirSync('downloads',{recursive:true});
writeFileSync('downloads/APEX-Racing.html',html);
const zip=zipSync({
 'APEX赛车.html':strToU8(html),
 '使用说明.txt':strToU8(instructions),
 'THIRD_PARTY_NOTICES.md':strToU8(readFileSync('THIRD_PARTY_NOTICES.md','utf8')),
 'THREE-LICENSE.txt':strToU8(readFileSync('src/assets/THREE-LICENSE.txt','utf8')),
},{level:6});
writeFileSync('downloads/APEX-Racing.zip',zip);
console.log(`Standalone HTML: ${(Buffer.byteLength(html)/1024/1024).toFixed(1)} MB; ZIP: ${(zip.length/1024/1024).toFixed(1)} MB. All runtime resources embedded.`);
