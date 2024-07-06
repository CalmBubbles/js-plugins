/*

(Currently in alpha, version might be unstable)
Makes the use of web audio a lot easier. Adds more feature to audio.
Originally made for SpiritAxolotl's birthday.

Version : 0.83a

By CalmBubbles :)

*/

class BetterAudio
{
    #loaded = false;
    #playing = false;
    #paused = false;
    #stopped = false;
    #keepTime = false;
    #muted = false;
    #lastTime = 0;
    #startTime = 0;
    #elapsedTime = 0;
    #volume = 1;
    #src = "";
    
    #focusCall = () => { };
    
    #seekable = {
        start : 0,
        end : NaN,
        get length ()
        {
            return this.end - this.start;
        }
    };
    
    #context = null;
    #gain = null;
    #source = null;
    #buffer = null;
    #seekTime = null;
    
    loop = false;
    autoplay = false;
    
    get isLoaded ()
    {
        return this.#loaded;
    }
    
    get src ()
    {
        return this.#src;
    }
    
    set src (value)
    {
        this.#src = value;
        
        this.Load();
    }
    
    get paused ()
    {
        return this.#paused;
    }
    
    get currentTime ()
    {
        return this.#elapsedTime;
    }
    
    set currentTime (value)
    {
        this.#seekTime = value;
    }
    
    get duration ()
    {
        if (!this.#loaded) return NaN;
        
        return this.#buffer.duration;
    }
    
    get seekable ()
    {
        return this.#seekable;
    }
    
    set seekable (value)
    {
        this.#seekable = value;
    }
    
    get seeking ()
    {
        return this.#seekTime != null;
    }
    
    get volume ()
    {
        return this.#volume;
    }
    
    set volume (value)
    {
        this.#volume = value;
        
        if (!this.#muted) this.#UpdateVolume();
    }
    
    get muted ()
    {
        return this.#muted;
    }
    
    set muted (value)
    {
        this.#muted = value;
        
        this.#UpdateVolume();
    }
    
    constructor (url)
    {
        this.#context = new AudioContext();
        
        this.#gain = this.#context.createGain();
        this.#gain.connect(this.#context.destination);
        
        if (url != null) this.src = url;
        
        this.Load();
    }
    
    #RequestUpdate ()
    {
        requestAnimationFrame(this.#Update.bind(this));
    }
    
    #Update ()
    {
        if (!this.#loaded) return this.#RequestUpdate();
        
        let elapsedT = this.#elapsedTime;
        let movedET = 0;
        
        if (this.#playing && !this.#paused && !this.#stopped) elapsedT = this.#context.currentTime - this.#lastTime;
        
        if (this.#seekTime != null)
        {
            elapsedT = this.#seekTime;
            movedET = 1;
        }
        
        if (elapsedT < this.#seekable.start)
        {
            elapsedT = this.#seekable.start;
            movedET = 1;
        }
        else if (elapsedT > this.#seekable.end)
        {
            elapsedT = this.#seekable.end;
            movedET = 2;
        }
        
        this.#elapsedTime = elapsedT;
        
        if (movedET !== 0 && this.#playing)
        {
            if (movedET === 1)
            {
                this.#keepTime = true;
            }
            
            this.#source.stop();
        }
        
        this.#RequestUpdate();
    }
    
    #UpdateVolume ()
    {
        if (this.#muted) return this.#gain.gain.value = 0;
        
        this.#gain.gain.value = this.#volume;
    }
    
    Pause ()
    {
        if (!this.#loaded || !this.#playing || this.#paused) return;
        
        this.#source.stop();
        
        this.#paused = true;
    }
    
    Stop ()
    {
        if (!this.#loaded || !this.#playing) return;
        
        this.#source.stop();
        
        this.#paused = false;
        this.#stopped = true;
    }
    
    PlayOneShot ()
    {
        if (!this.#loaded) return;
        
        const source = this.#context.createBufferSource();
        
        source.buffer = this.#buffer;
        source.connect(this.#gain);
        source.start();
    }
    
    FastSeek (time)
    {
        this.#seekTime = time; 
    }
    
    async Play ()
    {
        if (!this.#loaded || this.#playing) return;
        
        this.#source = this.#context.createBufferSource();
        
        this.#source.buffer = this.#buffer;
        this.#source.connect(this.#gain);
        
        if (this.#seekTime != null) this.#seekTime = null;
        else if (!this.#paused && !this.#keepTime) this.#elapsedTime = this.#seekable.start;
        
        if (this.#paused || this.#stopped)
        {
            this.#paused = false;
            this.#stopped = false;
        }
        else if (this.#keepTime) this.#keepTime = false;
        
        this.#startTime = this.#elapsedTime;
        
        this.#source.start(0, this.#startTime);
        
        if (this.#context.state === "suspended")
        {
            this.#focusCall = () => {
                const backupCall = this.#focusCall;
                
                this.#focusCall = () => { };
                
                this.#source.start(0, this.#startTime);
                
                if (this.#context.state === "suspended") this.#focusCall = backupCall;
            }
        }
        
        this.#playing = true;
        this.#lastTime = this.#context.currentTime - this.#elapsedTime;
        
        await new Promise(resolve => this.#source.onended = () => {
            this.#playing = false;

            if (!this.#paused && !this.#stopped && this.loop || this.#keepTime) this.Play();
            
            resolve();
        });
        
        return true;
    }
    
    async Load ()
    {
        if (!this.#src) return;
        
        this.#loaded = false;
        
        const audio = await fetch(this.#src);
        const arrayBuffer = await audio.arrayBuffer();
        
        this.#buffer = await this.#context.decodeAudioData(arrayBuffer);
        
        if (isNaN(this.#seekable.end)) this.#seekable.end = this.#buffer.duration;        
        
        this.#loaded = true;
        
        this.#RequestUpdate();
        
        document.addEventListener("click", () => this.#focusCall());
        
        if (this.autoplay) this.Play();
    }
}