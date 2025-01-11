import {clamp} from 'helpers';
import {Sequence} from 'sequence';
import {defaultTransition} from 'transitions';
import {CanvasImage, EventEmitter} from 'types';
import {FrameSize, PlayerOpts, Transition, TransitionOpts} from 'types';

/**
 * Sequence Player.
 *
 * Feature Roadmap
 * [-] switch to the loading state if the playing sequence is not loaded yet
 * [-] support image sets for different resolutions
 * [-] backward playing
 *
 * @dispatches [loading:(start|progress|end), transition:(start|end), progress:(single number or range between 0 and 1), end]
 * @author Chistyakov Ilya <ichistyakovv@gmail.com>
 */
export class SqPlayer implements EventEmitter {
  private frameStep = 1;

  private totalFrames = 0;
  private loadedFrames = 0;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private timer?: string | number | NodeJS.Timeout;

  private frameDeltaTime!: number;
  private frameSize: FrameSize = {width: 0, height: 0};

  private opts: PlayerOpts;

  private isTransition = false;
  private isLoad = false;

  private transitions: Transition[] = [];
  private sequences: Record<string, Sequence> = {};
  private curSeqName = '';

  private events = new EventTarget();

  constructor(canvas: HTMLCanvasElement, opts: PlayerOpts) {
    this.setRenderer(canvas);
    this.setFrameRate(opts.frameRate);
    this.setSize(canvas.width, canvas.height);

    this.opts = {
      waitAll: true,
      bufferSize: 0,
      ...opts,
    };

    this.events.dispatchEvent(new CustomEvent('loading:start'));

    const loadHandler = (...args: unknown[]): void => {
      const e: CustomEvent = args[0] as CustomEvent;
      const {name, index, total} = e.detail;
      const bufferSize = this.opts.bufferSize ?? 0;

      this.loadedFrames++;

      // Render the initial frame of the current sequence as soon as it is loaded
      if (name === this.curSeqName && index === 0) {
        this.renderFrame(this.sequences[name].getFrame(index));
      }

      if ((!this.opts.waitAll || bufferSize > 0) && name === this.curSeqName) {
        if (
          // All sequences are not required to be loaded, and the current sequence is ready, or
          (!this.opts.waitAll && index + 1 === total) ||
          // The buffer contains enough frames to play the current sequence.
          (bufferSize > 0 &&
            (this.sequences[name].currentFrameIndex >= index - bufferSize ||
              index + 1 === total))
        ) {
          this.renderLoop();
          this.events.dispatchEvent(new CustomEvent('loading:end'));
        }
      }

      const progress = this.loadedFrames / this.totalFrames;
      this.events.dispatchEvent(
        new CustomEvent('loading:progress', {
          detail: {
            progress,
          },
        }),
      );
    };

    // Count frames before loading
    for (const seqOpts of opts.sequences) {
      this.totalFrames += seqOpts.frameCount;
    }

    for (const seqOpts of opts.sequences) {
      this.sequences[seqOpts.name] = new Sequence(seqOpts);
      this.sequences[seqOpts.name].on('loaded', loadHandler);
    }
  }

  setSize(width: number, height: number): void {
    this.frameSize = {width, height};
    for (const seq of Object.values(this.sequences)) {
      seq.setSize(width, height);
    }
  }

  // Frames per second
  setFrameRate(frameRate: number): void {
    this.frameDeltaTime = 1000 / frameRate;
  }

  setSequence(name: string): void {
    this.curSeqName = name;
    this.sequences[this.curSeqName].reset();
  }

  setRenderer(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    const ctx = this.canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx;
  }

  loop(): void {
    this.sequences[this.curSeqName].loop();
  }

  noloop(): void {
    this.sequences[this.curSeqName].noloop();
  }

  play(): void {
    this.sequences[this.curSeqName].play();
  }

  pause(): void {
    this.sequences[this.curSeqName].pause();
  }

  setProgress(progress: number): void {
    this.sequences[this.curSeqName].setProgress(progress);
  }

  transition(sequenceName: string, opts?: TransitionOpts): void {
    this.transitions.push({
      seqName: sequenceName,
      startTime: 0,
      duration: opts?.duration ?? 500,
      isStarted: false,
      // The previous sequence is updated to the current sequence at the start of transition processing.
      prevSeq: this.sequences[this.curSeqName],
      transitionFn: opts?.transitionFn,
      name: opts?.name,
      startCallback: opts?.startCallback,
    });
    this.isTransition = true;
  }

  on(eventName: string, fn: (...args: unknown[]) => void): void {
    this.events.addEventListener(eventName, fn);
  }

  off(eventName: string, fn: (...args: unknown[]) => void): void {
    this.events.removeEventListener(eventName, fn);
  }

  onSequence(
    sequenceName: string,
    eventName: string,
    fn: (...args: unknown[]) => void,
  ): void {
    this.sequences[sequenceName].on(eventName, fn);
  }

  offSequence(
    sequenceName: string,
    eventName: string,
    fn: (...args: unknown[]) => void,
  ): void {
    this.sequences[sequenceName].off(eventName, fn);
  }

  onceSequence(
    sequenceName: string,
    eventName: string,
    fn: (...args: unknown[]) => void,
  ): void {
    const wrapper = (...args: unknown[]) => {
      fn(...args);
      this.offSequence(sequenceName, eventName, wrapper);
    };
    this.onSequence(sequenceName, eventName, wrapper);
  }

  destroy() {
    clearTimeout(this.timer);
  }

  private renderLoop = (): void => {
    const frameData = this.sequences[this.curSeqName].advance(this.frameStep);
    if (!frameData.img) {
      this.events.dispatchEvent(new CustomEvent('loading:start'));
      return;
    }
    this.renderFrame(frameData.img);
    frameData.dispatchEvents?.();
    this.timer = setTimeout(this.renderLoop, this.frameDeltaTime);
  };

  private renderFrame(frame: CanvasImage): void {
    const curSeq = this.sequences[this.curSeqName];
    this.ctx.clearRect(0, 0, this.frameSize.width, this.frameSize.height);
    if (this.isTransition) {
      const transition = this.transitions[0];
      if (!transition.isStarted) {
        transition.isStarted = true;
        // Trigger the start transition event for the entire queue
        this.events.dispatchEvent(new CustomEvent('transition:start'));
      }
      if (transition.startTime === 0) {
        // Store the last sequence
        transition.prevSeq = this.sequences[this.curSeqName];
        // Change the current sequence
        this.setSequence(transition.seqName);
        // Apply a new state by calling the callback
        transition.startCallback && transition.startCallback();
        transition.startTime = Date.now();
        if (transition.name) {
          // Dispatch the start transition event of a named transition
          this.events.dispatchEvent(
            new CustomEvent('transition:start', {
              detail: {name: transition.name},
            }),
          );
        }
      }
      const progress = clamp(
        (Date.now() - transition.startTime) / transition.duration,
        0,
        1,
      );
      if (progress === 1) {
        this.transitions.splice(0, 1);
        if (this.transitions.length === 0) {
          this.isTransition = false;
          // Trigger the end transition event for the entire queue
          this.events.dispatchEvent(new CustomEvent('transition:end'));
        } else {
          // Mark the next transition as started to not trigger the start transition event again
          this.transitions[0].isStarted = true;
        }
        if (transition.name) {
          // Trigger the end transition event for a named transition
          this.events.dispatchEvent(
            new CustomEvent('transition:end', {
              detail: {name: transition.name},
            }),
          );
        }
      }
      const transitionFn = transition.transitionFn ?? defaultTransition;
      transitionFn(this.ctx, progress, {
        previous: transition.prevSeq,
        current: curSeq,
      });
    } else {
      this.ctx.drawImage(
        frame.img,
        0,
        0,
        frame.img.width,
        frame.img.height,
        frame.dx,
        frame.dy,
        frame.width,
        frame.height,
      );
    }
  }

  get isPlaying(): boolean {
    return this.sequences[this.curSeqName].isPlay;
  }

  get isLoop(): boolean {
    return this.sequences[this.curSeqName].isLoop;
  }

  get isEnd(): boolean {
    return this.sequences[this.curSeqName].isEnd;
  }

  get isTransitioning(): boolean {
    // The presence of unhandled transitions is considered a state in transition
    return this.transitions.length > 0;
  }

  get isLoading(): boolean {
    return this.isLoad;
  }

  get currentFrame(): number {
    return this.sequences[this.curSeqName].currentFrameIndex;
  }
}
