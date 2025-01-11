import {easeInOutQuad} from './easings';
import type {TransitionFn, TransitionSequences} from './types';

export const defaultTransition: TransitionFn = (
  ctx: CanvasRenderingContext2D,
  progress: number,
  sequences: TransitionSequences,
) => {
  progress = easeInOutQuad(progress);
  const invertedProgress = 1 - progress;
  const previousFrameData = sequences.previous.advance();
  const currentFrame = sequences.current.currentFrame;
  if (previousFrameData.img) {
    ctx.drawImage(
      previousFrameData.img.img,
      0,
      0,
      previousFrameData.img.img.width * invertedProgress,
      previousFrameData.img.img.height,
      previousFrameData.img.dx,
      previousFrameData.img.dy,
      previousFrameData.img.img.width * invertedProgress,
      previousFrameData.img.img.height,
    );
  }
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
  previousFrameData.dispatchEvents?.();
};
