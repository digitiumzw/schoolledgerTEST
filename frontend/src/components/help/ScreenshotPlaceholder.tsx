import { Image } from 'lucide-react';

interface ScreenshotPlaceholderProps {
  caption: string;
}

export default function ScreenshotPlaceholder({
  caption,
}: ScreenshotPlaceholderProps) {
  return (
    <figure className="my-6">
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/40 p-8 aspect-video"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.08) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        role="img"
        aria-label={caption}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border/50 mb-3 shadow-sm">
          <Image className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <span className="text-sm text-muted-foreground/70 font-medium">
          Screenshot placeholder
        </span>
      </div>
      <figcaption className="mt-2 text-center text-sm text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
