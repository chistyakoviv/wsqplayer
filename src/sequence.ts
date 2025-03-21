import {clamp, fitCover, parseSeparatedNumbers, prependZeros} from 'helpers';
import {ImageLoader} from 'image-loader';
import {EventEmitter, FrameData, FrameSize, Loader} from 'types';
import {CanvasImage, Frame, Segment, SeqOptions} from 'types';

export class Sequence implements EventEmitter {
  private progressEventPrefix = 'progress:';

  private opts: SeqOptions;

  private imageLoader: Loader<HTMLImageElement | null> = new ImageLoader();
  private events: EventTarget = new EventTarget();
  private segments: Segment[] = [];
  private images: CanvasImage[] = [];

  private isLooping = false;
  private isPlaying = false;

  private frameSize: FrameSize = {width: 0, height: 0};
  private dir = 1;

  private frameState: Frame = {
    current: 0,
    previous: 0,
    next: 1,
  };

  constructor(opts: SeqOptions) {
    this.opts = opts;

    const endFrame = opts.startFrame + opts.frameCount;
    for (let i = opts.startFrame; i < endFrame; i++) {
      const pathFn =
        opts.pathFn ??
        ((index: number, opts: SeqOptions) =>
          `${opts.path ?? ''}${prependZeros(index, opts.minNumerationLen ?? 3)}.${opts.extension ?? 'jpg'}`);
      const path = pathFn(i, opts);
      this.imageLoader.add(path);
    }

    this.imageLoader.on('loaded', (...args: unknown[]) => {
      const e: CustomEvent = args[0] as CustomEvent;
      const {index, image} = e.detail;
      this.images[index] = this.calsSizes(image, this.frameSize);
      this.events.dispatchEvent(
        new CustomEvent('loaded', {
          detail: {
            name: this.name,
            index,
            total: this.totalFrames,
          },
        }),
      );
    });
    this.imageLoader.load();
  }

  get name(): string {
    return this.opts.name;
  }

  get frameCount(): number {
    return this.opts.frameCount;
  }

  get isPlay(): boolean {
    return this.isPlaying;
  }

  get isLoop(): boolean {
    return this.isLooping;
  }

  get isEnd(): boolean {
    // Set isEnd flag if reached the last frame in forward direction or the first frame in reverse direction
    return (
      (this.dir === 1 && this.frameState.current === this.frameCount - 1) ||
      (this.dir === -1 && this.frameState.current === 0)
    );
  }

  get direction(): number {
    return this.dir;
  }

  get currentFrame(): CanvasImage {
    return this.getFrame(this.frameState.current);
  }

  get currentFrameIndex(): number {
    return this.frameState.current;
  }

  setSize(width: number, height: number): void {
    this.frameSize = {width, height};
    this.images = [];
  }

  private calsSizes(
    img: HTMLImageElement | null,
    frameSize: FrameSize,
  ): CanvasImage {
    if (!img) {
      return {img: null, width: 0, height: 0, dx: 0, dy: 0};
    }
    const {width: scaledWidth, height: scaledHeight} = fitCover(
      img.width,
      img.height,
      frameSize.width,
      frameSize.height,
    );
    return {
      img,
      width: scaledWidth,
      height: scaledHeight,
      dx: (frameSize.width - scaledWidth) / 2,
      dy: (frameSize.height - scaledHeight) / 2,
    };
  }

  reverse() {
    this.dir *= -1;
  }

  private nextFrameIndex(): number {
    const lastFrame = this.frameCount - 1;
    let next =
      this.frameState.current + (this.isEnd && !this.isLooping ? 0 : this.dir);

    // Wrap next frame
    if (next < 0) {
      next = lastFrame;
    } else if (next > lastFrame) {
      next = 0;
    }

    return next;
  }

  next(): FrameData {
    if (!this.isPlaying) {
      return {};
    }

    if (!this.imageLoader.isLoaded(this.frameState.next)) {
      return {};
    }

    const next = this.nextFrameIndex();

    this.frameState = {
      previous: this.frameState.current,
      current: this.frameState.next,
      next: next,
    };

    const events: (() => void)[] = [];

    // Set isLastFrame flag and stop playing when the last frame is reached
    if (this.isEnd) {
      if (!this.isLoop) {
        this.isPlaying = false;
      }
      events.push(() => this.events.dispatchEvent(new CustomEvent('end')));
    }

    // Dispatch progress event
    const frameDiff = this.frameState.current - this.frameState.previous;
    if (Math.abs(frameDiff) > 0) {
      for (let i = 0; i < this.segments.length; i++) {
        const segment = this.segments[i];
        if (
          (this.dir === 1 &&
            this.frameState.current >= segment.start &&
            this.frameState.previous <= segment.end) ||
          (this.dir === -1 &&
            this.frameState.current <= segment.start &&
            this.frameState.previous >= segment.end)
        ) {
          const progress =
            Math.max(
              Math.abs(this.frameState.current - segment.start),
              0.0001,
            ) / Math.max(Math.abs(segment.end - segment.start), 0.0001);
          events.push(() =>
            this.events.dispatchEvent(
              new CustomEvent(`progress:${segment.start}-${segment.end}`, {
                detail: {
                  progress,
                },
              }),
            ),
          );
        }
      }
    }
    return {
      frame: this.currentFrame,
      dispatchEvents: () => {
        events.forEach(fn => fn());
      },
    };
  }

  loop(): void {
    this.isLooping = true;
  }

  noloop(): void {
    this.isLooping = false;
  }

  play(): void {
    this.isPlaying = true;
  }

  pause(): void {
    this.isPlaying = false;
  }

  getFrame(index: number): CanvasImage {
    index = clamp(index, 0, this.frameCount - 1);
    if (!this.images[index]) {
      const img = this.imageLoader.get(index);
      this.images[index] = this.calsSizes(img, this.frameSize);
    }
    return this.images[index];
  }

  reset(): void {
    this.frameState = {
      previous: 0,
      current: 0,
      next: 1,
    };
    this.isLooping = false;
    this.isPlaying = false;
  }

  setProgress(progress: number): void {
    progress = clamp(progress, 0, 1);
    this.frameState = {
      ...this.frameState,
      next: Math.round(this.frameCount * progress),
    };
  }

  on(eventName: string, fn: (...args: unknown[]) => void): void {
    if (eventName.startsWith(this.progressEventPrefix)) {
      const range = eventName.substring(this.progressEventPrefix.length);
      // TODO(Ilya): Optimize storing segments by putting them into a hashtable,
      // having the key as a progress range and the value as an object of an
      // interval counter and the segment instance itself.
      // Example: { '0.5-0.8': { counter: 2, segment: { start: 0.5, end: 0.8 } } }
      // This optimization will eliminate checking the same segments but with
      // different event handler.
      const segment = this.parseSegment(range);
      this.segments.push(segment);
      this.events.addEventListener(
        `${this.progressEventPrefix}${segment.start}-${segment.end}`,
        fn,
      );
    } else {
      this.events.addEventListener(eventName, fn);
    }
  }

  off(eventName: string, fn: (...args: unknown[]) => void): void {
    if (eventName.startsWith(this.progressEventPrefix)) {
      const range = eventName.substring(this.progressEventPrefix.length);
      let isFound = false;
      const segment = this.parseSegment(range);

      for (let i = 0; i < this.segments.length; i++) {
        const breakpoint = this.segments[i];
        if (
          breakpoint.start === segment.start &&
          breakpoint.end === segment.end
        ) {
          this.segments.splice(i, 1);
          isFound = true;
          break;
        }
      }

      if (!isFound) {
        console.error(
          `Failed to remove segment from sequence ${this.name}: segment range ${range} doesn't exist`,
        );
        return;
      }

      this.events.removeEventListener(
        `${this.progressEventPrefix}${segment.start}-${segment.end}`,
        fn,
      );
    } else {
      this.events.removeEventListener(eventName, fn);
    }
  }

  get loadedFrames(): number {
    return this.imageLoader.loaded;
  }

  get totalFrames(): number {
    return this.frameCount;
  }

  private parseSegment(range: string): Segment {
    const [start, end] = parseSeparatedNumbers(range);
    if (start === undefined) {
      throw new Error(
        `invalid segment in segment event ${this.name}: ${range}`,
      );
    }
    return {
      start: Math.round(start * (this.frameCount - 1)),
      end: Math.round(
        (end === undefined ? start : end) * (this.frameCount - 1),
      ),
    };
  }
}
