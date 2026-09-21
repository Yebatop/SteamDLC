"use client";

import { useState } from "react";

const CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";

/**
 * Обложка из CDN Steam. У части дополнений нет капсулы, у части — вообще
 * никаких картинок, поэтому пробуем по очереди и в конце показываем заглушку:
 * пустая дыра в ряду выглядит хуже, чем честный прочерк.
 */
export default function SteamImage({
  appid,
  alt,
  className = "",
}: {
  appid: number;
  alt: string;
  className?: string;
}) {
  const sources = [`${CDN}/${appid}/capsule_231x87.jpg`, `${CDN}/${appid}/header.jpg`];
  const [index, setIndex] = useState(0);

  if (index >= sources.length) {
    return (
      <div
        className={`flex items-center justify-center bg-raised text-[10px] tracking-wider text-muted/50 ${className}`}
        aria-hidden
      >
        STEAM
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[index]}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setIndex((value) => value + 1)}
      className={`bg-raised object-cover ${className}`}
    />
  );
}
