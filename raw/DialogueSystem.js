/*

A JavaScript plugin that adds a div based RPG style dialogue system. Which includes animation, audio, images and function call logic.
Originally made for SpiritAxolotl's birthday.

Version : 2f - Raw

By CalmBubbles :)

*/


window.addEventListener("load", () => {
    DialogueLoop.Init();
});


class DialoguePortraitPosition
{
    static get Left () { return 0; }
    static get Right () { return 1; }
}

class DialogueDirectoryType
{
    static get Root () { return 0; }
    static get Same () { return 1; }
}

class DialogueEvent
{
    static get None () { return 0; }
    static get Load () { return 1; }
    static get Enable () { return 2; }
    static get Disable () { return 3; }
    static get TypingEnter () { return 4; }
    static get TypingExit () { return 5; }
    static get PortraitEnable () { return 6; }
    static get LineClear () { return 7; }
    static get Clear () { return 8; }
}


class DialogueSystem
{
    static experimental = false;
}

class NamedItem
{
    name = "";
}

class NamedArray
{
    items = [];
    
    Find (name)
    {
        const obj = this.items.find(item => item.name === name);
        
        return obj != null ? obj : { };
    }
}

class Property extends NamedItem
{
    value = null;
    
    constructor (name, value)
    {
        super();
        
        this.name = name ?? "Unnamed";
        this.value = value;
    }
}

class DialogueLoop
{
    static #loaded = false;
    static #frameIndex = 0;
    static #uTime = 0;
    static #uDeltaTime = 0;
    static #time = 0;
    static #deltaTime = 0;
    static #calls = [];
    
    static targetFrameRate = 60;
    static timeScale = 1;
    static maximumDeltaTime = 0.1111111;
    
    static get frameCount ()
    {
        return this.#frameIndex;
    }
    
    static get unscaledTime ()
    {
        return this.#uTime;
    }
    
    static get unscaledDeltaTime ()
    {
        return this.#uDeltaTime;
    }
    
    static get time ()
    {
        return this.#time;
    }
    
    static get deltaTime ()
    {
        return this.#deltaTime;
    }
    
    static #RequestUpdate ()
    {
        requestAnimationFrame(this.#Update.bind(this));
    }
    
    static #Update ()
    {
        const slice = (1 / this.targetFrameRate) - 5e-3;
        
        let accumulator = (1e-3 * performance.now()) - this.#uTime;
        
        while (accumulator >= slice)
        {
            this.#uDeltaTime = (1e-3 * performance.now()) - this.#uTime;
            this.#uTime += this.#uDeltaTime;
            
            let deltaT = this.#uDeltaTime;
            
            if (deltaT > this.maximumDeltaTime) deltaT = this.maximumDeltaTime;
            
            this.#deltaTime = deltaT * this.timeScale;
            this.#time += this.#deltaTime;
            
            this.#Invoke();
            
            this.#frameIndex++;
            
            accumulator -= slice;
        }
        
        this.#RequestUpdate();
    }
    
    static #Invoke ()
    {
        for (let i = 0; i < this.#calls.length; i++)
        {
            const currentCall = this.#calls[i];
            
            currentCall.time += this.#deltaTime;
            
            if (currentCall.time <= currentCall.timeout) continue;
            
            currentCall.callback();
            
            if (currentCall.clear()) this.#calls.splice(this.#calls.indexOf(currentCall), 1);
            else currentCall.time = 0;
        }
    }
    
    static Init ()
    {
        if (this.#loaded) return;
        
        this.#loaded = true;
        
        this.#RequestUpdate();
    }
    
    static Append (callback, delay, shouldClear)
    {
        this.#calls.push({
            callback : callback,
            clear : shouldClear ?? (() => false),
            timeout : delay ?? 0,
            time : 0
        });
    }
    
    static async Delay (time)
    {
        if (time === 0) return;
        
        let done = false;
        
        return new Promise(resolve => this.Append(() => {
            done = true;
            
            resolve();
        }, time, () => done));
    }
}

class DialogueManager
{
    #loaded = false;
    #active = false;
    #inUse = false;
    #portraitEnabled = false;
    #finishTask = false;
    #event = 0;
    #charIndex = 0;
    #iterIndex = 0;
    #wordIndex = 0;
    #events = [];
    #loopIndexes = [
        0,
        0,
        0
    ];
    
    #diaBox = null;
    #diaPortrait = null;
    #diaLine = null;
    #portraitSprite = null;
    
    waitDisableClear = true;
    soundInterval = 3;
    portraitPosition = 0;
    characters = [];
    
    config = new DialogueManagerConfig();
    style = new DialogueStyle();
    audioSource = new DialogueAudioSource();
    animation = new DialogueAnimationConfig();
    
    get isLoaded ()
    {
        return this.#loaded;
    }
    
    get isActive ()
    {
        return this.#active;
    }
    
    get isInUse ()
    {
        return this.#inUse;
    }
    
    get portraitEnabled ()
    {
        return this.#portraitEnabled;
    }
    
    get currentEvent ()
    {
        return this.#event;
    }
    
    get charCount ()
    {
        return this.#charIndex;
    }
    
    get wordCount ()
    {
        return this.#wordIndex;
    }
    
    get dialogueBox ()
    {
        return this.#diaBox;
    }
    
    get dialoguePortrait ()
    {
        return this.#diaPortrait;
    }
    
    get dialogueLine ()
    {
        return this.#diaLine;
    }
    
    constructor (dialogueBox)
    {
        this.#diaBox = dialogueBox;
        
        this.#diaBox.setAttribute("data-enabled", "false");
        this.#diaBox.setAttribute("data-portrait-enabled", "false");
        
        this.#diaBox.classList.add("dialogue-box");
        
        if (this.#diaPortrait != null) this.#diaPortrait.remove();
        if (this.#diaLine != null) this.#diaLine.remove();
        
        this.#diaPortrait = document.createElement("img");
        this.#diaLine = document.createElement("div");
        
        this.#diaPortrait.style.display = "none";
        this.#diaPortrait.style.visibility = "hidden";
        this.#diaLine.style.display = "inline-block";
        
        this.#diaPortrait.classList.add("dialogue-portrait");
        this.#diaLine.classList.add("dialogue-line");
        
        this.#diaBox.append(this.#diaPortrait, this.#diaLine);
        
        this.#Load();
    }
    
    #Update ()
    {
        if (!this.#active) return;
        
        for (let iA = 0; iA < 3; iA++)
        {
            for (let iB = 0; iB < this.#charIndex; iB++)
            {
                if (!this.characters[iB].isEnabled || this.characters[iB].animations[iA] == null)
                {
                    if (iB === this.#charIndex - 1) this.#loopIndexes[iA]++;
                    
                    continue;
                }
                
                const ended = this.characters[iB].animations[iA].hasEnded;
                
                if (!ended || (this.characters[iB].animations[iA].loop && this.characters[iB].animations[iA].loopCount <= this.#loopIndexes[iA]))
                {
                    this.characters[iB].animations[iA].Animate();
                    
                    if (this.characters[iB].animations[iA].wait && !(iA === 0 || this.#finishTask)) break;                
                }
                
                if (iB === this.#charIndex - 1) this.#loopIndexes[iA]++;
            }
        }
    }
    
    #AddEvent (event, callback, recallable)
    {
        if (!([1, 2, 3, 4, 5, 6, 7, 8]).includes(event)) return;
        
        const listener = this.#events.find(item => item.event === event && item.callback === callback && item.recallable === recallable);
        
        if (listener == null)
        {
            this.#events.push({
                event : event,
                callback : callback,
                recallable : recallable
            });
            
            return;
        }
        
        const index = this.#events.indexOf(listener);
        
        this.#events.splice(index, 1);
    }
    
    #CallEvent (event)
    {
        this.#event = event;
        
        const events = this.#events.filter(item => item.event === event);
        
        for (let i = 0; i < events.length; i++)
        {
            events[i].callback();
            
            if (!events[i].recallable) this.#events.splice(this.#events.indexOf(events[i]), 1);
        }
        
        this.#event = 0;
    }
    
    Finish ()
    {
        if (this.#loaded && !this.#finishTask) this.#finishTask = true;
    }
    
    BreakLine (amount)
    {
        if (!this.#loaded || !this.#active || this.#inUse) return;
        
        for (let i = 0; i < (amount ?? 1); i++)
        {
            const br = document.createElement("br");
            
            br.classList.add("dialogue-line-level");
            
            this.#diaLine.append(br);
        }
    }
    
    On (event, callback)
    {
        this.#AddEvent(event, callback, true);
    }
    
    Once (event, callback)
    {
        this.#AddEvent(event, callback, false);
    }
    
    UpdateSpaces ()
    {
        if (!this.#loaded || !this.#active) return;

        requestAnimationFrame(() => {
            const lineObjs = this.#diaLine.querySelectorAll(".dialogue-line-level");
            const maxWidth = this.#diaLine.getBoundingClientRect().width;

            let currentWidth = 0;
        
            for (let i = 0; i < lineObjs.length; i++)
            {
                if (lineObjs[i].tagName === "BR")
                {
                    currentWidth = 0;

                    continue;
                }

                lineObjs[i].style.display = "inline-block";

                currentWidth += lineObjs[i].getBoundingClientRect().width;
            
                if (currentWidth <= maxWidth) continue;
            
                if (lineObjs[i].textContent !== " ")
                {
                    currentWidth = lineObjs[i].getBoundingClientRect().width;

                    continue;
                }
            
                currentWidth = 0;

                lineObjs[i].style.display = "none";
            }
        });
    }
    
    async #Delay (time)
    {
        if (time === 0) return;
        
        let currentTime = 0;
        
        return new Promise(resolve => DialogueLoop.Append(() => {
            currentTime += DialogueLoop.deltaTime;
            
            if (currentTime > time || this.#finishTask) resolve();
        }, 0, () => currentTime > time || this.#finishTask));
    }
    
    async #Load ()
    {
        await new Promise(resolve => DialogueLoop.Append(() => {
            for (let i = 0; i < this.config.audios.items.length; i++) if (!this.config.audios.items[i].isLoaded) return;
            
            for (let i = 0; i < this.config.sprites.items.length; i++) if (!this.config.sprites.items[i].isLoaded) return;
            
            this.#loaded = true;
            
            resolve();
        }, 0, () => this.#loaded));
        
        DialogueLoop.Append(() => this.#Update());
        
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        this.#CallEvent(1);
    }
    
    async #Loop ()
    {
        const textAnim = this.animation.text.onAppend;
        let soundIndex = 0;
        
        while (this.#iterIndex < this.characters.length)
        {
            const currentChar = this.characters[this.#iterIndex];
            
            currentChar.Enable();
            
            if (currentChar.audio != null)
            {
                soundIndex++;

                if (soundIndex >= this.soundInterval)
                {
                    const clip = this.config.audios.Find(currentChar.audio);
                    
                    this.audioSource.Play(clip);

                    soundIndex = 0;
                }
            }
            
            if (!this.#finishTask)
            {
                await this.#Delay(currentChar.delay);
                
                if (textAnim.animation != null && textAnim.wait)
                {
                    let animated = false;
                    
                    await new Promise(resolve => DialogueLoop.Append(() => {
                        if (!this.characters[this.#iterIndex].animations[0].hasEnded && !this.#finishTask) return;
                        
                        animated = true;
                        
                        resolve();
                    }, 0, () => animated));
                }
            }
            
            this.#iterIndex++;
        }
        
        if (textAnim.animation == null || textAnim.wait || this.#finishTask) return;
        
        let animated = false;
        
        await new Promise(resolve => DialogueLoop.Append(() => {
            if (!this.characters[this.characters.length - 1].animations[0].hasEnded && !this.#finishTask) return;
            
            animated = true;
            
            resolve();
        }, 0, () => animated));
    }
    
    async #AnimateTextClear ()
    {
        if (this.#charIndex === 0) return;

        const textAnim = this.animation.text.onClear;
        
        if (textAnim.animation != null)
        {
            for (let i = 0; i < this.characters.length; i++)
            {
                const animation = Reflect.construct(this.config.animations.Find(textAnim.animation).constructor, []);
                
                animation.Set(
                    i,
                    this.characters[i],
                    2,
                    this.#loopIndexes[2],
                    textAnim.animationParams
                );
                
                animation.loop = false;
                animation.wait = textAnim.wait;
                animation.duration = textAnim.duration;
            }
            
            let done = false;
            
            await new Promise(resolve => DialogueLoop.Append(() => {
                if (!this.characters[this.characters.length - 1].animations[2].hasEnded && !this.#finishTask) return;
                
                done = true;
                
                resolve();
            }, 0, () => done));
        }
    }
    
    async #ClearBase ()
    {
        const lineObjs = this.#diaLine.querySelectorAll(".dialogue-line-level");
        
        if ((lineObjs.length === 0 && !this.#portraitEnabled) || !this.#loaded || !this.#active) return;
        
        if (!this.#finishTask) await this.#AnimateTextClear();
        
        let clearPortrait = false;
        let portraitAnim = null;
        
        if (this.#finishTask || !this.#portraitEnabled)
        {
            portraitAnim = this.animation.portrait.onDisable;
            this.animation.portrait.onDisable = new DialogueAnimation();
        }
        
        let resolvePortrait = () => { };
        
        const portraitPromise = new Promise(resolve => resolvePortrait = () => resolve());
        
        await this.animation.portrait.onDisable.Animate(this.#diaPortrait, () => {
            const animated = this.animation.portrait.onDisable.animation !== "";
            
            if (animated) this.#diaPortrait.style.visibility = "hidden";
            
            DialogueLoop.Append(() => {
                if (!clearPortrait) return;
                
                if (!animated) this.#diaPortrait.style.visibility = "hidden";
                
                this.#diaPortrait.style.display = "none";
                
                this.#diaBox.setAttribute("data-portrait-enabled", "false");
                this.#portraitEnabled = false;
                
                resolvePortrait();
            }, 0, () => clearPortrait);
        });
        
        if (portraitAnim != null) this.animation.portrait.onDisable = portraitAnim;
        
        if (!this.#finishTask) await this.animation.lineClear.Animate(this.#diaLine, null, time => this.#Delay(time));
        
        this.#diaLine.style.visibility = "hidden";
        
        clearPortrait = true;
        
        await portraitPromise;
        
        for (let i = 0; i < lineObjs.length; i++) lineObjs[i].remove();
        
        this.#diaLine.style.visibility = "visible";
        
        this.#charIndex = 0;
        this.#iterIndex = 0;
        this.#wordIndex = 0;
        this.characters = [];
        this.#loopIndexes = [
            0,
            0,
            0
        ];
        this.#portraitSprite = null;
    }
    
    async SetActive (state)
    {
        if (state == this.#active || !this.#loaded || this.#inUse) return;
        
        this.#inUse = true;
        
        if (state)
        {
            this.#diaBox.setAttribute("data-enabled", "true");
            
            if (!this.#finishTask) await this.animation.box.onEnable.Animate(this.#diaBox, null, time => this.#Delay(time));
            
            this.#active = true;
            this.#inUse = false;
            this.#finishTask = false;
            
            this.#CallEvent(2);
            
            return;
        }
        
        if (this.waitDisableClear) await this.#ClearBase(true);
        else this.#ClearBase(true);
        
        this.#CallEvent(7);
        this.#CallEvent(8);
        
        if (!this.#finishTask) await this.animation.box.onDisable.Animate(this.#diaBox, null, time => this.#Delay(time));
        
        this.#diaBox.setAttribute("data-enabled", "false");
        
        this.#active = false;
        this.#inUse = false;
        this.#finishTask = false;
        
        this.#CallEvent(3);
    }
    
    async Type (text, speed, data)
    {
        if (!this.#loaded || !this.#active || this.#inUse) return;
        
        this.#inUse = true;
        
        if (data == null) data = new DialogueData();
        
        const updatePortrait = data.portrait != null && data.portrait !== this.#portraitSprite;
        
        if (updatePortrait)
        {
            this.#portraitSprite = data.portrait;
            
            if (!this.#portraitEnabled)
            {
                const sprite = this.config.sprites.Find(this.#portraitSprite);
                
                this.#diaPortrait.src = sprite.spriteURL;
                
                await new Promise(resolve => this.#diaPortrait.onload = resolve);
                
                this.#diaPortrait.onload = () => { };
                
                this.#diaBox.setAttribute("data-portrait-enabled", "true");
                this.#diaPortrait.style.display = "inline-block";
                
                let pos = "";
                
                switch (this.portraitPosition)
                {
                    case 0:
                        pos = "left";
                        break;
                    case 1:
                        pos = "right";
                        break;
                }
                
                this.#diaPortrait.style.float = pos;
            }
        }
        
        const iterSpeed = (1 / 60 / speed) - 4e-4;
        
        const dat = data ?? new DialogueData();
        const style = this.style.Create(dat.style);
        
        let currentWord = null;
        
        for (let i = 0; i < text.length; i++)
        {
            const newChar = document.createElement(text[i] === "\n" ? "br" : "span");
            
            if (text[i] !== "\n")
            {
                newChar.style.backdropFilter = style.backdropFilter;
                newChar.style.background = style.background;
                newChar.style.bottom = style.bottom;
                newChar.style.color = style.color;
                newChar.style.fontFamily = style.fontFamily;
                newChar.style.fontFeatureSettings = style.fontFeatureSettings;
                newChar.style.fontKerning = style.fontKerning;
                newChar.style.fontSize = style.fontSize;
                newChar.style.fontSizeAdjust = style.fontSizeAdjust;
                newChar.style.fontStretch = style.fontStretch;
                newChar.style.fontStyle = style.fontStyle;
                newChar.style.fontVariant = style.fontVariant;
                newChar.style.fontVariantCaps = style.fontVariantCaps;
                newChar.style.fontWeight = style.fontWeight;
                newChar.style.left = style.left;
                newChar.style.letterSpacing = style.letterSpacing;
                newChar.style.right = style.right;
                newChar.style.textDecoration = style.textDecoration;
                if (style.textDecorationColor != "" && style.textDecorationColor != null) newChar.style.textDecorationColor = style.textDecorationColor;
                if (style.textDecorationLine != "" && style.textDecorationLine != null) newChar.style.textDecorationLine = style.textDecorationLine;
                if (style.textDecorationStyle != "" && style.textDecorationStyle != null) newChar.style.textDecorationStyle = style.textDecorationStyle;
                if (style.textDecorationThickness != "" && style.textDecorationThickness != null) newChar.style.textDecorationThickness = style.textDecorationThickness;
                newChar.style.textEmphasis = style.textEmphasis;
                newChar.style.textShadow = style.textShadow;
                newChar.style.textTransform = style.textTransform;
                newChar.style.transform = style.transform;
                newChar.style.transition = style.transition;
                newChar.style.top = style.top;
                newChar.style.verticalAlign = style.verticalAlign;
                newChar.style.writingMode = style.writingMode;
                newChar.style.zIndex = style.zIndex;
                
                if (text[i] == " " && style.wordSpacing != "inherit") newChar.style.width = style.wordSpacing;
                
                newChar.style.display = "inline-block";
                newChar.style.position = "relative";
                newChar.style.textAlign = "center";
                newChar.style.visibility = "hidden";
                newChar.style.whiteSpace = "pre-wrap";
                
                newChar.append(text[i]);
            }
            
            newChar.classList.add("dialogue-char", `dialogue-char-${this.#charIndex}`);
            
            if (text[i] !== " " && text[i] !== "\n")
            {
                if (currentWord == null)
                {
                    currentWord = document.createElement("span");
                    
                    currentWord.style.display = "inline-block";
                    
                    currentWord.classList.add("dialogue-word", `dialogue-word-${this.#wordIndex}`, "dialogue-line-level");
                }
                
                currentWord.append(newChar);
            }
            
            if (text[i] === " " || text[i] === "\n" || i === text.length - 1)
            {
                if (currentWord != null)
                {
                    this.#diaLine.append(currentWord);
                    
                    currentWord = null;
                    
                    this.#wordIndex++;
                }
                
                if (text[i] === " " || text[i] === "\n")
                {
                    newChar.classList.add("dialogue-line-level");
                    
                    this.#diaLine.append(newChar);
                }
            }
            
            const diaChar = new DialogueChar(
                newChar,
                iterSpeed,
                dat.audio
            );
            
            const appendAnim = this.animation.text.onAppend;
            
            if (appendAnim.animation != null)
            {
                const animation = Reflect.construct(this.config.animations.Find(appendAnim.animation).constructor, []);
                
                animation.Set(
                    i,
                    diaChar,
                    0,
                    this.#loopIndexes[0],
                    appendAnim.animationParams
                );
                
                animation.loop = false;
                animation.wait = appendAnim.wait;
                animation.duration = appendAnim.duration;
            }
            
            if (dat.animation != null)
            {
                const baseAnim = this.config.animations.Find(dat.animation);
                const animation = Reflect.construct(baseAnim.constructor, []);
                
                animation.Set(
                    i,
                    diaChar,
                    1,
                    this.#loopIndexes[1],
                    dat.animationParams
                );
                
                animation.loop = baseAnim.loop;
                animation.wait = baseAnim.wait;
                animation.duration = baseAnim.duration;
            }
            
            this.characters.push(diaChar);
            
            this.#charIndex++;
        }
        
        this.UpdateSpaces();
        
        this.#CallEvent(4);
        
        if (!this.#finishTask) await this.#Delay(dat.delayBefore);
        
        const sprite = this.config.sprites.Find(this.#portraitSprite);
        
        if (!this.#portraitEnabled && updatePortrait)
        {
            this.#diaPortrait.src = sprite.spriteURL;
            
            await new Promise(resolve => this.#diaPortrait.onload = resolve);
            
            this.#diaPortrait.onload = () => { };
            
            this.#diaPortrait.style.visibility = "visible";
            
            if (!this.#finishTask) await this.animation.portrait.onEnable.Animate(this.#diaPortrait, null, time => this.#Delay(time));
            
            this.#portraitEnabled = true;
            
            this.#CallEvent(6);
        }
        else if (updatePortrait) this.#diaPortrait.src = sprite.spriteURL;
        
        await this.#Loop();
        
        if (!this.#finishTask) await this.#Delay(dat.delayAfter);
        
        this.#CallEvent(5);
        
        this.#inUse = false;
        this.#finishTask = false;
    }
    
    async ClearText ()
    {
        const lineObjs = this.#diaLine.querySelectorAll(".dialogue-line-level");
        
        if (lineObjs.length === 0 || !this.#loaded || this.#inUse || !this.#active) return;
        
        this.#inUse = true;
        
        if (!this.#finishTask)
        {
            await this.#AnimateTextClear();
            await this.animation.lineClear.Animate(this.#diaLine, null, time => this.#Delay(time));
        }
        
        this.#diaLine.style.visibility = "hidden";
        
        for (let i = 0; i < lineObjs.length; i++) lineObjs[i].remove();
        
        this.#diaLine.style.visibility = "visible";
        
        this.#charIndex = 0;
        this.#iterIndex = 0;
        this.#wordIndex = 0;
        this.characters = [];
        this.#loopIndexes = [
            0,
            0,
            0
        ];
        this.#inUse = false;
        this.#finishTask = false;
        
        this.#CallEvent(7);
    }
    
    async Clear ()
    {
        if (this.#inUse) return;
        
        this.#inUse = true;
        
        await this.#ClearBase(false);
        
        this.#inUse = false;
        this.#finishTask = false;
        
        this.#CallEvent(7);
        this.#CallEvent(8);
    }
}

class DialogueManagerConfig
{
    animations = new NamedArray();
    audios = new NamedArray();
    sprites = new NamedArray();
    
    constructor ()
    {
        this.animations.items.push(new DialogueTextCSSAnimation());
    }
}

class DialogueData
{
    delayBefore = 0;
    delayAfter = 0;
    animationParams = [];
    
    animation = null;
    style = null;
    audio = null;
    portrait = null;
    
    constructor (data)
    {
        const dat = data ?? { };
        
        this.delayBefore = dat.delayBefore ?? 0;
        this.delayAfter = dat.delayAfter ?? 0;
        this.animationParams = dat.animationParams ?? [];
        this.animation = dat.animation;
        this.style = dat.style ?? new DialogueStyle();
        this.audio = dat.audio;
        this.portrait = dat.portrait;
    }
}

class DialogueChar
{
    #enabled = false;
    #time = 0;
    
    #diaChar = null;
    
    animations = [
        null,
        null,
        null
    ];
    
    audio = null;
    
    get isEnabled ()
    {
        return this.#enabled;
    }
    
    get delay ()
    {
        return this.#time;
    }
    
    get target ()
    {
        return this.#diaChar;
    }
    
    get style ()
    {
        return this.#diaChar.style;
    }
    
    set style (value)
    {
        this.#diaChar.style = value;
    }
    
    constructor (target, delay, audio)
    {
        this.#diaChar = target;
        this.#time = delay;
        this.audio = audio;
    }
    
    Enable ()
    {
        if (this.#enabled) return;
        
        this.#enabled = true;
        
        this.#diaChar.style.visibility = "visible";
    }
}

class DialogueStyle
{    
    backdropFilter = null;
    background = null;
    bottom = null;
    color = null;
    fontFamily = null;
    fontFeatureSettings = null;
    fontKerning = null;
    fontSize = null;
    fontSizeAdjust = null;
    fontStretch = null;
    fontStyle = null;
    fontVariant = null;
    fontVariantCaps = null;
    fontWeight = null;
    left = null;
    letterSpacing = null;
    right = null;
    textDecoration = null;
    textDecorationColor = null;
    textDecorationLine = null;
    textDecorationStyle = null;
    textDecorationThickness = null;
    textEmphasis = null;
    textShadow = null;
    textTransform = null;
    transform = null;
    transition = null;
    top = null;
    verticalAlign = null;
    writingMode = null;
    wordSpacing = null;
    zIndex = null;
    
    constructor (data)
    {
        this.Set(data ?? { });
    }
    
    Set (data)
    {
        this.backdropFilter = data.backdropFilter;
        this.background = data.background;
        this.bottom = data.bottom;
        this.color = data.color;
        this.fontFamily = data.fontFamily;
        this.fontFeatureSettings = data.fontFeatureSettings;
        this.fontKerning = data.fontKerning;
        this.fontSize = data.fontSize;
        this.fontSizeAdjust = data.fontSizeAdjust;
        this.fontStretch = data.fontStretch;
        this.fontStyle = data.fontStyle;
        this.fontVariant = data.fontVariant;
        this.fontVariantCaps = data.fontVariantCaps;
        this.fontWeight = data.fontWeight;
        this.left = data.left;
        this.letterSpacing = data.letterSpacing;
        this.right = data.right;
        this.textDecoration = data.textDecoration;
        this.textDecorationColor = data.textDecorationColor;
        this.textDecorationLine = data.textDecorationLine;
        this.textDecorationStyle = data.textDecorationStyle;
        this.textDecorationThickness = data.textDecorationThickness;
        this.textEmphasis = data.textEmphasis;
        this.textShadow = data.textShadow;
        this.textTransform = data.textTransform;
        this.transform = data.transform;
        this.transition = data.transition;
        this.top = data.top;
        this.verticalAlign = data.verticalAlign;
        this.writingMode = data.writingMode;
        this.wordSpacing = data.wordSpacing;
        this.zIndex = data.zIndex;
    }
    
    Create (...data)
    {
        let output = this;
        
        for (let i = 0; i < data.length; i++)
        {
            output = new DialogueStyle({
                backdropFilter : data[i].backdropFilter ?? output.backdropFilter ?? "",
                background : data[i].background ?? output.background ?? "",
                bottom : data[i].bottom ?? output.bottom ?? "",
                color : data[i].color ?? output.color ?? "",
                fontFamily : data[i].fontFamily ?? output.fontFamily ?? "",
                fontFeatureSettings : data[i].fontFeatureSettings ?? output.fontFeatureSettings ?? "",
                fontKerning : data[i].fontKerning ?? output.fontKerning ?? "",
                fontSize : data[i].fontSize ?? output.fontSize ?? "",
                fontSizeAdjust : data[i].fontSizeAdjust ?? output.fontSizeAdjust ?? "",
                fontStretch : data[i].fontStretch ?? output.fontStretch ?? "",
                fontStyle : data[i].fontStyle ?? output.fontStyle ?? "",
                fontVariant : data[i].fontVariant ?? output.fontVariant ?? "",
                fontVariantCaps : data[i].fontVariantCaps ?? output.fontVariantCaps ?? "",
                fontWeight : data[i].fontWeight ?? output.fontWeight ?? "",
                left : data[i].left ?? output.left ?? "",
                letterSpacing : data[i].letterSpacing ?? output.letterSpacing ?? "",
                right : data[i].right ?? output.right ?? "",
                textDecoration : data[i].textDecoration ?? output.textDecoration ?? "",
                textDecorationColor : data[i].textDecorationColor ?? output.textDecorationColor ?? "",
                textDecorationLine : data[i].textDecorationLine ?? output.textDecorationLine ?? "",
                textDecorationStyle : data[i].textDecorationStyle ?? output.textDecorationStyle ?? "",
                textDecorationThickness : data[i].textDecorationThickness ?? output.textDecorationThickness ?? "",
                textEmphasis : data[i].textEmphasis ?? output.textEmphasis ?? "",
                textShadow : data[i].textShadow ?? output.textShadow ?? "",
                textTransform : data[i].textTransform ?? output.textTransform ?? "",
                transform : data[i].transform ?? output.transform ?? "",
                transition : data[i].transition ?? output.transition ?? "",
                top : data[i].top ?? output.top ?? "",
                verticalAlign : data[i].verticalAlign ?? output.verticalAlign ?? "",
                writingMode : data[i].writingMode ?? output.writingMode ?? "",
                wordSpacing : data[i].wordSpacing ?? output.wordSpacing ?? "",
                zIndex : data[i].zIndex ?? output.zIndex ?? ""
            });
        }
        
        return output;
    }
}

class DialogueTextAnimation extends NamedItem
{
    #started = false;
    #ended = false;
    #id = 0;
    #time = 0;
    #loopIndex = 0;
    
    #diaChar = null;
    
    loop = true;
    wait = false;
    duration = 0;
    
    get hasEnded ()
    {
        return this.#ended;
    }
    
    get index ()
    {
        return this.#id;
    }
    
    get time ()
    {
        return this.#time;
    }
    
    get loopCount ()
    {
        return this.#loopIndex;
    }
    
    get dialogueChar ()
    {
        return this.#diaChar;
    }
    
    Set (index, dialogueChar, arrayIndex, loopIndex, properties)
    {
        this.#id = index;
        this.#diaChar = dialogueChar;
        this.#loopIndex = loopIndex;
        
        this.#diaChar.animations[arrayIndex] = this;
        
        const props = new NamedArray();
        
        props.items = properties;
        
        this.OnSet(props);
    }
    
    Animate ()
    {
        if (this.#ended && !this.loop) return;
        else if (!this.#started)
        {
            this.#started = true;
            this.#ended = false;
        }
        
        if (this.#time >= this.duration)
        {
            if (!this.#ended)
            {
                this.#ended = true;
                
                this.OnEnd();
                
                if (this.loop)
                {
                    this.#started = false;
                    this.#time = 0;
                    
                    this.#loopIndex++;
                }
            }
            
            if (!this.loop) return;
        }
        
        this.Update();
        
        this.#time += DialogueLoop.deltaTime;
    }
    
    OnSet (properties) { }
    
    Update () { }
    
    OnEnd () { }
}

class DialogueTextCSSAnimation extends DialogueTextAnimation
{
    #active = false;
    #animation = "";
    
    name = "css";
    
    OnSet (properties)
    {
        this.#animation = properties.Find("animation").value ?? "";
    }
    
    Update ()
    {
        if (this.#active) return;
        
        this.#active = true;
        
        this.dialogueChar.style.animation = this.#animation;
    }
    
    OnEnd ()
    {
        if (!this.#active || this.loop) return;
        
        this.#active = false;
        
        this.dialogueChar.style.animation = "";
    }
}

class DialogueResource extends NamedItem
{
    src = "";
    
    constructor (name, src)
    {
        super();
        
        this.name = name;
        this.src = src;
    }
}

class DialogueDirectory
{
    static GetCurrentPath ()
    {
        const location = window.location.toString().split("/");
        
        let output = "";
        
        for (let i = 0; i < location.length - 1; i++)
        {
            output += location[i];
            
            if (i < location.length - 2) output += "/";
        }
        
        return output;
    }
}

class DialogueAudioClip extends DialogueResource
{
    #loaded = false;
    
    #buffer = null;
    
    get isLoaded ()
    {
        return this.#loaded;
    }
    
    get audioBuffer ()
    {
        return this.#buffer;
    }
    
    constructor (name, src)
    {
        super(name, src);
        
        this.#Load();
    }
    
    async #Load ()
    {
        const audio = await fetch(this.src);
        const arrayBuffer = await audio.arrayBuffer();
        
        this.#buffer = await DialogueAudioSource.global.audioContext.decodeAudioData(arrayBuffer);
        
        this.#loaded = true;
    }
}

class DialogueAudioSource
{
    static #global = new DialogueAudioSource();
    
    static get global ()
    {
        return this.#global;
    }
    
    #pitch = 1;
    
    #context = null;
    #gain = null;
    
    get volume ()
    {
        return this.#gain.gain.value;
    }
    
    set volume (value)
    {
        this.#gain.gain.value = value;
    }
    
    get pitch ()
    {
        return this.#pitch;
    }
    
    set pitch (value)
    {
        this.#pitch = value;
    }
    
    get audioContext ()
    {
        return this.#context;
    }
    
    constructor ()
    {
        this.#context = new AudioContext();
        
        this.#gain = this.#context.createGain();
        this.#gain.connect(this.#context.destination);
    }
    
    Play (clip)
    {
        if (!clip.isLoaded) return;
        
        const source = this.#context.createBufferSource();
        
        source.buffer = clip.audioBuffer;
        source.connect(this.#gain);
        source.playbackRate.value = this.pitch;
        source.start();
    }
}

class DialogueAudioArray extends NamedArray
{
    constructor (clips, directory)
    {
        super();
        
        let dir = directory ?? 0;
        
        switch (dir)
        {
            case 0:
                dir = "";
                break;
            case 1:
                dir = DialogueDirectory.GetCurrentPath();
                break;
        }
        
        let newItems = [];
        
        for (let i = 0; i < clips.length; i++) newItems.push(new DialogueAudioClip(clips[i].name, `${dir}/${clips[i].src}`));
        
        this.items = newItems;
    }
}

class DialogueSprite extends DialogueResource
{
    #loaded = false;
    #url = "";
    
    get isLoaded ()
    {
        return this.#loaded;
    }
    
    get spriteURL ()
    {
        return this.#url;
    }
    
    constructor (name, src)
    {
        super(name, src);
        
        this.#Load();
    }
    
    async #Load ()
    {
        const img = await fetch(this.src);
        const blob = await img.blob();
        
        this.#url = await URL.createObjectURL(blob);
        
        this.#loaded = true;
    }
}

class DialogueSpriteArray extends NamedArray
{
    constructor (sprites, directory)
    {
        super();
        
        let dir = directory ?? 0;
        
        switch (dir)
        {
            case 0:
                dir = "";
                break;
            case 1:
                dir = DialogueDirectory.GetCurrentPath();
                break;
        }
        
        let newItems = [];
        
        for (let i = 0; i < sprites.length; i++) newItems.push(new DialogueSprite(sprites[i].name, `${dir}/${sprites[i].src}`));
        
        this.items = newItems;
    }
}

class DialogueAnimationPreset
{
    wait = true;
    duration = 0;
    animationParams = [];
    callback = () => { }
    
    animation = null;
    
    constructor (data)
    {
        const dat = data ?? { };
        
        this.wait = dat.wait ?? true;
        this.duration = dat.duration ?? 0;
        this.animationParams = dat.animationParams ?? [];
        this.callback = dat.callback ?? (() => { });
        this.animation = dat.animation;
    }
}

class DialogueAnimation extends DialogueAnimationPreset
{
    constructor (data)
    {
        super(data);
        
        if (this.animation == null) this.animation = "";
    }
    
    async #Invoke (target, callback, delayMethod)
    {
        target.style.animation = this.animation;
        target.style.animationDuration = `${this.duration / DialogueLoop.timeScale}s`;
        
        await delayMethod(this.duration);
        
        target.style.animation = "";
        target.style.animationDuration = "";
        
        callback();
        this.callback();
    }
    
    async Animate (target, callback, delayMethod)
    {
        if (callback == null) callback = () => { };
        if (delayMethod == null) delayMethod = time => DialogueLoop.Delay(time);
        
        if (this.wait) await this.#Invoke(target, callback, delayMethod);
        else this.#Invoke(target, callback, delayMethod);
    }
}

class DialogueBoxNPortraitAnimationData
{
    onEnable = new DialogueAnimation();
    onDisable = new DialogueAnimation();
}

class DialogueTextAnimationData
{
    onAppend = new DialogueAnimationPreset();
    onClear = new DialogueAnimationPreset();
}

class DialogueAnimationConfig
{
    box = new DialogueBoxNPortraitAnimationData();
    portrait = new DialogueBoxNPortraitAnimationData();
    lineClear = new DialogueAnimation();
    text = new DialogueTextAnimationData();
}