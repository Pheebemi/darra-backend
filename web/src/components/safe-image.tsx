"use client";
import Image from "next/image";
import { useState } from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  [key: string]: any;
}

export function SafeImage({ src, alt, fill, width, height, className, ...props }: SafeImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  
  // Check if it's a localhost/127.0.0.1 URL
  const isLocalhost = src?.includes("127.0.0.1") || src?.includes("localhost");

  if (useFallback || isLocalhost) {
    if (fill) {
      return (
        <img
          src={src}
          alt={alt}
          className={className}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          {...props}
        />
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        {...props}
      />
    );
  }

  try {
    if (fill) {
      return (
        <Image
          src={src}
          alt={alt}
          fill
          className={className}
          onError={() => setUseFallback(true)}
          {...props}
        />
      );
    }
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        onError={() => setUseFallback(true)}
        {...props}
      />
    );
  } catch (error) {
    // Fallback to regular img
    if (fill) {
      return (
        <img
          src={src}
          alt={alt}
          className={className}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          {...props}
        />
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        {...props}
      />
    );
  }
}





