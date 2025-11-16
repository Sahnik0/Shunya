import { cn } from '@/lib/utils';

type ProgressiveBlurProps = {
  className?: string;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  blurIntensity?: number;
};

export function ProgressiveBlur({
  className,
  direction = 'right',
  blurIntensity = 1,
}: ProgressiveBlurProps) {
  const gradientDirection = {
    left: 'to right',
    right: 'to left',
    top: 'to bottom',
    bottom: 'to top',
  }[direction];

  return (
    <div
      className={cn('pointer-events-none', className)}
      style={{
        background: `linear-gradient(${gradientDirection}, transparent, hsl(var(--background)))`,
        backdropFilter: `blur(${blurIntensity * 8}px)`,
        WebkitBackdropFilter: `blur(${blurIntensity * 8}px)`,
      }}
    />
  );
}
