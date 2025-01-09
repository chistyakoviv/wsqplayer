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

// export interface FreezedFrame {
//   sequenceName: string;
//   frame: number;
// }

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
  path: string;
  frameCount: number;
  name: string;
  startFrame: number;
  minNumerationLen?: number;
}

// export interface Sequence {
//   frameCount: number;
//   images: CanvasImage[];
// }

// export interface CanvasImageGroup {
//   name: string;
//   images: CanvasImage[];
//   frameCount: number;
// }

// export interface PromiseQueue {
//   named: Record<string, Promise<CanvasImage>[]>;
//   all: Promise<CanvasImageGroup>[];
// }

export interface Segment {
  start: number;
  end: number;
}

export interface PlayerOpts {
  sequences: SeqOptions[];
  startSequence: string;
  frameRate: number;
  extension: string;
}
