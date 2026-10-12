export class EngineAudio {
  constructor(){this.enabled=false;this.ctx=null;}
  toggle() {
    this.enabled=!this.enabled;
    if(this.enabled&&!this.ctx) {
      this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=.065;
      const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1400;
      filter.connect(this.master).connect(this.ctx.destination);
      this.voices=[1,2,4].map((harmonic,i)=>{const oscillator=this.ctx.createOscillator(),gain=this.ctx.createGain();oscillator.type=i===0?'sawtooth':'triangle';gain.gain.value=[.3,.22,.1][i];oscillator.connect(gain).connect(filter);oscillator.start();return{oscillator,harmonic};});
      const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const noise=this.ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
      const band=this.ctx.createBiquadFilter();band.type='bandpass';band.frequency.value=1900;band.Q.value=.8;
      this.skidGain=this.ctx.createGain();this.skidGain.gain.value=0;
      noise.connect(band).connect(this.skidGain).connect(this.master);noise.start();
    }
    if(this.ctx){this.ctx.resume();this.master.gain.setTargetAtTime(this.enabled?.065:0,this.ctx.currentTime,.1);}
    return this.enabled;
  }
  update(car,driving) {
    if(!this.ctx||!this.enabled)return;
    const t=this.ctx.currentTime;
    this.voices.forEach(({oscillator,harmonic})=>oscillator.frequency.setTargetAtTime((driving?car.rpm:950)/60*2*harmonic,t,.08));
    this.skidGain.gain.setTargetAtTime(driving?Math.min(.55,Math.abs(car.slip)*2):0,t,.1);
  }
}
