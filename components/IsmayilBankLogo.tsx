import Image from "next/image";

const IMAGE_WIDTH = 1118;
const IMAGE_HEIGHT = 223;
const MARK_WIDTH = 228;
const MARK_HEIGHT = 221;

/**
 * Just the blue cross, cropped from the wordmark — for tight inline spots
 * (chart tooltip rows) where the full wordmark would crowd the text.
 */
export function IsmayilBankMark({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/ismayilbank-mark.png"
      alt="İsmayılBank"
      width={MARK_WIDTH}
      height={MARK_HEIGHT}
      // Same dark-mode treatment as the wordmark: invert+hue-rotate keeps
      // the mark blue-ish but light enough to read on dark surfaces.
      className={`dark:invert dark:hue-rotate-180 ${className}`}
      style={{ width: size, height: "auto" }}
    />
  );
}

export function IsmayilBankLogo({
  size = 52,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const width = Math.round(size * (IMAGE_WIDTH / IMAGE_HEIGHT));

  return (
    <Image
      src="/images/ismayilbank-logo.png"
      alt="IsmayilBank logo"
      width={IMAGE_WIDTH}
      height={IMAGE_HEIGHT}
      // invert+hue-rotate flips the dark wordmark to white in dark mode
      // while keeping the blue mark close to its brand hue.
      className={`dark:invert dark:hue-rotate-180 ${className}`}
      // Width caps at `width`; height stays proportional so the wordmark never
      // gets squished when the flex row is tight on small screens.
      style={{ width, height: "auto", maxWidth: "100%" }}
      priority
    />
  );
}
