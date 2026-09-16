/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";

type MobileImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

export default function MobileImage({
  fill,
  priority,
  unoptimized,
  alt,
  style,
  ...props
}: MobileImageProps) {
  return (
    <img
      {...props}
      alt={alt}
      data-priority={priority || undefined}
      data-unoptimized={unoptimized || undefined}
      style={
        fill
          ? {
              position: "absolute",
              width: "100%",
              height: "100%",
              inset: 0,
              ...style,
            }
          : style
      }
    />
  );
}
