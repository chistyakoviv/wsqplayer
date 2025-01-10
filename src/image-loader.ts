import {Loader} from 'types';

/**
 * Image loader
 *
 * @dispatches [loaded, error]
 */
export class ImageLoader implements Loader<HTMLImageElement> {
  private images: HTMLImageElement[] = [];
  private urls: string[] = [];

  private events = new EventTarget();

  private imagesLoaded = 0;

  add(url: string): void {
    this.urls.push(url);
  }

  get(index: number): HTMLImageElement {
    return this.images[index];
  }

  isLoaded(index: number): boolean {
    return Boolean(this.images[index]);
  }

  load(): void {
    for (let i = 0; i < this.urls.length; i++) {
      const img = new Image();
      img.onload = () => {
        // Preserve the order of images
        this.images[i] = img;
        this.imagesLoaded++;
        this.events.dispatchEvent(
          new CustomEvent('loaded', {
            detail: {
              index: i,
              image: img,
            },
          }),
        );
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${this.urls[i]}`);
        this.events.dispatchEvent(
          new CustomEvent('error', {
            detail: {
              index: i,
            },
          }),
        );
      };
      img.src = this.urls[i];
    }
  }

  on(eventName: string, fn: (...args: unknown[]) => void) {
    this.events.addEventListener(eventName, fn);
  }

  off(eventName: string, fn: (...args: unknown[]) => void) {
    this.events.removeEventListener(eventName, fn);
  }

  get total() {
    return this.urls.length;
  }

  get loaded() {
    return this.imagesLoaded;
  }
}
