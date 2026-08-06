"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { clsx } from "clsx";

export function ProfilePhotoCarousel({
  photos,
  alt,
}: {
  photos: { id: string; signedUrl?: string }[];
  alt: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: photos.length > 1 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-blush-100 text-maroon-700/40">
        <ImageOff size={40} strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex">
          {photos.map((photo, i) => (
            <div key={photo.id} className="relative aspect-[4/5] w-full flex-[0_0_100%]">
              {photo.signedUrl && (
                <Image
                  src={photo.signedUrl}
                  alt={`${alt} photo ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-cover"
                  priority={i === 0}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-maroon-700 shadow-md backdrop-blur transition hover:bg-white"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-maroon-700 shadow-md backdrop-blur transition hover:bg-white"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={clsx(
                  "h-1.5 rounded-full transition-all",
                  i === selectedIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
