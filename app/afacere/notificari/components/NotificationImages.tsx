"use client";

import Image from "next/image";
import { Images } from "lucide-react";

import type { NotificationImage } from "../types";

interface NotificationImagesProps {
  images: NotificationImage[];
  compact?: boolean;
}

export default function NotificationImages({
  images,
  compact = false,
}: NotificationImagesProps) {
  if (images.length === 0) {
    return null;
  }

  const sortedImages = [...images].sort(
    (firstImage, secondImage) => firstImage.position - secondImage.position,
  );

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-white">
          <Images className="h-4 w-4 text-[#B8904D]" />
          Imagini atașate
        </p>

        <span className="text-xs text-zinc-500">
          {sortedImages.length} imagini
        </span>
      </div>

      <div
        className={`grid gap-4 ${
          compact ? "md:grid-cols-2" : "sm:grid-cols-2"
        }`}
      >
        {sortedImages.map((image, index) => (
          <article
            key={image.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
          >
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={image.image_path}
                alt={
                  image.display_name?.trim() ||
                  `Imagine notificare ${index + 1}`
                }
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition duration-300 hover:scale-105"
              />

              <span className="absolute top-3 left-3 rounded-lg bg-black/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Imaginea {index + 1}
              </span>
            </div>

            {image.display_name && (
              <div className="border-t border-white/10 px-4 py-3">
                <p className="text-sm font-medium text-zinc-200">
                  {image.display_name}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
