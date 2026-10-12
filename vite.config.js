import {defineConfig} from 'vite';
export default defineConfig({
  assetsInclude:['**/*.glb','**/*.hdr'],
  build:{assetsInlineLimit:24*1024*1024,chunkSizeWarningLimit:24000},
});
