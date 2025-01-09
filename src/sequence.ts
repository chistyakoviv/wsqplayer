import {clamp, parseSeparatedNumbers} from 'helpers';
import {CanvasImage, Frame, FrameData, Segment, SeqOptions} from 'types';

export class Sequence {
  private progressEventPrefix = 'progress:';

  private events: EventTarget = new EventTarget();
  private segments: Segment[] = [];
  private images: CanvasImage[] = [];

  private isLooping = false;
  private isPlaying = false;
  private isLastFrame = false;

  private frameState: Frame = {
    current: 0,
    previous: 0,
  };

  constructor(private opts: SeqOptions) {}

  get name() {
    return this.opts.name;
  }

  get frameCount() {
    return this.opts.frameCount;
  }

  get isPlayinging(): boolean {
    return this.isPlaying;
  }

  get isLoop(): boolean {
    return this.isLooping;
  }

  get isEnd(): boolean {
    return this.isLastFrame;
  }

  get currentFrame(): FrameData {
    return this.getFrame(this.frameState.current);
  }

  advance(step = 1) {
    const lastFrame = this.frameCount - 1;
    let isEnd = this.frameState.current === lastFrame;

    this.frameState = {
      previous: this.isPlaying
        ? this.frameState.current
        : this.frameState.previous,
      current: this.isPlaying
        ? (this.frameState.current + (isEnd && !this.isLooping ? 0 : step)) %
          this.frameCount
        : clamp(this.frameState.current, 0, lastFrame),
    };

    // Reevaluate isEnd after advancing.
    isEnd = this.frameState.current === lastFrame;
    // Set isLastFrame flag and stop playing when the last frame is reached
    if (isEnd && !this.isLastFrame) {
      this.isLastFrame = true;
      if (!this.isLoop) {
        this.isPlaying = false;
      }
      this.events.dispatchEvent(new CustomEvent('end'));
    } else if (this.frameState.current !== lastFrame && this.isLastFrame) {
      this.isLastFrame = false;
    }

    // Dispatch progress sequenceEvents
    const frameDiff = this.frameState.current - this.frameState.previous;
    if (Math.abs(frameDiff) > 0) {
      for (let i = 0; i < this.segments.length; i++) {
        const segment = this.segments[i];
        // TODO(Ilya): implement dispatching sequenceEvents in both directions (forward and backward)
        if (
          this.frameState.current >= segment.start &&
          this.frameState.previous <= segment.end
        ) {
          const progress =
            Math.max(this.frameState.current - segment.start, 0.0001) /
            Math.max(segment.end - segment.start, 0.0001);
          this.events.dispatchEvent(
            new CustomEvent(`progress:${segment.start}-${segment.end}`, {
              detail: {
                progress,
              },
            }),
          );
        }
      }
    }
  }

  loop() {
    this.isLooping = true;
  }

  noloop() {
    this.isLooping = false;
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  getFrame(index: number): FrameData {
    index = clamp(index, 0, this.frameCount - 1);
    return {
      index,
      img: this.images[index],
    };
  }

  reset() {
    this.frameState = {
      previous: 0,
      current: 0,
    };
    this.isLooping = false;
    this.isPlaying = false;
    this.isLastFrame = false;
  }

  setProgress(progress: number) {
    progress = clamp(progress, 0, 1);
    this.frameState = {
      previous: this.frameState.current,
      current: Math.round(this.frameCount * progress),
    };
  }

  on(eventName: string, fn: (...args: unknown[]) => void) {
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

  off(eventName: string, fn: (...args: unknown[]) => void) {
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

  get loadedFrames() {
    return this.images.length;
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
