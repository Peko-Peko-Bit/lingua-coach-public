/**
 * components/Avatar.tsx
 * Generic avatar component.
 * Renders an image if src is provided, otherwise renders children (initials, etc.).
 */

interface AvatarProps {
  src?: string | null;
  alt: string;
  className: string;
  children?: React.ReactNode;
}

export function Avatar({ src, alt, className, children }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${className} object-cover`}
      />
    );
  }
  return <div className={className}>{children}</div>;
}
