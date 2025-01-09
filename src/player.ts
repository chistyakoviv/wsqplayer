import {clamp, fitCover} from 'helpers';
import {Sequence} from 'sequence';
import {defaultTransition} from 'transitions';
import {
  CanvasImage,
  FrameSize,
  PlayerOpts,
  Transition,
  TransitionOpts,
} from 'types';

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
export class SqPlayer {
  private frameStep = 1;

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private timer?: string | number | NodeJS.Timeout;

  private frameDeltaTime!: number;
  private frameSize: FrameSize = {width: 0, height: 0};

  private opts: PlayerOpts;

  private isTransition = false;

  private transitions: Transition[] = [];
  private sequences: Record<string, Sequence> = {};
  private curSeqName = '';

  private events = new EventTarget();

  constructor(canvas: HTMLCanvasElement, opts: PlayerOpts) {
    this.setRenderer(canvas);
    this.setFrameRate(opts.frameRate);
    this.setSize(canvas.width, canvas.height);

    this.opts = opts;

    for (const seqOpts of opts.sequences) {
      this.sequences[seqOpts.name] = new Sequence(seqOpts);
    }

    this.events.dispatchEvent(new CustomEvent('loading:start'));
  }

  setSize(width: number, height: number) {
    this.frameSize = {width, height};
  }

  // Frames per second
  setFrameRate(frameRate: number) {
    this.frameDeltaTime = 1000 / frameRate;
  }

  setSequence(name: string) {
    this.curSeqName = name;
    this.sequences[this.curSeqName].reset();
  }

  setRenderer(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const ctx = this.canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx;
  }

  loop() {
    this.sequences[this.curSeqName].loop();
  }

  noloop() {
    this.sequences[this.curSeqName].noloop();
  }

  play() {
    this.sequences[this.curSeqName].play();
  }

  pause() {
    this.sequences[this.curSeqName].pause();
  }

  setProgress(progress: number) {
    this.sequences[this.curSeqName].setProgress(progress);
  }

  transition(sequenceName: string, opts?: TransitionOpts) {
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

  on(eventName: string, fn: (...args: unknown[]) => void) {
    this.events.addEventListener(eventName, fn);
  }

  off(eventName: string, fn: (...args: unknown[]) => void) {
    this.events.removeEventListener(eventName, fn);
  }

  onSequence(
    sequenceName: string,
    eventName: string,
    fn: (...args: unknown[]) => void,
  ) {
    this.sequences[sequenceName].on(eventName, fn);
  }

  offSequence(
    sequenceName: string,
    eventName: string,
    fn: (...args: unknown[]) => void,
  ) {
    this.sequences[sequenceName].off(eventName, fn);
  }

  onceSequence(
    sequenceName: string,
    eventName: string,
    fn: (...args: unknown[]) => void,
  ) {
    const wrapper = (...args: unknown[]) => {
      fn(...args);
      this.offSequence(sequenceName, eventName, wrapper);
    };
    this.onSequence(sequenceName, eventName, wrapper);
  }

  destroy() {
    clearTimeout(this.timer);
  }

  private calsSizes(img: HTMLImageElement, frameSize: FrameSize) {
    const {width: scaledWidth, height: scaledHeight} = fitCover(
      img.width,
      img.height,
      frameSize.width,
      frameSize.height,
    );
    return {
      orig: img,
      width: scaledWidth,
      height: scaledHeight,
      dx: (frameSize.width - scaledWidth) / 2,
      dy: (frameSize.height - scaledHeight) / 2,
    };
  }

  private recalcSizes(images: CanvasImage[], frameSize: FrameSize) {
    return images.map(
      (img): CanvasImage => this.calsSizes(img.orig, frameSize),
    );
  }

  private renderLoop = () => {
    this.sequences[this.curSeqName].advance(this.frameStep);
    this.renderFrame();
    this.timer = setTimeout(this.renderLoop, this.frameDeltaTime);
  };

  private renderFrame() {
    const curSeq = this.sequences[this.curSeqName];
    if (curSeq.loadedFrames === 0) {
      return;
    }
    const frame = curSeq.currentFrame;
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
        frame.img.orig,
        0,
        0,
        frame.img.orig.width,
        frame.img.orig.height,
        frame.img.dx,
        frame.img.dy,
        frame.img.width,
        frame.img.height,
      );
    }
  }

  get isPlayinging(): boolean {
    return this.sequences[this.curSeqName].isPlayinging;
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

  get currentFrame(): number {
    return this.sequences[this.curSeqName].currentFrame.index;
  }
}
