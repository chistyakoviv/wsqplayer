import {easeInOutQuad} from './easings';
import type {TransitionFn, TransitionSequences} from './types';

export const defaultTransition: TransitionFn = (
  ctx: CanvasRenderingContext2D,
  progress: number,
  sequences: TransitionSequences,
) => {
  progress = easeInOutQuad(progress);
  const invertedProgress = 1 - progress;
  const prevFrame = sequences.previous.currentFrame;
  const currentFrame = sequences.current.currentFrame;
  ctx.drawImage(
    prevFrame.img.orig,
    0,
    0,
    prevFrame.img.orig.width * invertedProgress,
    prevFrame.img.orig.height,
    prevFrame.img.dx,
    prevFrame.img.dy,
    prevFrame.img.width * invertedProgress,
    prevFrame.img.height,
  );
  ctx.drawImage(
    currentFrame.img.orig,
    currentFrame.img.orig.width * invertedProgress,
    0,
    currentFrame.img.orig.width * progress,
    currentFrame.img.orig.height,
    currentFrame.img.width * invertedProgress,
    currentFrame.img.dy,
    currentFrame.img.width * progress,
    currentFrame.img.height,
  );
};
