import {easeInOutQuad} from './easings';
import type {TransitionFn, TransitionSequences} from './types';

export const defaultTransition: TransitionFn = (
  ctx: CanvasRenderingContext2D,
  progress: number,
  sequences: TransitionSequences,
) => {
  progress = easeInOutQuad(progress);
  const invertedProgress = 1 - progress;
  const previousFrameData = sequences.previous.next();
  const currentFrame = sequences.current.currentFrame;
  if (previousFrameData.frame && previousFrameData.frame.img) {
    ctx.drawImage(
      previousFrameData.frame.img,
      0,
      0,
      previousFrameData.frame.img.width * invertedProgress,
      previousFrameData.frame.img.height,
      previousFrameData.frame.dx,
      previousFrameData.frame.dy,
      previousFrameData.frame.img.width * invertedProgress,
      previousFrameData.frame.img.height,
    );
  }
  if (currentFrame.img) {
    ctx.drawImage(
      currentFrame.img,
      currentFrame.img.width * invertedProgress,
      0,
      currentFrame.img.width * progress,
      currentFrame.img.height,
      currentFrame.img.width * invertedProgress,
      currentFrame.dy,
      currentFrame.img.width * progress,
      currentFrame.img.height,
    );
  }
  previousFrameData.dispatchEvents?.();
};
