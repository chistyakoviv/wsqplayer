import {Sequence} from 'sequence';

export interface CanvasImage {
  orig: HTMLImageElement;
  width: number;
  height: number;
  dx: number;
  dy: number;
}

export interface Frame {
  current: number;
  previous: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export interface FrameData {
  index: number;
  img: CanvasImage;
}

export interface TransitionSequences {
  previous: Sequence;
  current: Sequence;
}

export type TransitionFn = (
  ctx: CanvasRenderingContext2D,
  progress: number,
  sequence: TransitionSequences,
) => void;

export interface Transition {
  seqName: string;
  startTime: number;
  duration: number;
  isStarted: boolean;
  prevSeq: Sequence;
  transitionFn?: TransitionFn;
  name?: string;
  startCallback?: () => void;
}

export interface TransitionOpts {
  duration?: number;
  transitionFn?: TransitionFn;
  name?: string;
  startCallback?: () => void;
}

export interface SeqOptions {
  path?: string;
  frameCount: number;
  name: string;
  startFrame: number;
  minNumerationLen?: number;
  extension?: string;
  pathFn?: (index: number, opts: SeqOptions) => string;
}

export interface Segment {
  start: number;
  end: number;
}

export interface PlayerOpts {
  sequences: SeqOptions[];
  startSequence: string;
  frameRate: number;
  bufferSize?: number;
  waitAll?: boolean;
}

export interface EventEmitter {
  on: (eventName: string, fn: (...args: unknown[]) => void) => void;
  off: (eventName: string, fn: (...args: unknown[]) => void) => void;
}

export interface Loader<T> extends EventEmitter {
  add: (url: string) => void;
  load: () => void;
  get(index: number): T;
  isLoaded(index: number): boolean;
  get total(): number;
  get loaded(): number;
}
